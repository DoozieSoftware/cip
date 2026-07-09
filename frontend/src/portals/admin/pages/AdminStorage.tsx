import { useState, useEffect, type FormEvent, type JSX } from 'react';
import { useMediaStorage, useUpdateMediaStorage, useProbeMediaStorage, type MediaStorage } from '../api/client';
import { Spinner } from '../../moderator/design';

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
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Media storage</h1>
        <p className="mt-1 text-sm text-slate-600">
          Disk + bucket + retention for the media pipeline. The selected disk takes effect on the next upload.
        </p>
      </header>

      {storage.isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner label="Loading storage" /></div>
      ) : (
        <form onSubmit={handle} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Disk</span>
              <select
                value={disk}
                onChange={(e) => setDisk(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                {DISKS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Bucket</span>
              <input
                type="text"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Endpoint (MinIO/S3)</span>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://minio.example.in"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Region (S3)</span>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="ap-south-1"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Retention (days)</span>
              <input
                type="number"
                value={retentionDays}
                min={1}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={encryptionAtRest}
                onChange={(e) => setEncryptionAtRest(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="font-medium text-slate-700">Encryption at rest</span>
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Max photo size (MB)</span>
              <input
                type="number"
                value={maxPhotoMb}
                min={1}
                onChange={(e) => setMaxPhotoMb(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Max video size (MB)</span>
              <input
                type="number"
                value={maxVideoMb}
                min={1}
                onChange={(e) => setMaxVideoMb(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block font-medium text-slate-700">Max document size (MB)</span>
              <input
                type="number"
                value={maxDocumentMb}
                min={1}
                onChange={(e) => setMaxDocumentMb(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
          </div>

          {update.isSuccess ? (
            <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Storage configuration updated.</div>
          ) : null}
          {update.isError ? (
            <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">Update failed: {update.error?.message}</div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={probe.isPending}
              onClick={() => probe.mutate()}
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
            >
              {probe.isPending ? 'Probing…' : 'Probe reachability'}
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="rounded-md bg-fuchsia-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : 'Save storage config'}
            </button>
          </div>

          {probe.data ? (
            <div
              role="status"
              className={`rounded-md border px-3 py-2 text-sm ${probe.data.reachable ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}
            >
              {probe.data.reachable ? 'Reachable' : 'Unreachable'}: {probe.data.detail}
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
