import { useEffect } from 'react';

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Wire keyboard shortcuts on `window`. Skips events that originate from
 * inputs/textareas/contenteditable so typing in forms is not intercepted.
 */
export function useKeyboardShortcuts(map: ShortcutMap, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const fn = map[k];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, active]);
}
