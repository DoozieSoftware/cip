import { useState, type JSX } from 'react';
import { Dialog } from '../../../shared/ui';
import type { DepartmentReportMedia } from '../types';

/**
 * Media rows come from the M11 detail endpoint. Bytes live in object
 * storage; `url` is a short-lived signed URL that must be used
 * directly (no re-signing, no copy to local state).
 */

const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
};

export function isImageMedia(item: DepartmentReportMedia): boolean {
  return item.type === 'image' || item.mime.startsWith('image/');
}

function dateCaption(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function FileIcon({ type }: { type: string }): JSX.Element {
  if (type === 'video') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M17 10l4-2v8l-4-2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === 'audio') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 18V6l10-2v11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16.5" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Grid of media rows for one role (citizen evidence or officer proof).
 * Images open an in-app full-size preview (matching the moderator
 * portal's evidence viewer) rather than a bare new browser tab, which
 * loses the officer's place in the report and shows no caption or
 * context; video/audio/document rows still open via link since there
 * is no in-app preview for those. `label` names the role for captions
 * and aria purposes. `onRemove`, when given, adds a remove button to
 * every item (soft-removes a wrongly-uploaded proof photo; omit it
 * for citizen evidence, which an officer should never be able to
 * touch).
 */
export function MediaGallery({
  items,
  label,
  onRemove,
}: {
  items: DepartmentReportMedia[];
  label: string;
  onRemove?: (mediaId: string) => void;
}) {
  const [selected, setSelected] = useState<DepartmentReportMedia | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={label}>
        {items.map((item, index) => {
          const caption = dateCaption(item.created_at);
          return (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              {onRemove && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(item.id);
                  }}
                  aria-label={`Remove ${label} item ${index + 1}`}
                  className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
              {isImageMedia(item) ? (
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  aria-label={`View ${label} image ${index + 1} full size`}
                  className="group relative block w-full cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-inset"
                >
                  <img
                    src={item.url}
                    alt={`${label} ${index + 1}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-ink)]/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                    View
                  </span>
                </button>
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${label} ${item.type} (${item.mime}) in a new tab`}
                  className="flex items-center gap-3 p-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="shrink-0 text-slate-400">
                    <FileIcon type={item.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span className="block truncate font-mono text-xs text-slate-500">
                      {item.mime}
                    </span>
                  </span>
                  <span aria-hidden className="text-xs text-slate-400">
                    ↗
                  </span>
                </a>
              )}
              {caption && (
                <p className="border-t border-slate-100 px-2 py-1 text-xs text-slate-500">
                  {caption}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`${label} preview`}
        size="xl"
      >
        {selected && (
          <figure>
            <img
              src={selected.url}
              alt={`${label} full-size preview`}
              className="max-h-[80vh] w-full bg-[var(--color-ink)] object-contain"
            />
            <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span>{selected.mime}</span>
              {selected.width && selected.height && (
                <span>
                  {selected.width}×{selected.height}
                </span>
              )}
            </figcaption>
          </figure>
        )}
      </Dialog>
    </>
  );
}
