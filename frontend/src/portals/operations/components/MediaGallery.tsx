import type { JSX } from 'react';
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
 * Images render as thumbnails (click opens the signed URL in a new
 * tab); video/audio/document rows render an icon, mime label and an
 * "open" link. `label` names the role for captions and aria purposes.
 */
export function MediaGallery({ items, label }: { items: DepartmentReportMedia[]; label: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={label}>
      {items.map((item, index) => {
        const caption = dateCaption(item.created_at);
        return (
          <li key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {isImageMedia(item) ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${label} image in a new tab`}
                className="block"
              >
                <img
                  src={item.url}
                  alt={`${label} ${index + 1}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </a>
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
  );
}
