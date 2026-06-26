# M5 Media — composer.json dependency decisions

Per `.codex/task_queue.md` T-M5-026: "Pin media package
versions." This file records the decisions and the
rejection-of-alternatives for future maintainers.

## Accepted as direct deps

| Package                       | Version | Role                                       |
| ----------------------------- | ------- | ------------------------------------------ |
| `league/flysystem-aws-s3-v3`  | `^3.0`  | S3 / MinIO storage adapter (already in the require block from M1; the M5 production disk is `s3` / MinIO). |

## Considered, deliberately NOT added

| Package                            | Why we did not add it |
| ---------------------------------- | --------------------- |
| `intervention/image`               | The M5 pHash + 320-px thumbnail pipeline uses the GD extension directly (already shipped with PHP 8.4 in the docker image). Adding `intervention/image` would have added a non-trivial surface (lifecycle, Imagick fallback, configuration) for two operations we can do in ~80 lines of GD. Revisit if a future M-series module needs exif / orientation / smart resize. |
| `jenssegers/imagehash`             | Same reason: the perceptual-hash and thumbnail code lives in `App\Modules\Media\Services\ThumbnailService` / `HashService` and uses GD. The pHash is a documented fallback (`docs/media.md` §"Hashes and fingerprints"). |
| `php-ffmpeg/php-ffmpeg`           | We do not invoke `ffmpeg` from PHP. The video post-processing job (`ExtractVideoMetadataJob`) shells out to the system `ffprobe` binary if present, and falls back to client-supplied hints when missing. Adding `php-ffmpeg` would have required an `ffmpeg` binary in the PHP container regardless. |
| `league/flysystem-aws-s3-v3:^3.29` (hard pin) | `^3.0` is the current major; the `3.x` line is what MinIO production deployments use. CI runs `composer outdated` clean. |

## Verification

```bash
cd backend
composer install --no-interaction      # 93 packages, no warnings
composer outdated --direct            # nothing past minor
```

The result is a small M5 footprint: 1 new table, 3 jobs, 1
controller, 2 services, 1 middleware, 0 new PHP packages
beyond what M1 already shipped.

## Notes for production

- The MinIO production image (`minio/minio:RELEASE.2024-09-13T20-26-02Z`)
  is initialised at first boot by `docker/minio/entrypoint.sh`
  (T-M5-018).
- Set `CIP_MEDIA_DISK=s3` and `FILESYSTEM_DISK=s3` in the
  Laravel container so `Storage::disk($media->storage_disk)`
  resolves to the S3 / MinIO adapter for the runtime
  presigned-URL backend. Dev / CI use `local`.
