# Media Module

## Purpose

Handles evidence file uploads (photos, videos, documents), virus scanning, thumbnail generation, hash computation, and signed URL serving. Media metadata is stored in the database; bytes live on the configured Laravel disk (MinIO/S3/local).

Uploads are durable before scanning. Every accepted file is first written to a
unique `quarantine/{report}/{type}/{uuid}` object, hashed, and represented by a
`media` plus `media_quarantines` row. Only a `CLEAN` scanner verdict releases a
digest-verified copy into `evidence/` or `proof/`; pending, unknown, infected,
or integrity-failed assets are excluded from report manifests, AI, previews,
counts, and signed delivery.

## Key Classes

| Class | Role |
|-------|------|
| `MediaService` | Orchestrates upload, validation, storage |
| `MediaStorageService` | Disk abstraction and signed URL generation |
| `HashService` | SHA256/MD5/perceptual hash computation |
| `ThumbnailService` | Image and video thumbnail generation |
| `MimeValidator` | MIME type verification |
| `ClamAvScanner` | Virus scanning via ClamAV |
| `NullScanner` | No-op scanner for environments without ClamAV |
| `MediaQuarantineService` | Durable staging, scan verdicts, digest-verified release, and recovery |
| `MediaQuarantineRepository` | Atomic recovery claims and bounded recovery batches |
| `ChainOfCustodyWriter` | Immutable custody log entries |
| `MediaController` | Upload and serve endpoints |
| `MediaUploadLimit` | Middleware enforcing upload size/count limits |

## Models

- `Media` — metadata (disk, path, mime, size, checksum, captured_at)
- `MediaHash` — content hashes for deduplication
- `MediaAccessLog` — audit trail of media access
- `MediaQuarantine` — scanner failure/infection custody and recovery state

## Jobs

- `GenerateThumbnailJob` — async thumbnail creation
- `ComputeHashesJob` — async hash computation
- `ExtractVideoMetadataJob` — async video metadata extraction
- `RecoverQuarantinedMediaJob` — unique queued re-scan and safe release

## Scanner recovery

Infrastructure failures return `503 MEDIA_SCAN_UNAVAILABLE` with the retained
`media_id`; an infected verdict returns `422 MEDIA_INFECTED`. In both cases the
bytes remain isolated and a `VIRUS_SCAN` chain-of-custody entry records the
verdict. The scheduler dispatches eligible recovery work every ten minutes:

```bash
php artisan media:recover-quarantine
php artisan media:recover-quarantine --media-id=<uuid> --sync
```

Recovery verifies the stored SHA-256 before and after release. A mismatch moves
the record to terminal `INTEGRITY_FAILED` for manual incident handling; it is
never retried or delivered automatically. `RESCANNING` records whose worker died
are reclaimable after `CIP_MEDIA_RESCAN_STALE_SECONDS` (default 900 seconds).
Use `CIP_MEDIA_RECOVERY_BATCH_SIZE` to bound each scheduled dispatch (default
100). Production still requires a healthy ClamAV service and current signatures;
the recovery mechanism does not replace readiness/deploy probes.

## Dependencies

- `Reports` (Report model, media belongs to reports)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| POST | `/api/v1/reports/{id}/photos` | `api.v1.reports.photos.store` |
| POST | `/api/v1/reports/{id}/video` | `api.v1.reports.video.store` |
| GET | `/api/v1/reports/{id}/media` | `api.v1.reports.media.index` |
| GET | `/api/v1/media/{media}/serve` | `api.v1.media.serve` |
| GET | `/api/v1/reports/{id}/media/{media}/audit` | `api.v1.reports.media.audit` |
| GET | `/api/v1/admin/media/storage` | `api.v1.admin.media.storage.show` |
| PUT | `/api/v1/admin/media/storage` | `api.v1.admin.media.storage.update` |
| POST | `/api/v1/admin/media/storage/probe` | `api.v1.admin.media.storage.probe` |
