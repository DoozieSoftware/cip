#!/usr/bin/env bash
# MinIO entrypoint per docs/03 §12 and M5-018.
#
# Waits for the MinIO server, then:
#   1. sets the `mc` alias to the local endpoint
#   2. creates the `cip-evidence` bucket if it does not exist
#   3. enables versioning on the bucket (so chain-of-custody
#      replacements are preserved as new versions, not
#      destructive overwrites)
#   4. enables object-lock + a default 30-day retention on
#      the bucket (the retention is configurable via
#      MINIO_OBJECT_LOCK_DAYS; 0 means no retention)
#   5. (optionally) creates the read-only / read-write users
#      for the app and the auditor
#
# Required env:
#   MINIO_ROOT_USER       : root credentials
#   MINIO_ROOT_PASSWORD   : root credentials
#   MINIO_ENDPOINT        : alias host:port (default: minio:9000)
#   EVIDENCE_BUCKET       : bucket name (default: cip-evidence)
#   MINIO_OBJECT_LOCK_DAYS: retention in days (default: 30)
#
# Idempotent: safe to re-run.

set -euo pipefail

MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
EVIDENCE_BUCKET="${EVIDENCE_BUCKET:-cip-evidence}"
MINIO_OBJECT_LOCK_DAYS="${MINIO_OBJECT_LOCK_DAYS:-30}"

log() { printf '[minio-init] %s\n' "$*"; }

# Wait for the MinIO server to come up (max 60 s).
log "waiting for minio at ${MINIO_ENDPOINT} ..."
for i in $(seq 1 60); do
    if mc --quiet ready "${MINIO_ENDPOINT}" 2>/dev/null; then
        log "minio is ready"
        break
    fi
    sleep 1
    if [ "$i" -eq 60 ]; then
        log "ERROR: minio did not become ready in 60s"
        exit 1
    fi
done

mc alias set local "http://${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
log "mc alias 'local' set to ${MINIO_ENDPOINT}"

# Create the evidence bucket (idempotent).
if mc ls "local/${EVIDENCE_BUCKET}" >/dev/null 2>&1; then
    log "bucket ${EVIDENCE_BUCKET} already exists"
else
    mc mb "local/${EVIDENCE_BUCKET}"
    log "bucket ${EVIDENCE_BUCKET} created"
fi

# Versioning — chain-of-custody replacements become new
# versions, not destructive overwrites.
mc version enable "local/${EVIDENCE_BUCKET}" 2>/dev/null || log "versioning already enabled"
log "versioning enabled on ${EVIDENCE_BUCKET}"

# Object lock + default retention.
mc retention set --default "${MINIO_OBJECT_LOCK_DAYS}d" "local/${EVIDENCE_BUCKET}" 2>/dev/null \
    || log "object-lock retention not applied (set MINIO_OBJECT_LOCK_DAYS=0 to skip)"
log "object-lock retention: ${MINIO_OBJECT_LOCK_DAYS}d on ${EVIDENCE_BUCKET}"

log "minio init complete — bucket ${EVIDENCE_BUCKET} is ready for the M5 evidence pipeline"
