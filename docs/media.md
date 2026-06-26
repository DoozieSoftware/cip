# Media & Evidence (M5)

The Media namespace is the M5 evidence layer: citizens upload
photos / videos / documents when they file a report, those bytes
are scanned, hashed, and persisted, and every read/write is
recorded in an append-only chain-of-custody log.

The full wire contract is in `docs/05` §14 and the security
implications in `docs/11` §15. This file is the implementation
playbook for that contract.

## Endpoints

| Method | Path                                          | Audience            | Notes                                           |
| ------ | --------------------------------------------- | ------------------- | ----------------------------------------------- |
| POST   | `/api/v1/reports/{id}/photos`                 | Citizen (owner)     | Multipart, 1-10 photos, jpeg/png, <= 16 MB each |
| POST   | `/api/v1/reports/{id}/video`                  | Citizen (owner)     | Multipart, 1 video, mp4/quicktime, <= 100 MB    |
| GET    | `/api/v1/reports/{id}/media`                  | Citizen / Staff     | Lists media with 15-min signed URL              |
| GET    | `/api/v1/reports/{id}/media/{media}/audit`    | Staff               | Chain-of-custody log (VIEW/DOWNLOAD/...)        |
| GET    | `/api/v1/media/{media}/serve`                 | Public              | Streams the bytes; signed URL is the auth       |

The OpenAPI surface is committed to
`storage/api-docs/openapi.yaml` and verified by
`tests/Feature/OpenApiMediaTest.php` (4 contract tests).

## Per-type caps

| Type      | Max count | Max size  | Extra rules                          |
| --------- | --------- | --------- | ------------------------------------ |
| PHOTO     | 10        | 16 MB     | jpeg / png only                      |
| VIDEO     | 1         | 100 MB    | mp4 / quicktime, 3–300 s duration    |
| DOCUMENT  | 5         | 25 MB     | pdf only                             |

A second video on the same report returns `409 VIDEO_ALREADY_PRESENT`.
The 11th photo returns `422 VALIDATION_FAILED`. Both are documented
in the OpenAPI spec.

## Three-gate validation

Every upload passes three defence-in-depth gates in
`App\Modules\Media\Services\MimeValidator`:

1. **Server-detected mime** (`$file->getMimeType()` via `finfo`)
   must be in the allow-list for the expected bucket.
2. **Client-claimed mime** (`$file->getClientMimeType()`) must
   agree with the server-detected mime.
3. **Magic-byte signature sniff** reads the first 16 bytes and
   matches one of the known signatures for the bucket
   (`FF D8 FF` for JPEG, `89 50 4E 47…` for PNG, `66 74 79 70`
   at offset 4 for MP4 / QuickTime, `25 50 44 46` for PDF).

A failure in any gate returns `422 MEDIA_INVALID_MIME` (mime
gates 1 + 2) or `422 MEDIA_INVALID_SIGNATURE` (magic-bytes
gate 3). The bytes never reach storage.

## Hashes and fingerprints

`ComputeHashesJob` runs on the `media` queue and computes:

- `sha256` — primary 64-char digest, stored on `media.checksum`
  and `media_hashes.sha256` (unique per row).
- `sha512` — 128-char digest, optional, for jurisdictions that
  require SHA-2-512.
- `perceptual_hash` — 16-char hex pHash of the image, used for
  duplicate detection across reports. The M5 implementation
  uses a GD-based 8×8 grayscale + mean-threshold fallback
  (so it runs without `intervention/image`).
- `video_fingerprint` — sha1 of the first 32 KiB of the video
  bytes; cheap "fingerprint" for near-duplicate detection.

## Thumbnails

`GenerateThumbnailJob` runs on the `media` queue after a photo
upload. The M5 implementation uses the GD extension (no
`intervention/image` dependency) to produce a 320-px wide
JPEG and writes the relative path to
`media.metadata.thumbnails.320`.

## Video metadata

`ExtractVideoMetadataJob` runs on the `media` queue after a
video upload. It calls `ffprobe` (if present) to fill in
`duration`, `width`, and `height`. If ffprobe is missing
(dev / CI / single-node V1) the job falls back to the
client-supplied hints that were persisted onto
`media.metadata.upload.duration`, `width`, and `height` by
`MediaController::uploadVideo`.

## Chain of custody

Every read and write to a media row writes a row to
`media_access_logs` via
`App\Modules\Media\Services\ChainOfCustodyWriter`. The table
is append-only — it has no `updated_at` column and never
receives a DELETE in the application code.

| Event        | When                                           | Actor             |
| ------------ | ---------------------------------------------- | ----------------- |
| VIEW         | `GET /reports/{id}/media` returns the row      | Authenticated     |
| DOWNLOAD     | `GET /media/{media}/serve` streams the bytes   | Anonymous (URL)   |
| REPLACE      | Reserved — M6+ replacement flow                | Staff             |
| DELETE       | Reserved — M8 retention purge                  | System            |
| VIRUS_SCAN   | Reserved — when scanner integration lands      | System            |

The audit endpoint (`/reports/{id}/media/{media}/audit`) is
restricted to `moderator`, `department`, `super_admin`, and
`system` roles.

## Signed URLs

`App\Modules\Media\Support\MediaUrl` returns a 15-minute
time-limited URL for the `media.serve` route.

- The local disk (dev / tests) uses Laravel's
  `URL::temporarySignedRoute` — the URL is verified by the
  `signed` middleware and expires on its own.
- The S3 / MinIO disk (production) uses the adapter's
  `temporaryUrl` — the presigned URL is verified by the
  storage endpoint and never hits the app.

The signed URL is the only auth on the serve route; we never
expose the storage path to non-staff callers.

## Virus scanning

`App\Modules\Media\Services\VirusScanServiceInterface` is the
read-side contract; two implementations are provided:

- `LogScanner` — default. Records `virus_scan.allowed` /
  `virus_scan.rejected` log lines and returns true. This is
  the safe default in dev / CI where ClamAV is not running.
- `ClamAvScanner` — production. Talks to a ClamAV daemon over
  the `clamd` protocol. Flip via `CIP_MEDIA_SCANNER=clamav`.

Both write a row to `logs` and surface the scanner name on
the upload response's `errors.scanner` field on rejection.

## Storage layout

Bytes are written under:

```
evidence/{report-id}/{type}/{media-uuid}.{ext}
```

The `media-uuid` is unique per upload, so a replacement never
overwrites an existing asset. The path lives on
`media.storage_path` and the disk on `media.storage_disk`
(both columns are hidden from non-staff responses — only
super_admin with `?include_storage_path=1` sees them).

## Operational notes

- The MinIO bucket (`cip-media`) is initialised at first
  boot by `docker/minio/entrypoint.sh`. See M5 task T-M5-018.
- The per-user upload counter is
  `media_upload:{userId}:{YYYYMMDDHH}` (Cache), TTL = end of
  the hour. Caps: 100 MB per request, 100 MB per user-hour.
- All three media jobs run on the `media` queue (set via
  `$this->onQueue('media')` in each constructor), so Horizon
  / CloudWatch can carve out a dedicated worker pool.

## Security

- PII: media is not PII per se but it is sensitive
  (chain-of-custody §15). Never expose the storage path or
  disk to non-staff callers. The `MediaResource` already
  hides both fields.
- Auth: the citizen must own the report to upload / list;
  staff role gates are enforced by `MediaPolicy`.
- Rate limit: per-user 100 MB/hour, see
  `MediaUploadLimit` middleware.
- Virus scan: every upload is scanned; the scanner name is
  logged.
- Audit: every read / download is recorded.

See `docs/11` §15 for the full security analysis.
