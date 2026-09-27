'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@ecomesta/ui';
import { authErrorMessage } from '@/components/auth/auth-errors';
import { Field, SettingsHeader, textareaClass } from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

/** Mirrors SUPPORT_CATEGORIES in the API. */
const CATEGORIES = [
  'Account',
  'Billing',
  'Store setup',
  'Orders',
  'Payments',
  'Shipping',
  'Technical issue',
  'Other',
] as const;

interface SupportContact {
  supportEmail: string | null;
  requestsEnabled: boolean;
}

type FieldErrors = { subject?: string; message?: string };

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-000000000000'.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16));
}

export default function SupportView() {
  const { selectedStore } = useStoreContext();
  const [contact, setContact] = useState<SupportContact | null>(null);
  const [contactError, setContactError] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Account');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includeStore, setIncludeStore] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const requestId = useRef(newRequestId());

  useEffect(() => {
    api
      .get<{ success: true; data: SupportContact }>('/support/contact', { token: null })
      .then((res) => setContact(res.data))
      .catch(() => setContactError(true));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const errors: FieldErrors = {};
    if (subject.trim().length < 3) errors.subject = 'Enter a subject of at least 3 characters.';
    else if (subject.trim().length > 150) errors.subject = 'Use 150 characters or fewer.';
    if (message.trim().length < 10) errors.message = 'Describe your question in at least 10 characters.';
    else if (message.trim().length > 5000) errors.message = 'Use 5000 characters or fewer.';
    setFieldErrors(errors);
    if (errors.subject || errors.message) return;

    setSubmitting(true);
    try {
      await api.post('/support/requests', {
        category,
        subject: subject.trim(),
        message: message.trim(),
        storeId: includeStore && selectedStore ? selectedStore.id : undefined,
        requestId: requestId.current,
      });
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, 'recovery').message);
    } finally {
      setSubmitting(false);
    }
  }

  function startNew() {
    requestId.current = newRequestId();
    setSubject('');
    setMessage('');
    setSent(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsHeader
        title="Help & support"
        description="Questions about your store, billing or account? Send the Ecomesta team a message."
      />

      {!contact && !contactError ? <LoadingState label="Loading support options" /> : null}

      {contact?.supportEmail ? (
        <Card title="Email us">
          <p className="text-sm text-[var(--color-muted)]">
            You can also write to{' '}
            <a
              href={`mailto:${contact.supportEmail}`}
              className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              {contact.supportEmail}
            </a>{' '}
            from the email address on your account.
          </p>
        </Card>
      ) : null}

      {contact && !contact.requestsEnabled ? (
        <Card title="Support requests">
          <p className="text-sm text-[var(--color-muted)]">
            Support requests are not available right now. Please try again later.
          </p>
        </Card>
      ) : null}

      {contactError ? (
        <Card title="Support requests">
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            We could not load support options. Refresh the page to try again.
          </p>
        </Card>
      ) : null}

      {contact?.requestsEnabled && sent ? (
        <Card title="Request sent">
          <div role="status" className="space-y-3 text-sm">
            <p>Thanks — your message is on its way to our support team. We will reply to your account email.</p>
            <Button variant="secondary" onClick={startNew}>
              Send another request
            </Button>
          </div>
        </Card>
      ) : null}

      {contact?.requestsEnabled && !sent ? (
        <Card title="Send a support request">
          <form className="space-y-4" onSubmit={onSubmit} noValidate aria-busy={submitting}>
            <Field id="support-category" label="Topic">
              <Select
                id="support-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="support-subject" label="Subject" error={fieldErrors.subject} counter={`${subject.length}/150`}>
              <Input
                id="support-subject"
                value={subject}
                maxLength={150}
                aria-invalid={fieldErrors.subject ? true : undefined}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
            <Field id="support-message" label="Message" error={fieldErrors.message} counter={`${message.length}/5000`}>
              <textarea
                id="support-message"
                rows={7}
                className={textareaClass}
                value={message}
                maxLength={5000}
                aria-invalid={fieldErrors.message ? true : undefined}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
            {selectedStore ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeStore}
                  onChange={(e) => setIncludeStore(e.target.checked)}
                />
                This is about {selectedStore.name}
              </label>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send request'}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
