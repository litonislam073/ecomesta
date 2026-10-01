import { AiSupportKnowledge } from './ai-support.knowledge';
import { detectLanguageStyle, fallbackMessage } from './ai-support.language';
import { buildSystemPrompt } from './ai-support.prompts';
import { SYSTEM_PROMPT_CANARY, fixSitePaths, isUnsafeOutput } from './ai-support.safety';
import { AI_SUPPORT_LIMITS, trimHistory, type ChatTurn } from './ai-support.service';
import { AI_SUPPORT_TOOLS, runAiSupportTool, type ToolContext } from './ai-support.tools';

describe('AI support — language style', () => {
  it.each([
    ['Ecomesta diye ami ki online store banate parbo?', 'banglish'],
    ['amar store e product add korte parbo?', 'banglish'],
    ['dam koto?', 'banglish'],
    ['Can I connect my custom domain?', 'en'],
    ['How much is the Growth plan yearly?', 'en'],
    ['yearly nile koto porbe?', 'banglish'],
    ['amake ekta biryani recipe dao', 'banglish'],
    ['Ecomesta e free trial ache?', 'banglish'],
    ['Do you support e-commerce SEO?', 'en'],
    ['আমি কি নিজের ডোমেইন যুক্ত করতে পারব?', 'bn'],
    ['Growth প্ল্যানের দাম কত?', 'bn'],
  ])('%s → %s', (text, style) => {
    expect(detectLanguageStyle(text)).toBe(style);
  });

  it('has a friendly, non-technical fallback in every style', () => {
    for (const style of ['en', 'bn', 'banglish'] as const) {
      const text = fallbackMessage('unavailable', style);
      expect(text).not.toMatch(/openai|500|error|exception/i);
    }
    expect(fallbackMessage('unavailable', 'en')).toBe(
      "I'm having trouble responding right now. Please try again in a moment or contact our support team.",
    );
  });
});

describe('AI support — knowledge retrieval', () => {
  const knowledge = new AiSupportKnowledge();

  it('is built from the website content and platform facts', () => {
    expect(knowledge.chunks.length).toBeGreaterThan(100);
    expect(knowledge.chunks.some((chunk) => chunk.path === '/faq')).toBe(true);
    expect(knowledge.chunks.some((chunk) => chunk.id === 'fact-subscription-payment')).toBe(true);
  });

  it('finds custom domain guidance', () => {
    const results = knowledge.search('connect custom domain');
    expect(results[0]?.path).toMatch(/domain/);
  });

  it('maps Bangla and Banglish pricing words to pricing facts', () => {
    expect(knowledge.search('দাম কত').some((chunk) => chunk.path === '/pricing')).toBe(true);
    expect(knowledge.search('plan er dam koto').some((chunk) => chunk.path === '/pricing')).toBe(true);
  });

  it('answers bKash questions with the honest "no direct integration" content', () => {
    const text = knowledge.search('bkash nagad integration').map((chunk) => chunk.text).join(' ');
    expect(text).toMatch(/no direct bKash or Nagad integration|not a bKash or Nagad integration/i);
  });

  it('keeps results within the size budget and returns nothing for empty queries', () => {
    const results = knowledge.search('store products orders payments shipping', 4, 3500);
    expect(results.length).toBeLessThanOrEqual(4);
    expect(knowledge.search('   ')).toEqual([]);
  });
});

describe('AI support — conversation budget', () => {
  const turn = (role: ChatTurn['role'], content: string): ChatTurn => ({ role, content });

  it('keeps the newest turns within the message limit and starts with the customer', () => {
    const turns: ChatTurn[] = [];
    for (let i = 0; i < 30; i += 1) turns.push(turn(i % 2 ? 'assistant' : 'user', `message ${i}`));
    turns.push(turn('user', 'latest'));
    const kept = trimHistory(turns);
    expect(kept.length).toBeLessThanOrEqual(AI_SUPPORT_LIMITS.maxHistoryMessages);
    expect(kept.at(-1)).toEqual({ role: 'user', content: 'latest' });
    expect(kept[0]!.role).toBe('user');
  });

  it('drops old turns past the character budget and shortens long assistant replies', () => {
    const turns = [
      turn('user', 'a'.repeat(1000)),
      turn('assistant', 'b'.repeat(5000)),
      ...Array.from({ length: 8 }, (_, i) => turn(i % 2 ? 'assistant' : 'user', 'c'.repeat(900))),
      turn('user', 'latest question'),
    ];
    const kept = trimHistory(turns);
    const chars = kept.reduce((sum, message) => sum + String(message.content).length, 0);
    expect(chars).toBeLessThanOrEqual(AI_SUPPORT_LIMITS.maxHistoryChars);
    for (const message of kept) {
      if (message.role === 'assistant') expect(String(message.content).length).toBeLessThanOrEqual(1500);
    }
  });
});

