import type { MediaItem } from '../types';
import { Card, CardHeader, CardTitle, CardBody, Badge, EmptyState } from '../design';

export function EvidenceViewer({ media }: { media: MediaItem[] }) {
  if (media.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState title="No evidence attached" description="The citizen did not upload photos or video with this report." />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence</CardTitle>
        <Badge tone="neutral">{media.length} item{media.length === 1 ? '' : 's'}</Badge>
      </CardHeader>
      <CardBody>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {media.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
              {m.mime_type.startsWith('image/') ? (
                <img
                  src={m.url}
                  alt={m.captured_at ? `Captured ${m.captured_at}` : 'Report evidence'}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              ) : m.mime_type.startsWith('video/') ? (
                <video controls className="h-48 w-full bg-black object-contain" preload="metadata">
                  <source src={m.url} type={m.mime_type} />
                  <track kind="captions" srcLang="en" label="No captions available" />
                  Your browser does not support embedded video.
                </video>
              ) : (
                <div className="flex h-48 items-center justify-center bg-slate-100 text-sm text-slate-500">
                  {m.mime_type}
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
                <span>{m.mime_type}</span>
                {m.width && m.height && <span>{m.width}×{m.height}</span>}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
