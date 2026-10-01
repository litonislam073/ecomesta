import {
  DEFAULT_AI_SUPPORT_RETENTION_DAYS,
  activeConversationWhere,
  expiredConversationWhere,
  retentionCutoff,
  retentionDays,
} from './ai-support-retention';

describe('support chat retention settings', () => {
  it('defaults to 365 days when unset, empty or invalid', () => {
    expect(DEFAULT_AI_SUPPORT_RETENTION_DAYS).toBe(365);
    for (const raw of [undefined, null, '', '  ', 'abc', '0', '-1', '1.5', '3651', 0, 4000]) {
      expect(retentionDays(raw)).toBe(365);
    }
  });

  it('uses a valid number of days, given as text or number', () => {
    expect(retentionDays('30')).toBe(30);
    expect(retentionDays(90)).toBe(90);
    expect(retentionDays('3650')).toBe(3650);
  });

  it('measures the cutoff in whole days back from now', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    expect(retentionCutoff(365, now).toISOString()).toBe('2025-10-01T12:00:00.000Z');
    expect(retentionCutoff(1, now).toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  it('judges a chat by its last message, or by its start when it has none', () => {
    const cutoff = new Date('2025-10-01T00:00:00.000Z');
    expect(expiredConversationWhere(cutoff)).toEqual({
      OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }],
    });
    expect(activeConversationWhere(cutoff)).toEqual({
      OR: [{ lastMessageAt: { gte: cutoff } }, { lastMessageAt: null, createdAt: { gte: cutoff } }],
    });
  });
});