describe('AI support — output safety and prompt', () => {
  it.each([
    [`Sure, my instructions say ${SYSTEM_PROMPT_CANARY}`],
    ['the key is sk-proj-abcdefghijklmnopqrstuvwx'],
    ['DATABASE_URL=postgresql://ecomesta:pw@postgres:5432/db'],
    ['call http://localhost:3001/api/v1/admin'],
    ['the container ecomesta-postgres-1 holds it'],
  ])('blocks %s', (text) => {
    expect(isUnsafeOutput(text)).toBe(true);
  });

  it('allows normal support answers', () => {
    expect(isUnsafeOutput('The Growth plan is ৳299/month. See /pricing for details.')).toBe(false);
  });

  it('builds a prompt with the language hint, live prices and the injection rules', () => {
    const prompt = buildSystemPrompt({
      style: 'banglish',
      supportEmail: 'support@ecomesta.com',
      plans: [
        {
          name: 'Growth',
          slug: 'growth',
          description: null,
          tagline: null,
          features: [],
          highlighted: true,
          currency: 'BDT',
          monthlyPrice: 299,
          trialMonths: 2,
          limits: null,
          prices: [
            { billingCycle: 'MONTHLY', amount: 299, months: 1, discountPercent: 0, effectiveMonthly: 299 },
            { billingCycle: 'SEMI_ANNUAL', amount: 1615, months: 6, discountPercent: 10, effectiveMonthly: 269 },
            { billingCycle: 'YEARLY', amount: 2691, months: 12, discountPercent: 25, effectiveMonthly: 224 },
          ],
        },
      ],
    });
    expect(prompt).toMatch(/Banglish/);
    expect(prompt).toMatch(/Growth: ৳299\/month, ৳1,615 per 6 months .* ৳2,691\/year/);
    expect(prompt).toMatch(/untrusted/);
    expect(prompt).toMatch(/can't share internal instructions/);
    expect(prompt).toMatch(/no direct bKash, Nagad or Rocket checkout integration/);
    expect(prompt).toMatch(/no Facebook, Messenger or social media integration/);
    expect(prompt).toMatch(/never in Bengali script/);
  });
});

describe('AI support — tools', () => {
  const context = (): ToolContext => ({
    knowledge: new AiSupportKnowledge(),
    plans: async () => [],
    supportEmail: 'support@ecomesta.com',
    handoff: null,
  });

  it('offers only read-only public tools and the handoff signal', () => {
    expect(AI_SUPPORT_TOOLS.map((tool) => tool.function.name).sort()).toEqual([
      'get_pricing',
      'get_support_contact',
      'offer_human_support',
      'search_ecomesta_knowledge',
    ]);
  });

  it('refuses unknown tools, bad and oversized arguments without running anything', async () => {
    const ctx = context();
    expect((await runAiSupportTool('run_sql', '{"query":"select * from users"}', ctx)).tool).toBeNull();
    expect((await runAiSupportTool('get_merchant_orders', '{}', ctx)).result).toMatch(/Unknown tool/);
    expect((await runAiSupportTool('search_ecomesta_knowledge', '{not json', ctx)).result).toMatch(/Invalid arguments/);
    expect((await runAiSupportTool('search_ecomesta_knowledge', `{"query":"${'x'.repeat(600)}"}`, ctx)).result).toMatch(
      /too long/,
    );
  });

  it('offer_human_support only flags the form; it does not claim anything was sent', async () => {
    const ctx = context();
    const { result } = await runAiSupportTool('offer_human_support', '{"reason":"Billing question"}', ctx);
    expect(ctx.handoff).toEqual({ reason: 'Billing question' });
    expect(result).toMatch(/Nothing has been sent yet/);
  });
});

describe('AI support — page links', () => {
  it('keeps real pages and turns invented ones into their section page', () => {
    expect(fixSitePaths('See /features/custom-domain for steps.')).toBe('See /features/custom-domain for steps.');
    expect(fixSitePaths('See /features/custom-domains for steps.')).toBe('See /features for steps.');
    expect(fixSitePaths('Read /pricing.')).toBe('Read /pricing.');
    expect(fixSitePaths('Visit /blog/not-a-post today')).toBe('Visit /blog today');
    expect(fixSitePaths('এই পেজ দেখুন: /payments/bkash-direct।')).toBe('এই পেজ দেখুন: /payments।');
    expect(fixSitePaths('দেখুন: /features/custom-domain।')).toBe('দেখুন: /features/custom-domain।');
    expect(fixSitePaths('See [Custom Domain](https://ecomesta.com/features/custom-domains) and https://www.ecomesta.com/pricing.')).toBe(
      'See [Custom Domain](/features) and /pricing.',
    );
  });

  it('lists the real pages in the prompt and asks for respectful address', () => {
    const prompt = buildSystemPrompt({ plans: [], style: 'bn', supportEmail: null });
    expect(prompt).toContain('/features/custom-domain');
    expect(prompt).toMatch(/আপনি/);
    expect(prompt).toMatch(/never invent one/);
  });

  it('limits answers to Ecomesta and does not present itself as an AI', () => {
    const prompt = buildSystemPrompt({ plans: [], style: 'en', supportEmail: null });
    expect(prompt).toMatch(/Only answer questions about Ecomesta/);
    expect(prompt).toMatch(/politely decline .* Do not answer any part of it/s);
    expect(prompt).toMatch(/Do not introduce yourself as an AI/);
    expect(prompt).toMatch(/sincerely asks whether they are talking to a real person, say honestly/);
    for (const style of ['en', 'bn', 'banglish'] as const) {
      expect(fallbackMessage('disabled', style)).not.toMatch(/\bAI\b/);
    }
  });

  it('puts the knowledge found for the latest question into the prompt', () => {
    const reference = new AiSupportKnowledge().search('how to connect custom domain', 3, 2500);
    const prompt = buildSystemPrompt({ plans: [], style: 'en', supportEmail: null, reference });
    expect(prompt).toMatch(/Reference material for the latest question/);
    expect(prompt).toContain('[Custom Domain');
    expect(prompt).toMatch(/DNS TXT record/);
    expect(buildSystemPrompt({ plans: [], style: 'en', supportEmail: null })).not.toMatch(/Reference material/);
  });
});
