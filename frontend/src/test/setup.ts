import '@testing-library/jest-dom/vitest';

// jsdom's localStorage is sometimes provided as an empty object; add
// an in-memory polyfill so production code paths (e.g. the PWA
// install-prompt's dismissal timestamp) can call setItem/getItem
// without falling back to a try/catch.
if (typeof window !== 'undefined' && (!window.localStorage || typeof window.localStorage.setItem !== 'function')) {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string): string | null => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
    get length(): number {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
}
