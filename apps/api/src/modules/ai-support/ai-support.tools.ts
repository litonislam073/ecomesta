import type { PublicPlan } from '@ecomesta/types';
import { PAYMENT_GRACE_DAYS } from '@ecomesta/utils';
import type { AiSupportKnowledge } from './ai-support.knowledge';
import type { ChatToolDefinition } from './openai.client';

/**
 * The only functions the model may call. All are read-only views of public
 * information, except offer_human_support, which merely asks the website to
 * show the support form — submitting it is the visitor's own action.
 */
export const AI_SUPPORT_TOOLS: ChatToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_ecomesta_knowledge',
      description:
        'Search Ecomesta’s public website content (features, setup, payments, shipping, domains, themes, coupons, FAQ, guides). Use English keywords.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to look up, in English keywords' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pricing',
      description: 'Current Ecomesta plans with BDT prices for every billing period, plan limits and how paying at sign-up works.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_support_contact',
      description: 'How visitors can reach the Ecomesta support team.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'offer_human_support',
      description:
        'Show the customer a short form to contact the Ecomesta support team. Use when a human is needed. Does not contact anyone by itself.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'One short sentence: what the customer needs help with' } },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
];

export type AiSupportToolName = 'search_ecomesta_knowledge' | 'get_pricing' | 'get_support_contact' | 'offer_human_support';

export interface ToolContext {
  knowledge: AiSupportKnowledge;
  plans: () => Promise<PublicPlan[]>;
  supportEmail: string | null;
  /** Set when the model offers human support during this turn. */
  handoff: { reason: string } | null;
}

const MAX_ARGUMENT_CHARS = 500;

/** Runs one model-requested tool. Unknown tools and bad arguments are refused, never executed. */
export async function runAiSupportTool(
  name: string,
  rawArguments: string,
  context: ToolContext,
): Promise<{ result: string; tool: AiSupportToolName | null }> {
  if (rawArguments.length > MAX_ARGUMENT_CHARS) {
    return { result: JSON.stringify({ error: 'Arguments too long' }), tool: null };
  }
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = rawArguments.trim() ? JSON.parse(rawArguments) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    return { result: JSON.stringify({ error: 'Invalid arguments' }), tool: null };
  }

  switch (name) {
    case 'search_ecomesta_knowledge': {
      const query = typeof args.query === 'string' ? args.query.slice(0, 200) : '';
      const results = context.knowledge.search(query).map((chunk) => ({
        title: chunk.title,
        page: chunk.path,
        content: chunk.text,
      }));
      return {
        result: JSON.stringify(results.length ? { results } : { results: [], note: 'Nothing found for this query.' }),
        tool: 'search_ecomesta_knowledge',
      };
    }
    case 'get_pricing': {
      const plans = await context.plans();
      return {
        result: JSON.stringify({
          currency: 'BDT',
          freeTrial: false,
          signUp: 'Pay for the chosen plan in the last step of sign-up; the store goes live once the payment is confirmed.',
          gracePeriodDays: PAYMENT_GRACE_DAYS,
          page: '/pricing',
          plans: plans.map((plan) => ({
            name: plan.name,
            tagline: plan.tagline,
            prices: plan.prices.map((price) => ({
              period: price.billingCycle,
              amount: price.amount,
              discountPercent: price.discountPercent,
            })),
            limits: plan.limits,
            features: plan.features,
          })),
        }),
        tool: 'get_pricing',
      };
    }
    case 'get_support_contact':
      return {
        result: JSON.stringify({
          supportEmail: context.supportEmail,
          contactPage: '/contact',
          supportForm: 'The customer can ask here to talk to a person; you then call offer_human_support.',
        }),
        tool: 'get_support_contact',
      };
    case 'offer_human_support': {
      const reason = typeof args.reason === 'string' ? args.reason.slice(0, 200) : 'Customer asked for help';
      context.handoff = { reason };
      return {
        result: JSON.stringify({
          formShown: true,
          note: 'A support form is now shown under your reply. Nothing has been sent yet; the customer must submit it.',
        }),
        tool: 'offer_human_support',
      };
    }
    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), tool: null };
  }
}
