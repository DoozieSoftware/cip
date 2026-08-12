export type Locale = 'en-IN' | 'kn-IN';

export const DEFAULT_LOCALE: Locale = 'en-IN';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en-IN', 'kn-IN'] as const;

export interface MessageCatalog {
  readonly [key: string]: string;
}

export interface Messages {
  readonly en_IN: MessageCatalog;
  readonly kn_IN: MessageCatalog;
}
