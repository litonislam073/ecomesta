/** Mirrors the API password policy (password-policy.ts); the API remains the source of truth. */
export const PASSWORD_RULES = [
  { id: 'length', label: '8 to 128 characters', test: (v: string) => v.length >= 8 && v.length <= 128 },
  { id: 'letter', label: 'At least one letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { id: 'number', label: 'At least one number', test: (v: string) => /\d/.test(v) },
] as const;

export function meetsPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="mt-1 grid gap-1 sm:grid-cols-3" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-sm ${met ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {met ? <path d="M4 10.5l4 4 8-9" /> : <circle cx="10" cy="10" r="3" />}
            </svg>
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
