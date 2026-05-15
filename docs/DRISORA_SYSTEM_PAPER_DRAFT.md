# Drisora: A Serverless Geospatial System for Pavement Condition Assessment

Draft status: scaffold. The manuscript is not ready for submission until the real-survey evaluation is complete.

## Abstract

Drisora is an end-to-end geospatial pavement condition assessment system that converts road survey media into defect detections, metric crack features, PCI-style section scores, interactive maps, and engineering reports. The system combines a Next.js control plane, Supabase/PostGIS metadata, Cloudflare R2 object storage, Upstash Redis job state, and RunPod serverless GPU inference. This paper evaluates Drisora as a systems artifact: reproducibility, throughput, cost, failure modes, and agreement with segment-level pavement labels.

Placeholder results to fill after evaluation:

- Number of real surveys:
- Total route length:
- Total frames/images:
- Engineer-reviewed subset:
- PCI MAE:
- Condition-band agreement:
- Defect class F1:
- Frames/minute:
- Cost/job:

## 1. Introduction

Road-condition assessment often depends on manual inspection, expensive survey vehicles, or disconnected detection scripts that do not produce engineer-facing deliverables. Drisora targets the full workflow: upload media, preserve raw evidence, process frames on GPU infrastructure, attach GPS, infer defects, compute PCI-style sections, visualize the route, and generate reports.

Contributions:

1. An end-to-end pavement survey system spanning browser upload, object storage, GPU inference, geospatial aggregation, and reports.
2. A reproducible artifact contract with run manifests, frame manifests, model hashes, timing, and degraded-stage metadata.
3. A real-survey evaluation protocol using segment-level condition and defect labels.
4. An analysis of serverless GPU trade-offs for pavement media processing.

## 2. System Design

Drisora has two planes:

- Control plane: Next.js App Router, Supabase Auth/Postgres, Cloudflare R2, Upstash Redis.
- Inference plane: RunPod serverless worker running YOLO, SAM2, optional DepthPro, and PCI scoring.

Key design decisions:

- Raw media is uploaded directly to R2 with presigned URLs.
- Web tier stays GPU-free.
- Worker outputs are immutable JSON/image artifacts.
- Redis carries fast job progress, while Supabase stores durable job and survey state.
- Worker manifests record model/runtime/input/output metadata for reproducibility.

## 3. Methods

Input modes:

- Image batch
- Handheld video
- Drone footage
- Multi-video drone survey through the same `drone_footage` job contract

Pipeline:

1. Validate job and files.
2. Download raw media.
3. Extract frames with deterministic defaults.
4. Attach GPS from EXIF or SRT where available.
5. Run YOLO defect detection.
6. Run SAM2 segmentation when detections are present.
7. Run DepthPro when metric analysis is enabled.
8. Compute PCI-style frame and segment scores.
9. Upload frame artifacts, detection JSON, manifests, and reports.

Analysis stages:

- `yolo_only`
- `yolo_sam2`
- `yolo_sam2_depthpro`
- `fallback`

## 4. Dataset And Label Protocol

Target evaluation set:

- 15-30 real surveys.
- Raw video/images plus SRT/GPS where available.
- Drisora outputs frozen per job.
- Segment-level labels.
- Representative engineer-reviewed subset.

Label fields:

- survey id
- segment id
- GPS bounds or distance range
- manual condition band
- manual PCI if available
- visible defect classes
- false positive notes
- false negative notes
- reviewer id/type
- notes on lighting, blur, GPS quality, occlusion, and road context

## 5. Evaluation

System metrics:

- Upload time
- Processing time
- Frames/minute
- Report generation time
- Failure rate
- Retry rate
- Cost/job estimate

Quality metrics:

- PCI MAE where manual PCI exists
- Condition-band agreement
- Defect class precision/recall/F1
- Section-level precision/recall where labels support it
- GPS section consistency
- Degraded-stage impact

Ablations:

- YOLO-only
- YOLO+SAM2
- YOLO+SAM2+DepthPro
- Fallback/degraded paths

## 6. Results

To be generated from:

```bash
node evaluation/drisora_eval.mjs compute --export <export.json> --labels <labels.json> --out evaluation/output/<survey_id>
```

Aggregate real-survey tables and figures must be regenerated from saved exports and scripts, not edited by hand.

Required figures:

- System architecture
- End-to-end processing pipeline
- Latency and cost table
- PCI agreement plot
- Defect examples
- Failure cases
- Degraded-stage comparison

## 7. Limitations

- DepthPro measurements are monocular estimates, not calibrated physical ground truth.
- PCI-style scores are not certified PCI ratings without field validation.
- Real-world labels may be limited in survey count, geography, camera type, weather, and lighting.
- External services affect reproducibility, including RunPod, Cloudflare R2, Upstash Redis, Supabase, and Vercel.
- Detector novelty is not claimed.

## 8. Reproducibility

Artifact materials:

- Repo commit hash:
- Docker image digest:
- Model hashes from `run_manifest.json`:
- Sample survey manifest:
- Label file:
- Evaluation export:
- Verification command outputs:

Minimum reproducibility claim:

Another engineer can configure the environment, run at least one sample survey through Drisora, locate the worker manifests, run the evaluation script against frozen labels, and regenerate the reported tables.
