#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

download() {
  local url="$1"
  local target="$2"

  if [ -z "$url" ]; then
    echo "No URL provided for $target"
    return 0
  fi

  mkdir -p "$(dirname "$target")"
  if [ -s "$target" ]; then
    echo "Exists: $target"
    return 0
  fi

  local tmp="${target}.tmp"
  echo "Downloading $url"
  curl -fL "$url" -o "$tmp"
  mv "$tmp" "$target"
  echo "Wrote: $target"
}

: "${DEPTH_ANYTHING_V2_MODEL_URL:=https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-VKITTI-Large/resolve/main/depth_anything_v2_metric_vkitti_vitl.pth}"
: "${DEPTH_ANYTHING_V2_MODEL_PATH:=/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth}"
: "${DRISORA_YOLO_WEIGHTS_PATH:=$ROOT_DIR/worker/weights/yolov12s_rdd2022.pt}"

download "$DEPTH_ANYTHING_V2_MODEL_URL" "$DEPTH_ANYTHING_V2_MODEL_PATH"

if [ -n "${DRISORA_YOLO_WEIGHTS_URL:-}" ]; then
  download "$DRISORA_YOLO_WEIGHTS_URL" "$DRISORA_YOLO_WEIGHTS_PATH"
else
  echo "Set DRISORA_YOLO_WEIGHTS_URL to download the YOLOv12s RDD2022 checkpoint."
  echo "Expected local path: $DRISORA_YOLO_WEIGHTS_PATH"
fi
