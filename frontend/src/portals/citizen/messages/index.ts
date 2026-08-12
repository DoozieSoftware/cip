import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { en_IN } from './en-IN';
import { kn_IN } from './kn-IN';
import { DEFAULT_LOCALE, type Locale, type Messages, type MessageCatalog } from './types';

export type { Locale, MessageCatalog } from './types';
export { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types';

const catalogs: Messages = {
  en_IN,
  kn_IN,
};

export type MessageKey = keyof typeof en_IN;

export type MessageParams = Record<string, string | number>;

export interface TranslationResult {
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  readonly locale: Locale;
  readonly setLocale: (next: Locale) => void;
  readonly locales: readonly Locale[];
}

export const LOCALE_STORAGE_KEY = 'cip.citizen.locale';
const listeners = new Set<() => void>();
let activeLocale: Locale | undefined;

function readInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) ?? localStorage.getItem('cip.locale');
    if (stored === 'en-IN' || stored === 'kn-IN') return stored;
  }
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.language === 'string' &&
    navigator.language.toLowerCase().startsWith('kn')
  ) {
    return 'kn-IN';
  }
  return DEFAULT_LOCALE;
}

function getLocaleSnapshot(): Locale {
  activeLocale ??= readInitialLocale();
  return activeLocale;
}

function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(next: Locale): void {
  activeLocale = next;
  if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

function resolveCatalog(locale: Locale): MessageCatalog {
  return catalogs[`${locale.replace('-', '_')}` as keyof Messages] ?? catalogs.en_IN;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function useMessages(): TranslationResult {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => DEFAULT_LOCALE);
  const setActiveLocale = useCallback(setLocale, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const t = useCallback(
    (key: MessageKey, params?: MessageParams) =>
      interpolate(resolveCatalog(locale)[key] ?? String(key), params),
    [locale],
  );
  return { t, locale, setLocale: setActiveLocale, locales: ['en-IN', 'kn-IN'] as const };
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return interpolate(resolveCatalog(locale)[key] ?? String(key), params);
}

export function getCatalog(locale: Locale): MessageCatalog {
  return resolveCatalog(locale);
}
