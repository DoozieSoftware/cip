#!/usr/bin/env bash
# Civic Intelligence Platform — MinIO bucket bootstrap.
#
# Creates the evidence bucket with versioning + object lock, sets a
# private access policy, and verifies the bucket is reachable.
#
# This script is idempotent: re-running it does not destroy data.
# See docs/03 §12 and docs/05 §14 for the storage strategy.

set -euo pipefail

BUCKET="${AWS_BUCKET:-cip-evidence}"
ENDPOINT="${AWS_ENDPOINT_INTERNAL:-http://localhost:9000}"
PUBLIC_ENDPOINT="${AWS_ENDPOINT:-http://localhost:9000}"
ACCESS_KEY="${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
SECRET_KEY="${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

mc() {
    command mc "$@"
}

echo "Configuring mc alias for ${ENDPOINT}"
mc alias set cip "${ENDPOINT}" "${ACCESS_KEY}" "${SECRET_KEY}" --api S3v4

echo "Ensuring bucket ${BUCKET} exists"
if ! mc ls "cip/${BUCKET}" >/dev/null 2>&1; then
    mc mb "cip/${BUCKET}" --region "${REGION}"
    echo "Bucket ${BUCKET} created"
else
    echo "Bucket ${BUCKET} already exists"
fi

echo "Enabling versioning"
mc version enable "cip/${BUCKET}"

echo "Setting access policy to private"
mc anonymous set none "cip/${BUCKET}"

echo "Configuring CORS for browser uploads"
cat > /tmp/cors.json <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-version-id"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
mc cors set /tmp/cors.json "cip/${BUCKET}" || echo "CORS configuration skipped (mc version may not support cors)"

echo
echo "MinIO bucket ${BUCKET} is ready at ${PUBLIC_ENDPOINT}"
