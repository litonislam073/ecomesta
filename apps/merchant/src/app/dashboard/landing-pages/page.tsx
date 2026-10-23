"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  LANDING_TEMPLATES,
  LANDING_TEMPLATE_LIST,
  type LandingPageDetail,
  type LandingPageSummary,
  type LandingPagesUsage,
  type LandingTemplateKey,
} from "@ecomesta/utils";
import { Button } from "@ecomesta/ui";
import { StoreScoped } from "@/components/catalog/store-scoped";
import {
  landingDemoUrl,
  landingPageUrl,
} from "@/components/landing/landing-utils";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { humanApiError } from "@/lib/catalog-utils";
import { useCanManageStore } from "@/lib/permissions";
import { useStoreContext } from "@/lib/store-context";

function LockedBanner() {
  return (
    <section
      aria-labelledby="landing-locked"
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#f1d9a6] bg-[#fff8ea] p-5"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fde9bd] text-lg"
      >
        🔒
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="landing-locked" className="font-semibold">
          Landing pages are available on the Growth and Business plans
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          Build campaign pages for your ads, with their own order form. Growth
          includes 5 pages; Business is unlimited.
        </p>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex h-10 items-center rounded-md bg-[#8a5a00] px-4 text-sm font-semibold text-white hover:bg-[#6f4800]"
      >
        Upgrade in Plan &amp; billing →
      </Link>
    </section>
  );
}

function TemplateCard({
  templateKey,
  selected,
  onSelect,
}: {
  templateKey: LandingTemplateKey;
  selected: boolean;
  onSelect: () => void;
}) {
  const template = LANDING_TEMPLATES[templateKey];
  return (
    <label
      className={`block cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition ${selected ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20" : "border-[var(--color-border)] hover:border-[#b8c4bf]"}`}
    >
      <input
        type="radio"
        name="landing-template"
        value={templateKey}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={template.previewImage}
        alt=""
        className="aspect-[4/3] w-full bg-[#eef1f4] object-cover object-top"
      />
      <span className="block p-3">
        <span className="block font-semibold">{template.name}</span>
        <span className="block text-xs font-medium text-[var(--color-accent)]">
          {template.tagline}
        </span>
        <span className="mt-1 block text-xs text-[var(--color-muted)]">
          {template.description}
        </span>
      </span>
    </label>
  );
}

/** Full-screen layers go straight into <body>, so no parent's position or transform can offset them. */
function BodyPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}

function CreateDialog({
  storeId,
  initialTemplate,
  onClose,
  onCreated,
}: {
  storeId: string;
  initialTemplate: LandingTemplateKey;
  onClose: () => void;
  onCreated: (page: LandingPageDetail) => void;
}) {
  const titleId = useId();
  const [template, setTemplate] = useState<LandingTemplateKey>(initialTemplate);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError("Give the page a name (at least 2 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ success: true; data: LandingPageDetail }>(
        `/stores/${storeId}/landing-pages`,
        { title: title.trim(), template },
      );
      onCreated(result.data);
    } catch (err) {
      setError(humanApiError(err, "Could not create the page."));
      setBusy(false);
    }
  }

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6"
        role="presentation"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onSubmit={(e) => void create(e)}
          className="w-full max-w-5xl rounded-2xl bg-[var(--color-bg)] p-4 shadow-xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-xl font-semibold">
                New landing page
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Pick a design. It starts with demo text and pictures you can
                change.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded-md px-2 text-xl text-[var(--color-muted)] hover:bg-[#f1f4f7]"
            >
              ×
            </button>
          </div>
          <fieldset className="mt-4">
            <legend className="sr-only">Design</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LANDING_TEMPLATE_LIST.map((t) => (
                <TemplateCard
                  key={t.key}
                  templateKey={t.key}
                  selected={template === t.key}
                  onSelect={() => setTemplate(t.key)}
                />
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="min-w-[240px] flex-1 space-y-1 text-sm">
              <span className="block font-medium">Page name</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Eid offer 2026"
                maxLength={120}
                autoFocus
              />
              <span className="block text-xs text-[var(--color-muted)]">
                For you; it also makes the page address. You can change both
                later.
              </span>
            </label>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Creating…"
                : `Create with ${LANDING_TEMPLATES[template].name}`}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </BodyPortal>
  );
}

