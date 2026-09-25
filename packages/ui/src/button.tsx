import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-transparent',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-bg)]',
  ghost: 'bg-transparent text-[var(--color-ink)] border-transparent hover:bg-[var(--color-bg)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] border-transparent',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
