import { useCallback, useRef } from 'react';

/**
 * Serialises overlapping list fetches so a slower older response cannot
 * overwrite newer filter results, and callers can clear stale rows on start.
 */
export function useListRequest() {
  const seq = useRef(0);

  const begin = useCallback(() => {
    const id = ++seq.current;
    return {
      id,
      isCurrent: () => seq.current === id,
    };
  }, []);

  return { begin };
}