/** A design full screen with its demo content, on desktop or phone width. */
function DesignPreview({
  storeSlug,
  templateKey,
  canUse,
  onUse,
  onClose,
}: {
  storeSlug: string;
  templateKey: LandingTemplateKey;
  canUse: boolean;
  onUse: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const template = LANDING_TEMPLATES[templateKey];
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <BodyPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[60] flex flex-col bg-[#eef1f4]"
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-white px-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-[#f1f4f7]"
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <span
            className="h-6 w-px bg-[var(--color-border)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold leading-tight"
            >
              {template.name}
            </h2>
            <p className="truncate text-xs text-[var(--color-muted)]">
              Preview with demo text, pictures and products
            </p>
          </div>
          <div
            className="mx-auto hidden rounded-md border border-[var(--color-border)] p-0.5 sm:flex"
            role="group"
            aria-label="Preview size"
          >
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`rounded px-3 py-1 text-xs font-semibold capitalize ${device === d ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-muted)]"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            {canUse ? <Button onClick={onUse}>Use this design</Button> : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
          <div
            className="relative mx-auto h-full overflow-hidden bg-white shadow-[0_2px_16px_rgba(15,23,42,0.12)] transition-[width] duration-300"
            style={{
              width: device === "mobile" ? "390px" : "100%",
              maxWidth: "100%",
              borderRadius: device === "mobile" ? 18 : 6,
            }}
          >
            <iframe
              src={landingDemoUrl(storeSlug, templateKey)}
              title={`${template.name} preview`}
              className="h-full w-full border-0"
              onLoad={() => setLoading(false)}
            />
            {loading ? (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white/70"
                aria-live="polite"
              >
                <span className="rounded-full bg-white px-4 py-2 text-sm text-[var(--color-muted)] shadow">
                  Loading preview…
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

/** The designs: look at each one, then start a page from it. */
function DesignGallery({
  canUse,
  lockedNote,
  onPreview,
  onUse,
}: {
  canUse: boolean;
  lockedNote: string | null;
  onPreview: (key: LandingTemplateKey) => void;
  onUse: (key: LandingTemplateKey) => void;
}) {
  return (
    <section aria-labelledby="landing-designs" className="space-y-3">
      <div>
        <h2 id="landing-designs" className="text-lg font-semibold">
          Designs
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Preview a design, then use it: pick your products, change the text and
          pictures, and publish.
        </p>
        {lockedNote ? (
          <p className="mt-1 text-sm text-[#8a5a00]">{lockedNote}</p>
        ) : null}
      </div>
      <ul
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
        aria-label="Designs"
      >
        {LANDING_TEMPLATE_LIST.map((template) => (
          <li
            key={template.key}
            className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <button
              type="button"
              onClick={() => onPreview(template.key)}
              className="group relative block"
              aria-label={`Preview ${template.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={template.previewImage}
                alt=""
                className="aspect-[4/3] w-full bg-[#eef1f4] object-cover object-top transition group-hover:opacity-90"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100"
              >
                Preview
              </span>
            </button>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <h3 className="font-semibold">{template.name}</h3>
              <p className="text-xs font-medium text-[var(--color-accent)]">
                {template.tagline}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                {template.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onPreview(template.key)}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  disabled={!canUse}
                  onClick={() => onUse(template.key)}
                >
                  Use this design
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LandingPagesContent() {
  const router = useRouter();
  const { selectedStoreId, selectedStore } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [pages, setPages] = useState<LandingPageSummary[] | null>(null);
  const [usage, setUsage] = useState<LandingPagesUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<LandingTemplateKey | null>(null);
  const [previewing, setPreviewing] = useState<LandingTemplateKey | null>(null);
  const [deleting, setDeleting] = useState<LandingPageSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: LandingPageSummary[]; usage: LandingPagesUsage };
      }>(`/stores/${selectedStoreId}/landing-pages`);
      setPages(result.data.items);
      setUsage(result.data.usage);
    } catch (err) {
      setError(humanApiError(err, "Could not load your landing pages."));
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage its landing pages."
      />
    );
  }

  const atLimit = !!usage && usage.max !== null && usage.used >= usage.max;
  const canCreate = canWrite && !!usage?.allowed && !atLimit;

  async function remove() {
    if (!deleting || !selectedStoreId) return;
    setBusy(true);
    try {
      await api.delete(
        `/stores/${selectedStoreId}/landing-pages/${deleting.id}`,
      );
      pushToast(`"${deleting.title}" deleted.`, "success");
      setDeleting(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, "Could not delete the page."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Landing pages
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            One-page offers for your ads, each with its own order form. Orders
            arrive in Orders like any other.
          </p>
        </div>
        {usage?.allowed ? (
          <span
            className="text-sm text-[var(--color-muted)]"
            data-testid="landing-usage"
          >
            {usage.max === null
              ? `${usage.used} ${usage.used === 1 ? "page" : "pages"} · unlimited on your plan`
              : `${usage.used} of ${usage.max} ${usage.max === 1 ? "page" : "pages"} used`}
          </span>
        ) : null}
        {usage?.allowed && canWrite ? (
          <Button
            onClick={() => setCreating("single_product")}
            disabled={!canCreate}
          >
            + New landing page
          </Button>
        ) : null}
      </div>

      {usage && !usage.allowed ? <LockedBanner /> : null}
      {atLimit && usage?.allowed ? (
        <p
          role="status"
          className="rounded-lg border border-[#f1d9a6] bg-[#fff8ea] px-4 py-3 text-sm"
        >
          You have used all {usage.max}{" "}
          {usage.max === 1 ? "landing page" : "landing pages"} on your plan. Delete one
          you no longer use, or{" "}
          <Link
            href="/dashboard/billing"
            className="font-semibold text-[#8a5a00] underline"
          >
            upgrade to Business
          </Link>{" "}
          for unlimited pages.
        </p>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!error && pages === null ? (
        <LoadingState label="Loading landing pages" />
      ) : null}

      {pages && pages.length === 0 && usage?.allowed ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted)]">
          No landing pages yet. Preview the designs below and use the one that
          fits your offer.
        </p>
      ) : null}

      {pages && pages.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => {
            const template = LANDING_TEMPLATES[page.template];
            const url = selectedStore
              ? landingPageUrl(selectedStore.slug, page.slug)
              : null;
            return (
              <li
                key={page.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.previewImage}
                  alt=""
                  className="aspect-[16/9] w-full bg-[#eef1f4] object-cover object-top"
                />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-semibold leading-snug">
                      {page.title}
                    </h2>
                    <Badge
                      tone={page.status === "PUBLISHED" ? "success" : "neutral"}
                    >
                      {page.status === "PUBLISHED" ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    {template.name} · {page.orderCount}{" "}
                    {page.orderCount === 1 ? "order" : "orders"}
                    {page.hasUnpublishedChanges ? " · unpublished changes" : ""}
                  </p>
                  {url ? (
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      /lp/{page.slug}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link
                      href={`/dashboard/landing-pages/${page.id}`}
                      className="inline-flex h-9 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {canWrite ? "Edit" : "Open"}
                    </Link>
                    {page.status === "PUBLISHED" && url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-sm font-medium hover:bg-[#f1f4f7]"
                      >
                        View ↗
                      </a>
                    ) : null}
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(page)}
                        className="ml-auto inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-[var(--color-danger)] hover:bg-[#fdecec]"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {usage && canWrite ? (
        <DesignGallery
          canUse={canCreate}
          lockedNote={
            !usage.allowed
              ? "Upgrade to Growth or Business to use these designs."
              : atLimit
                ? "You have used all landing pages on your plan."
                : null
          }
          onPreview={setPreviewing}
          onUse={(key) => setCreating(key)}
        />
      ) : null}

      {previewing && selectedStore ? (
        <DesignPreview
          key={previewing}
          storeSlug={selectedStore.slug}
          templateKey={previewing}
          canUse={canCreate}
          onClose={() => setPreviewing(null)}
          onUse={() => {
            setCreating(previewing);
            setPreviewing(null);
          }}
        />
      ) : null}

      {creating && selectedStoreId ? (
        <CreateDialog
          storeId={selectedStoreId}
          initialTemplate={creating}
          onClose={() => setCreating(null)}
          onCreated={(page) => {
            setCreating(null);
            router.push(`/dashboard/landing-pages/${page.id}`);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        danger
        safeDefault
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="The page and its link stop working. Orders placed from it stay in Orders."
        confirmLabel="Delete page"
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export default function LandingPagesPage() {
  return (
    <StoreScoped>
      <LandingPagesContent />
    </StoreScoped>
  );
}
