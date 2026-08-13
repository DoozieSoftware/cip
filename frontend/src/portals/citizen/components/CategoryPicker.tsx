import { useMemo, useState, type JSX } from 'react';
import { IconSearch, IconCheck } from '@tabler/icons-react';
import type { ReportType } from '../types';
import { cx } from '../../../shared/ui';
import { IssueIcon } from './issueIcons';
import { useMessages, type Locale } from '../messages';

function localizedLabel(t: ReportType, locale: Locale): string {
  return t.localizations?.[locale] ?? t.name;
}

function matches(t: ReportType, locale: Locale, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === '') return true;
  const label = localizedLabel(t, locale);
  if (label.toLowerCase().includes(needle)) return true;
  if (t.name.toLowerCase().includes(needle)) return true;
  if (t.code.toLowerCase().includes(needle)) return true;
  return t.aliases?.some((a) => a.toLowerCase().includes(needle)) ?? false;
}

function rankTypes(types: ReportType[]): ReportType[] {
  return [...types].sort((a, b) => {
    const aOther = a.code === 'other' ? 1 : 0;
    const bOther = b.code === 'other' ? 1 : 0;
    if (aOther !== bOther) return aOther - bOther;
    const pa = a.sort_order ?? 0;
    const pb = b.sort_order ?? 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export interface CategoryPickerProps {
  types: ReportType[];
  selectedId: string;
  onSelect: (id: string) => void;
  error?: string | null;
}

export function CategoryPicker({
  types,
  selectedId,
  onSelect,
  error,
}: CategoryPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const { t: message, locale } = useMessages();
  const legacyLocale =
    typeof localStorage !== 'undefined' ? localStorage.getItem('cip.locale') : null;
  const categoryLocale: Locale =
    legacyLocale === 'en-IN' || legacyLocale === 'kn-IN' ? legacyLocale : locale;

  const ranked = useMemo(() => rankTypes(types), [types]);
  const filtered = useMemo(
    () => ranked.filter((t) => matches(t, categoryLocale, query)),
    [ranked, categoryLocale, query],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          stroke={1.6}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={message('category.searchPlaceholder')}
          aria-label={message('category.searchLabel')}
          className="block w-full rounded-lg border border-[#d8d6cf] bg-[#faf9f6] py-3.5 pl-10 pr-4 text-base placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {message('category.noMatches')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white divide-y divide-[var(--color-border-subtle)]">
          {filtered.map((t) => {
            const label = localizedLabel(t, categoryLocale);
            const isOther = t.code === 'other';
            return (
              <label
                key={t.id}
                className={cx(
                  'flex cursor-pointer items-center gap-4 p-4 transition',
                  selectedId === t.id ? 'bg-[var(--color-surface-alt)]' : 'hover:bg-[#faf9f6]',
                  error && !selectedId ? 'bg-red-50' : '',
                )}
              >
                <input
                  type="radio"
                  name="report-category"
                  value={t.id}
                  checked={selectedId === t.id}
                  onChange={() => onSelect(t.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cx(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                    selectedId === t.id
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]',
                  )}
                  style={{ color: selectedId === t.id ? 'white' : (t.color ?? '#334155') }}
                >
                  <IssueIcon code={t.code} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="block text-sm font-medium text-[var(--color-ink)]">
                      {label}
                    </span>
                    {categoryLocale !== 'en-IN' && t.localizations?.[categoryLocale] ? (
                      <span className="text-xs text-[var(--color-text-tertiary)]">({t.name})</span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    {t.requires_photo
                      ? message('category.evidenceRequired')
                      : message('category.evidenceOptional')}
                    {t.requires_video ? ` · ${message('category.videoRequired')}` : ''}
                    {isOther ? ` · ${message('category.manualRouting')}` : ''}
                  </span>
                </span>
                {selectedId === t.id && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)]">
                    <IconCheck className="h-3.5 w-3.5 text-white" stroke={1.8} />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
