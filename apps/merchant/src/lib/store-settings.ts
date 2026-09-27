'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  StoreSettings,
  StoreSettingsSummary,
  UpdateStoreSettingsInput,
} from '@ecomesta/types';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

export const SEO_TITLE_RANGE = { min: 10, max: 70 } as const;
export const SEO_DESCRIPTION_RANGE = { min: 50, max: 160 } as const;
export const SETTINGS_LIMITS = {
  name: 120,
  description: 1000,
  email: 255,
  phone: 40,
  address: 500,
  seoTitle: 120,
  seoDescription: 320,
  seoKeywords: 20,
  seoKeyword: 60,
  ogTitle: 120,
  ogDescription: 320,
  ogImageUrl: 2048,
} as const;

export function lengthWarning(
  value: string,
  range: { min: number; max: number },
  noun: string,
): string | null {
  const length = value.trim().length;
  if (length === 0) return null;
  if (length < range.min) {
    return `Short ${noun}: search engines work best with ${range.min}–${range.max} characters.`;
  }
  if (length > range.max) {
    return `Long ${noun}: search engines usually cut off text after about ${range.max} characters.`;
  }
  return null;
}

export function parseKeywordList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const keyword = part.trim();
    if (!keyword || seen.has(keyword.toLowerCase())) continue;
    seen.add(keyword.toLowerCase());
    out.push(keyword);
  }
  return out;
}

export function settingsErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'You do not have permission to change these settings.';
    const details = err.details;
    if (Array.isArray(details) && details.length) {
      return details.map(String).join(' ');
    }
    return err.message || fallback;
  }
  return fallback;
}

/** Loads `/stores/:id/settings` and saves partial updates with optimistic concurrency. */
export function useStoreSettings() {
  const { selectedStoreId } = useStoreContext();
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: StoreSettings }>(
        `/stores/${selectedStoreId}/settings`,
      );
      setSettings(result.data);
    } catch (err) {
      setError(settingsErrorMessage(err, 'Failed to load store settings'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: UpdateStoreSettingsInput, successMessage = 'Settings saved') => {
      if (!selectedStoreId || !settings) return false;
      setSaving(true);
      setSaveError(null);
      try {
        const result = await api.patch<{ success: true; data: StoreSettings }>(
          `/stores/${selectedStoreId}/settings`,
          { ...patch, expectedUpdatedAt: settings.updatedAt },
        );
        setSettings(result.data);
        pushToast(successMessage, 'success');
        return true;
      } catch (err) {
        const message = settingsErrorMessage(err, 'Could not save settings');
        setSaveError(message);
        pushToast(message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedStoreId, settings, pushToast],
  );

  return {
    storeId: selectedStoreId,
    settings,
    loading,
    error,
    saving,
    saveError,
    canEdit: Boolean(settings?.permissions.canEdit),
    reload: load,
    save,
  };
}

type EditableKey = Exclude<keyof UpdateStoreSettingsInput, 'expectedUpdatedAt'>;

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

/** Local draft of selected settings fields; `changes` holds only modified keys. */
export function useSettingsDraft<K extends EditableKey>(
  settings: StoreSettings | null,
  keys: readonly K[],
) {
  const keyList = keys.join('|');
  const pick = useCallback(
    (source: StoreSettings | null) => {
      const out = {} as Pick<StoreSettings, K>;
      if (!source) return out;
      for (const key of keyList.split('|') as K[]) out[key] = source[key];
      return out;
    },
    [keyList],
  );

  const [draft, setDraft] = useState<Pick<StoreSettings, K>>(() => pick(settings));

  useEffect(() => {
    setDraft(pick(settings));
  }, [settings, pick]);

  const setField = useCallback(<F extends K>(key: F, value: StoreSettings[F]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const changes: UpdateStoreSettingsInput = {};
  if (settings) {
    for (const key of keyList.split('|') as K[]) {
      if (normalize(draft[key]) !== normalize(settings[key])) {
        (changes as Record<string, unknown>)[key] = draft[key];
      }
    }
  }

  return {
    draft,
    setField,
    changes,
    dirty: Object.keys(changes).length > 0,
    reset: () => setDraft(pick(settings)),
  };
}

export function useStoreSettingsSummary() {
  const { selectedStoreId } = useStoreContext();
  const [summary, setSummary] = useState<StoreSettingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: StoreSettingsSummary }>(
        `/stores/${selectedStoreId}/settings/summary`,
      );
      setSummary(result.data);
    } catch (err) {
      setError(settingsErrorMessage(err, 'Failed to load settings summary'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}
