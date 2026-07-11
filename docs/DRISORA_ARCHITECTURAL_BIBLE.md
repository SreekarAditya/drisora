# Drisora Architecture — Current Contract

This document describes the production path after the July 2026 PCI-engine remediation. Historical point-score designs are not part of the active contract.

## Control plane

- Next.js App Router handles authenticated uploads, job creation, results, reports, and project views.
- Browsers upload directly to Cloudflare R2 with presigned URLs.
- Upstash Redis carries live worker state.
- Supabase stores durable job metadata. Current jobs write `pci_lower`/`pci_upper`; `average_pci` is legacy-only and remains null.
- The completion webhook is authenticated and persists status, counts, R2 prefix, section-artifact key, and bounds.

## Inference plane

RunPod Serverless executes `worker/handler.py`. Network clients are created inside the job handler, not at module import. The worker:

1. downloads the exact upload manifest;
2. extracts deterministic frames;
3. parses SRT telemetry while keeping relative AGL and absolute MSL separate;
4. requires an explicit road class, carriageway width, camera calibration source, and GSD error for drone PCI;
5. runs pinned YOLO and SAM2 models;
6. fails the job on detector or segmentation failure;
7. converts SAM mask pixels to square metres using relative AGL plus explicit camera geometry;
8. propagates GSD uncertainty with exact area scales `(1-e)^2` and `(1+e)^2`;
9. projects detections to the ground plane and clusters overlapping same-distress footprints;
10. groups evidence into fixed 100 m GPS-chainage sections;
11. emits two measured sub-indices, four null inputs, and PCI bounds only.

## Scientific boundary

The detector instruments cracking extent and pothole number (28% of Table 5.4 weight). Ravelling, patching, rut depth, and IRI/roughness remain null. Monocular depth is not a metric survey instrument. A complete point PCI is available only through `evaluate_complete_pci` when all six physical inputs are explicitly supplied.

## Failure semantics

- zero trained detections: successful detector evidence, no point PCI;
- detector failure: job failure;
- SAM2 failure or empty mask: job failure;
- missing relative AGL, nadir geometry, FOV/calibration, width, or GPS: no section assessment;
- GPS discontinuity over one section length: hard failure;
- absent dedup evidence: hard failure;
- image/handheld job: detection-only output.

## Artifact locations

```text
results/<user>/<job>/detections/*.json
results/<user>/<job>/frames/*
results/<user>/<job>/overlays/*
results/<user>/<job>/partial_pci_sections.json
results/<user>/<job>/manifests/run_manifest.json
results/<user>/<job>/manifests/frame_manifest.json
results/<user>/<job>/manifests/processing_summary.json
```

The section artifact is the source of truth for web results, project maps, and PDF reports. Frames are evidence, never relabeled as sections.
