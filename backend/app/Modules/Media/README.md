# Media Module

## Purpose

Handles evidence file uploads (photos, videos, documents), virus scanning, thumbnail generation, hash computation, and signed URL serving. Media metadata is stored in the database; bytes live on the configured Laravel disk (MinIO/S3/local).

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
| `ChainOfCustodyWriter` | Immutable custody log entries |
| `MediaController` | Upload and serve endpoints |
| `MediaUploadLimit` | Middleware enforcing upload size/count limits |

## Models

- `Media` — metadata (disk, path, mime, size, checksum, captured_at)
- `MediaHash` — content hashes for deduplication
- `MediaAccessLog` — audit trail of media access

## Jobs

- `GenerateThumbnailJob` — async thumbnail creation
- `ComputeHashesJob` — async hash computation
- `ExtractVideoMetadataJob` — async video metadata extraction

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
