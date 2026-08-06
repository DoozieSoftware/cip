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
  Input,
  Select,
  Spinner,
} from '../../moderator/design';

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">Media storage</h1>
          <p className="mt-1 text-sm text-[#6f6e69]">
            Disk + bucket + retention for the media pipeline. The selected disk takes effect on the
            next upload.
          </p>
        </div>
      </header>

      {storage.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading storage" />
        </div>
      ) : (
        <form onSubmit={handle}>
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDisk(e.target.value)}
                  options={DISKS.map((d) => ({ value: d, label: d }))}
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Bucket"
                  name="bucket"
                  value={bucket}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBucket(e.target.value)}
                  placeholder="cip-media"
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Endpoint (MinIO/S3)"
                  name="endpoint"
                  type="url"
                  value={endpoint}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEndpoint(e.target.value)}
                  placeholder="https://minio.example.in"
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Region (S3)"
                  name="region"
                  value={region}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRegion(e.target.value)}
                  placeholder="ap-south-1"
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Retention (days)"
                  name="retention_days"
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Max photo size (MB)"
                  name="max_photo_mb"
                  type="number"
                  min={1}
                  value={maxPhotoMb}
                  onChange={(e) => setMaxPhotoMb(Number(e.target.value))}
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Max video size (MB)"
                  name="max_video_mb"
                  type="number"
                  min={1}
                  value={maxVideoMb}
                  onChange={(e) => setMaxVideoMb(Number(e.target.value))}
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <Input
                  label="Max document size (MB)"
                  name="max_document_mb"
                  type="number"
                  min={1}
                  value={maxDocumentMb}
                  onChange={(e) => setMaxDocumentMb(Number(e.target.value))}
                  className="rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
                <label className="flex items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={encryptionAtRest}
                    onChange={(e) => setEncryptionAtRest(e.target.checked)}
                    className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
                  />
                  <span className="text-sm text-[#1d1d1b]">Encryption at rest</span>
                </label>
              </div>
            </CardBody>
          </Card>

          {update.isSuccess ? (
            <div
              role="status"
              className="rounded-xl border border-[#d0cec8] bg-[#edf7f0] px-4 py-3 text-sm text-[#256b45]"
            >
              Storage configuration updated.
            </div>
          ) : null}
          {update.isError ? (
            <div
              role="alert"
              className="rounded-xl border border-[#d0cec8] bg-[#fbeeed] px-4 py-3 text-sm text-[#9f3731]"
            >
              Update failed: {update.error?.message}
            </div>
          ) : null}

          {probe.data ? (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm ${
                probe.data.reachable
                  ? 'border-[#d0cec8] bg-[#edf7f0] text-[#256b45]'
                  : 'border-[#d0cec8] bg-[#fbeeed] text-[#9f3731]'
              }`}
            >
              {probe.data.reachable ? 'Reachable' : 'Unreachable'}: {probe.data.detail}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
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
