# Drisora Backend

Drisora Backend is a pavement condition intelligence pipeline for drone road-survey media. It converts an MP4/MOV video plus DJI SRT telemetry into defect detections, segmentation masks, metric crack features, 10 m section PCI scores, and an IRC:82-2023 PDF report.

This open-source package is backend-only. It does not include the Next.js frontend, Supabase routes or migrations, auth configuration, billing, signed URL logic, tenant logic, private bucket names, secrets, or model weights.

## Pipeline Architecture

```text
Frame Extraction
  -> DJI SRT telemetry parsing
  -> GSD calibration from altitude
  -> YOLOv12s crack detection
  -> SAM2 segmentation
  -> Depth Anything V2 metric depth estimation
  -> crack width estimation in mm
  -> Haversine GPS sectioning at 10 m
  -> IRC:82-2023 PCI scoring
  -> JSON + PDF report output
```

## Requirements

- Python 3.10+
- CUDA 12+ recommended
- NVIDIA GPU strongly recommended for YOLO, SAM2, and Depth Anything V2 Large
- `ffmpeg` and `ffprobe` on `PATH`
- Model checkpoints downloaded separately

## Installation

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install git+https://github.com/facebookresearch/sam2.git
git clone https://github.com/DepthAnything/Depth-Anything-V2.git /tmp/depth-anything-v2
export DEPTH_ANYTHING_V2_REPO=/tmp/depth-anything-v2
```

Install a CUDA-compatible PyTorch build from the official PyTorch selector for your machine before running GPU inference.

## Model Weights

Model weights are intentionally not committed. Use the helper script to fetch the public Depth Anything V2 metric checkpoint and, when available, the project YOLO checkpoint from a URL you provide:

```bash
DRISORA_YOLO_WEIGHTS_URL="https://your-model-host/yolov12s_rdd2022.pt" \
  ./scripts/download_models.sh
```

The default Depth Anything V2 model is the outdoor metric Large checkpoint for highest-accuracy Drisora runs:

```text
depth-anything/Depth-Anything-V2-Metric-VKITTI-Large
```

This uses the `vitl` encoder and a 1.34 GB checkpoint. Use `vitb` or `vits` only when you intentionally want lower VRAM or faster smoke tests.

## Environment

Copy `.env.example` or `worker/.env.example` and fill in local values. Required worker variables:

```bash
OBJECT_STORAGE_ENDPOINT_URL=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_BUCKET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
APP_CALLBACK_URL=
WORKER_WEBHOOK_SECRET=
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
DRISORA_YOLO_WEIGHTS_PATH=worker/weights/yolov12s_rdd2022.pt
DRISORA_YOLO_WEIGHTS_URL=
DEPTH_ANYTHING_V2_REPO=/tmp/depth-anything-v2
DEPTH_ANYTHING_V2_MODEL_PATH=/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth
DEPTH_ANYTHING_V2_ENCODER=vitl
DRISORA_ENABLE_DEPTH_DEFAULT=1
```

## Usage: Single Video Inference

```bash
cd worker
python run_single_video.py \
  --video /path/to/drone_flight.mp4 \
  --srt /path/to/drone_flight.srt \
  --out ../outputs/drone_flight
```

The local CLI decodes all frames and enables Depth Anything V2 Large by default. Add `--sample-frames --frame-interval-seconds 1` only for faster exploratory runs.

Outputs:

- `outputs/drone_flight/results.json`
- `outputs/drone_flight/report.pdf`
- extracted frames in a temporary directory

For RunPod serverless, use `worker/handler.py` with a job payload that includes `job_id`, `user_id`, `mode`, `storage_prefix`, `file_names`, and optional pipeline settings.

## Citation

If you use Drisora Backend in research, cite the Drisora systems paper:

```bibtex
@misc{reddy2026drisora,
  title = {Drisora: A Drone-Based Pavement Condition Intelligence Pipeline for IRC:82-2023 Road Surveys},
  author = {Reddy, Sreekar Aditya},
  year = {2026},
  note = {Preprint in preparation}
}
```

Also cite the upstream models and datasets listed in `NOTICE.md`.

## License

Drisora Backend is released under the GNU Affero General Public License v3.0. See `LICENSE` for the full text.
