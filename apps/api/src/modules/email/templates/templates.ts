import type {
  MerchantWelcomeParams,
  PasswordChangedParams,
  StoreCreatedParams,
  SupportRequestParams,
} from '../email.events';
import { renderEmail, type DetailRow, type EmailBrand, type RenderedEmail } from './layout';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  SEMI_ANNUAL: 'Every 6 months',
  YEARLY: 'Yearly',
};

function greeting(firstName: string | null): string {
  return firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi,';
}

function formatDateTime(iso: string): string {
  return `${DATE_TIME.format(new Date(iso))} UTC`;
}

function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

function supportSentence(brand: EmailBrand): string {
  return brand.supportEmail
    ? `If you need help, reply to this email or contact ${brand.supportEmail}.`
    : 'If you need help, reply to this email.';
}

export function welcomeEmail(
  params: MerchantWelcomeParams,
  brand: EmailBrand,
  verification: { url: string; expiresInHours: number } | null,
): RenderedEmail {
  return renderEmail(
    {
      subject: 'Welcome to Ecomesta',
      preheader: 'Your merchant account is ready. Next, create your store.',
      heading: 'Welcome to Ecomesta',
      intro: [
        greeting(params.firstName),
        'Your merchant account is ready. Ecomesta gives you one dashboard to run your online store: products, inventory, orders, payments and delivery.',
        'Your next step is to create your store. Choose a store name and web address, then start adding products.',
      ],
      cta: { label: 'Go to Your Dashboard', url: `${brand.merchantUrl}/dashboard` },
      secondaryLink: verification
        ? {
            lead: `Please confirm your email address (link valid for ${verification.expiresInHours} hours):`,
            label: 'Confirm email address',
            url: verification.url,
          }
        : undefined,
      outro: [supportSentence(brand)],
    },
    brand,
  );
}

export function emailVerificationEmail(
  params: { firstName: string | null; verifyUrl: string; expiresInHours: number },
  brand: EmailBrand,
): RenderedEmail {
  return renderEmail(
    {
      subject: 'Confirm your Ecomesta email address',
      preheader: 'Confirm the email address on your Ecomesta account.',
      heading: 'Confirm your email address',
      intro: [
        greeting(params.firstName),
        'Please confirm that this is the email address for your Ecomesta merchant account.',
      ],
      cta: { label: 'Confirm Email Address', url: params.verifyUrl },
      outro: [`This link expires in ${params.expiresInHours} hours and can only be used once.`],
      notice:
        'If you did not create an Ecomesta account or request this email, you can safely ignore it.',
    },
    brand,
  );
}

export function storeCreatedEmail(params: StoreCreatedParams, brand: EmailBrand, storeUrl: string): RenderedEmail {
  const dashboardUrl = `${brand.merchantUrl}/dashboard`;
  const details: DetailRow[] = [
    { label: 'Store', value: params.storeName },
    { label: 'Store URL', value: storeUrl, href: storeUrl },
    { label: 'Dashboard', value: dashboardUrl, href: dashboardUrl },
  ];
  if (params.planName) {
    const cycle = params.billingCycle ? CYCLE_LABELS[params.billingCycle] : undefined;
    details.push({ label: 'Plan', value: cycle ? `${params.planName} (${cycle})` : params.planName });
  }
  if (params.trialEndsAt) {
    details.push({ label: 'Free trial', value: `Until ${formatDate(params.trialEndsAt)}` });
  }
  return renderEmail(
    {
      subject: `Your store ${params.storeName} is ready`,
      preheader: `${params.storeName} has been created on Ecomesta.`,
      heading: 'Your store is ready',
      intro: [
        greeting(params.firstName),
        `${params.storeName} has been created. Add your products, set up payments and delivery, then share your store link with customers.`,
      ],
      details,
      cta: { label: 'Open Your Dashboard', url: dashboardUrl },
      outro: [supportSentence(brand)],
    },
    brand,
  );
}

export function passwordResetEmail(
  params: { firstName: string | null; resetUrl: string; expiresInMinutes: number },
  brand: EmailBrand,
): RenderedEmail {
  return renderEmail(
    {
      subject: 'Reset your Ecomesta password',
      preheader: 'Use this link to choose a new password.',
      heading: 'Reset your password',
      intro: [
        greeting(params.firstName),
        'We received a request to reset the password for your Ecomesta account.',
      ],
      cta: { label: 'Reset Password', url: params.resetUrl },
      outro: [
        `This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
        supportSentence(brand),
      ],
      notice:
        'If you did not request this password reset, you can safely ignore this email. Your password will not change.',
    },
    brand,
  );
}

export function passwordChangedEmail(params: PasswordChangedParams, brand: EmailBrand): RenderedEmail {
  return renderEmail(
    {
      subject: 'Your Ecomesta password was changed',
      preheader: 'The password for your Ecomesta account was changed.',
      heading: 'Your password was changed',
      intro: [
        greeting(params.firstName),
        `The password for your Ecomesta account was changed on ${formatDateTime(params.changedAt)}.`,
        'For your security, you have been signed out of Ecomesta on all devices. Sign in again with your new password.',
      ],
      cta: { label: 'Sign In', url: `${brand.merchantUrl}/login` },
      secondaryLink: {
        lead: 'Did not make this change?',
        label: 'Reset your password now',
        url: `${brand.merchantUrl}/forgot-password`,
      },
      notice: brand.supportEmail
        ? `If you did not change your password, reset it immediately and contact ${brand.supportEmail}.`
        : 'If you did not change your password, reset it immediately.',
    },
    brand,
  );
}

export function supportRequestEmail(
  params: SupportRequestParams,
  brand: EmailBrand,
  sender: { name: string; email: string; userId: string; tenantId: string | null; storeId: string | null },
): RenderedEmail {
  const details: DetailRow[] = [
    { label: 'From', value: sender.name },
    { label: 'Account email', value: sender.email },
    { label: 'User ID', value: sender.userId },
    { label: 'Category', value: params.category },
  ];
  if (params.storeName) details.push({ label: 'Store', value: params.storeName });
  if (sender.storeId) details.push({ label: 'Store ID', value: sender.storeId });
  if (sender.tenantId) details.push({ label: 'Tenant ID', value: sender.tenantId });
  return renderEmail(
    {
      subject: `[Support] ${params.category}: ${params.subject}`,
      preheader: `Support request from ${sender.name}`,
      heading: params.subject,
      intro: ['A merchant sent a support request from the Ecomesta dashboard.'],
      details,
      outro: [params.message],
      notice: 'Reply to this email to respond to the merchant directly.',
    },
    brand,
  );
}
