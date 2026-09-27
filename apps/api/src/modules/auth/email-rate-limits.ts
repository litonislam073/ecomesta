/** Abuse limits for endpoints that send email or check emailed tokens. */
export const EMAIL_RATE_LIMITS = {
  forgotPasswordPerIp: { limit: 5, windowSeconds: 60 * 60 },
  forgotPasswordPerEmail: { limit: 5, windowSeconds: 60 * 60 },
  resetPasswordPerIp: { limit: 20, windowSeconds: 15 * 60 },
  verificationEmailPerUser: { limit: 5, windowSeconds: 60 * 60 },
  verificationEmailPerIp: { limit: 5, windowSeconds: 60 * 60 },
  verifyEmailPerIp: { limit: 20, windowSeconds: 15 * 60 },
  supportPerUser: { limit: 5, windowSeconds: 60 * 60 },
  supportPerIp: { limit: 20, windowSeconds: 60 * 60 },
} as const;

export type RateLimitRule = (typeof EMAIL_RATE_LIMITS)[keyof typeof EMAIL_RATE_LIMITS];
