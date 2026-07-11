#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/dist/drisora-backend}"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/drisora-backend-release.XXXXXX")"
trap 'rm -rf "$STAGING_DIR"' EXIT

mkdir -p "$STAGING_DIR"

cp "$ROOT_DIR/README.md" "$STAGING_DIR/"
cp "$ROOT_DIR/REMEDIATION.md" "$STAGING_DIR/"
cp "$ROOT_DIR/LICENSE" "$STAGING_DIR/"
cp "$ROOT_DIR/NOTICE.md" "$STAGING_DIR/"
cp "$ROOT_DIR/CONTRIBUTING.md" "$STAGING_DIR/"
cp "$ROOT_DIR/.gitignore" "$STAGING_DIR/"
cp "$ROOT_DIR/.env.example" "$STAGING_DIR/"

mkdir -p "$STAGING_DIR/scripts"
cp "$ROOT_DIR/scripts/download_models.sh" "$STAGING_DIR/scripts/"

rsync -a \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude 'models/' \
  --exclude 'outputs/' \
  --exclude 'reports/' \
  --exclude 'weights/*.pth' \
  --exclude 'weights/*.onnx' \
  "$ROOT_DIR/worker/" "$STAGING_DIR/worker/"

# A release checkout may itself be a Git repository. Preserve its metadata while
# replacing every published file with the staged, source-of-truth snapshot.
mkdir -p "$OUT_DIR"
rsync -a --delete --exclude '.git/' "$STAGING_DIR/" "$OUT_DIR/"

echo "Backend release written to $OUT_DIR"
