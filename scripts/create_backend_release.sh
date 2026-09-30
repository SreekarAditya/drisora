#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/dist/drisora-backend}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp "$ROOT_DIR/README.md" "$OUT_DIR/"
cp "$ROOT_DIR/LICENSE" "$OUT_DIR/"
cp "$ROOT_DIR/NOTICE.md" "$OUT_DIR/"
cp "$ROOT_DIR/CONTRIBUTING.md" "$OUT_DIR/"
cp "$ROOT_DIR/.gitignore" "$OUT_DIR/"
cp "$ROOT_DIR/.env.example" "$OUT_DIR/"

mkdir -p "$OUT_DIR/scripts"
cp "$ROOT_DIR/scripts/download_models.sh" "$OUT_DIR/scripts/"

rsync -a \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude 'models/' \
  --exclude 'outputs/' \
  --exclude 'reports/' \
  --exclude 'weights/*.pt' \
  --exclude 'weights/*.pth' \
  --exclude 'weights/*.onnx' \
  "$ROOT_DIR/worker/" "$OUT_DIR/worker/"

echo "Backend release written to $OUT_DIR"
