'use client';

import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { PublicStoreTheme, StoreThemeConfig } from '@ecomesta/types';
import { themeCssVariables } from '@/lib/theme';

const ThemeContext = createContext<StoreThemeConfig>({});
const ThemeSlugContext = createContext<string | null>(null);

export function useStoreThemeConfig(): StoreThemeConfig {
  return useContext(ThemeContext);
}

/** The store's theme (e.g. `kenakata`), for pages that render per theme; null without one. */
export function useStoreThemeSlug(): string | null {
  return useContext(ThemeSlugContext);
}

/**
 * Publishes the store's theme configuration as CSS custom properties. Values
 * are validated by the API on write and re-checked here, and the element uses
 * `display: contents` so it never affects storefront layout.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: PublicStoreTheme | null;
  children: ReactNode;
}) {
  const config = useMemo(() => theme?.configuration ?? {}, [theme]);
  const style = useMemo(
    () =>
      ({
        ...themeCssVariables(config),
        fontSize: 'var(--theme-base-font-size, 16px)',
      }) as CSSProperties,
    [config],
  );

  return (
    <ThemeSlugContext.Provider value={theme?.theme?.slug ?? null}>
    <ThemeContext.Provider value={config}>
      <div
        className="contents"
        data-testid="storefront-theme"
        data-theme={theme?.theme?.slug ?? 'default'}
        style={style}
      >
        {children}
      </div>
    </ThemeContext.Provider>
    </ThemeSlugContext.Provider>
  );
}
