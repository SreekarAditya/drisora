#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
YOLO_PATH="${DRISORA_YOLO_WEIGHTS_PATH:-$ROOT_DIR/worker/weights/yolov12s_rdd2022.pt}"
YOLO_SHA256="138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3"
SAM2_PATH="${SAM2_MODEL_PATH:-/tmp/models/sam2.1_hiera_small.pt}"
SAM2_URL="${SAM2_MODEL_URL:-https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt}"
SAM2_SHA256="6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

verify_file() {
  local target="$1"
  local expected="$2"
  local label="$3"
  if [ ! -s "$target" ]; then
    echo "$label is missing: $target" >&2
    return 1
  fi
  local actual
  actual="$(sha256_file "$target")"
  if [ "$actual" != "$expected" ]; then
    echo "$label SHA-256 mismatch: expected $expected, got $actual" >&2
    return 1
  fi
  echo "$label verified: $target"
}

download_verified() {
  local url="$1"
  local target="$2"
  local expected="$3"
  local label="$4"
  mkdir -p "$(dirname "$target")"
  if [ ! -s "$target" ]; then
    local temporary="${target}.tmp"
    rm -f "$temporary"
    curl --fail --location --retry 3 --user-agent "Drisora/0.1 checkpoint fetch" \
      --output "$temporary" "$url"
    mv "$temporary" "$target"
  fi
  verify_file "$target" "$expected" "$label"
}

# The detector checkpoint is part of the release artifact; no opaque runtime URL
# or mutable download is accepted.
verify_file "$YOLO_PATH" "$YOLO_SHA256" "YOLOv12s RDD2022 checkpoint"
download_verified "$SAM2_URL" "$SAM2_PATH" "$SAM2_SHA256" "SAM2.1 Hiera Small checkpoint"
