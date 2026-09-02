import { useState, useEffect, type FormEvent, type JSX } from 'react';
import {
  useMediaStorage,
  useUpdateMediaStorage,
  useProbeMediaStorage,
  type MediaStorage,
} from '../api/client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Select,
  Spinner,
} from '../../../shared/ui';

const DISKS = ['media_local', 'media_minio', 'media_s3'];

const MB = 1_000_000;

export default function AdminStorage(): JSX.Element {
  const storage = useMediaStorage();
  const update = useUpdateMediaStorage();
  const probe = useProbeMediaStorage();

  const initial = storage.data;

  const [disk, setDisk] = useState('media_local');
  const [bucket, setBucket] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('');
  const [retentionDays, setRetentionDays] = useState(90);
  const [encryptionAtRest, setEncryptionAtRest] = useState(false);
  const [maxPhotoMb, setMaxPhotoMb] = useState(20);
  const [maxVideoMb, setMaxVideoMb] = useState(200);
  const [maxDocumentMb, setMaxDocumentMb] = useState(50);

  useEffect(() => {
    if (initial) {
      setDisk(initial.disk ?? 'media_local');
      setBucket(initial.bucket ?? '');
      setEndpoint(initial.endpoint ?? '');
      setRegion(initial.region ?? '');
      setRetentionDays(initial.retention_days ?? 90);
      setEncryptionAtRest(Boolean(initial.encryption_at_rest));
      setMaxPhotoMb(Math.round((initial.max_photo_bytes ?? 0) / MB) || 20);
      setMaxVideoMb(Math.round((initial.max_video_bytes ?? 0) / MB) || 200);
      setMaxDocumentMb(Math.round((initial.max_document_bytes ?? 0) / MB) || 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.data?.id, storage.data?.updated_at]);

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    const payload: MediaStorage = {
      id: initial?.id ?? 'media_storage',
      key: initial?.key ?? 'media_storage',
      disk,
      region: region || null,
      bucket: bucket || null,
      endpoint: endpoint || null,
      retention_days: Number(retentionDays),
      encryption_at_rest: encryptionAtRest,
      max_photo_bytes: Number(maxPhotoMb) * MB,
      max_video_bytes: Number(maxVideoMb) * MB,
      max_document_bytes: Number(maxDocumentMb) * MB,
    };
    update.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            System / Storage
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Media storage
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Disk + bucket + retention for the media pipeline. The selected disk takes effect on the
            next upload.
          </p>
        </div>
      </header>

      {storage.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading storage" />
        </div>
      ) : storage.isError ? (
        <ErrorState
          title="Failed to load storage"
          description="Storage configuration could not be loaded."
          action={
            <Button variant="secondary" size="sm" onClick={() => void storage.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <form onSubmit={handle} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage configuration</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Disk"
                  name="disk"
                  value={disk}
                  onChange={(e) => setDisk(e.target.value)}
                  options={DISKS.map((d) => ({ value: d, label: d }))}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Bucket"
                  name="bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="cip-media"
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Endpoint (MinIO/S3)"
                  name="endpoint"
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://minio.example.in"
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Region (S3)"
                  name="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="ap-south-1"
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Retention (days)"
                  name="retention_days"
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Max photo size (MB)"
                  name="max_photo_mb"
                  type="number"
                  min={1}
                  value={maxPhotoMb}
                  onChange={(e) => setMaxPhotoMb(Number(e.target.value))}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Max video size (MB)"
                  name="max_video_mb"
                  type="number"
                  min={1}
                  value={maxVideoMb}
                  onChange={(e) => setMaxVideoMb(Number(e.target.value))}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <Input
                  label="Max document size (MB)"
                  name="max_document_mb"
                  type="number"
                  min={1}
                  value={maxDocumentMb}
                  onChange={(e) => setMaxDocumentMb(Number(e.target.value))}
                  className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
                />
                <label className="flex items-center gap-4 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={encryptionAtRest}
                    onChange={(e) => setEncryptionAtRest(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
                  />
                  <span className="text-sm text-[var(--color-ink)]">Encryption at rest</span>
                </label>
              </div>
            </CardBody>
          </Card>

          {update.isSuccess ? (
            <div
              role="status"
              className="rounded-xl border border-[var(--color-success-muted)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]"
            >
              Storage configuration updated.
            </div>
          ) : null}
          {update.isError ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--color-danger-muted)] bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]"
            >
              Update failed: {update.error?.message}
            </div>
          ) : null}

          {probe.data ? (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm ${
                probe.data.reachable
                  ? 'border-[var(--color-success-muted)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'border-[var(--color-danger-muted)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
              }`}
            >
              {probe.data.reachable ? 'Reachable' : 'Unreachable'}: {probe.data.detail}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="secondary"
              type="button"
              disabled={probe.isPending}
              onClick={() => probe.mutate()}
            >
              {probe.isPending ? 'Probing…' : 'Probe reachability'}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={update.isPending}
              loading={update.isPending}
            >
              Save storage config
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
