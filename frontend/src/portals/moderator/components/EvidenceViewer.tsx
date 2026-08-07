import { useState } from 'react';
import { IconMaximize } from '@tabler/icons-react';
import type { MediaItem } from '../types';
import { Card, CardHeader, CardTitle, CardBody, Badge, Dialog, EmptyState } from '../../../shared/ui';

export function EvidenceViewer({ media }: { media: MediaItem[] }) {
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);

  if (media.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            title="No evidence attached"
            description="The citizen did not upload photos or video with this report."
          />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence</CardTitle>
        <Badge tone="neutral">
          {media.length} item{media.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardBody>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {media.map((m, index) => (
            <li key={m.id} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
              {m.mime_type.startsWith('image/') ? (
                <button
                  type="button"
                  onClick={() => setSelectedImage(m)}
                  aria-label={`View evidence image ${index + 1} full size`}
                  className="group relative block w-full cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-inset"
                >
                  <img
                    src={m.url}
                    alt={
                      m.captured_at ? `Captured ${m.captured_at}` : `Report evidence ${index + 1}`
                    }
                    className="h-48 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#1d1d1b]/90 px-3 text-xs font-medium text-white">
                    <IconMaximize className="h-4 w-4" stroke={1.7} />
                    View
                  </span>
                </button>
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
                {m.width && m.height && (
                  <span>
                    {m.width}×{m.height}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
      <Dialog
        open={selectedImage !== null}
        onClose={() => setSelectedImage(null)}
        title="Evidence preview"
        size="xl"
      >
        {selectedImage && (
          <figure>
            <img
              src={selectedImage.url}
              alt={
                selectedImage.captured_at
                  ? `Captured ${selectedImage.captured_at}`
                  : 'Report evidence full-size preview'
              }
              className="max-h-[80vh] w-full bg-[#1d1d1b] object-contain"
            />
            <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6f6e69]">
              <span>{selectedImage.mime_type}</span>
              {selectedImage.width && selectedImage.height && (
                <span>
                  {selectedImage.width}×{selectedImage.height}
                </span>
              )}
            </figcaption>
          </figure>
        )}
      </Dialog>
    </Card>
  );
}
