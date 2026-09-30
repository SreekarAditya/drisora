# Drisora PCI and Reproducibility Repair Log

Last updated: 2026-05-14
Repository: `/Users/sreekaraditya/Desktop/Drisora`

## Diagnosis

The reported symptoms came from multiple independent issues:

| Symptom | Root Cause | Impact |
|---|---|---|
| High-frame-rate footage produced far fewer frames than the source video contains | Video uploads defaulted to interval/keyframe-style sampling, not full-frame extraction. The worker also did not fail closed when extraction produced far fewer frames than expected. | PCI was computed over a sparse sample, so repeated or differently sampled runs could disagree. |
| PCI reproducibility was questionable | There was no run manifest, frame manifest, model hash manifest, or deterministic extraction default. R2 result listing order was also not guaranteed. | It was hard to prove whether two runs used the same frames, models, options, and result ordering. |
| Pothole width showed values like 18 mm | `lib/crack-metrics.ts` had fallback width bands for potholes and report hydration could derive crack metrics from D40 pothole detections. | Potholes were presented like cracks, producing physically nonsensical width values. |
| DepthPro fallback produced fake metric values | `worker/pipeline/depthpro_inference.py` converted pixel area to square meters when DepthPro failed. | Metric outputs could look precise even when metric inference was unavailable. |
| Pothole PCI looked too weak | PCI combined potholes inside a weighted average, so a D40 detection could be diluted by default roughness/rut/cracking terms. | Severe localized pothole evidence could still produce an over-generous PCI. |
| Clean/no-detection frames were penalized | Roughness default used baseline IRI logic even when no measured roughness existed. | Clean frames could score below 100 without evidence. |

## Fixes Applied

| Area | Files | Change |
|---|---|---|
| Full-frame extraction | `components/upload/DroneFootagePanel.tsx`, `components/upload/HandheldVideoPanel.tsx`, `worker/handler.py`, `worker/jobs/dispatcher.py`, `worker/ingest/video_handler.py` | Added `frame_extraction_mode: "all_frames"`, made it the UI and worker default, and preserved interval modes only as explicit preview options. |
| Frame-count validation | `worker/ingest/video_handler.py` | Added ffprobe metadata parsing and count validation. All-frame jobs now fail if extraction is far below the expected source-derived frame count. |
| Deterministic worker defaults | `worker/handler.py`, `worker/Dockerfile` | Seeded Python, NumPy, and Torch where available; set deterministic Docker defaults for `PYTHONHASHSEED`, `CUBLAS_WORKSPACE_CONFIG`, `DRISORA_DETERMINISTIC_SEED`, and `DRISORA_DETERMINISTIC_EXTRACTOR`. |
| Reproducibility manifests | `worker/handler.py` | Worker now uploads `run_manifest.json`, `frame_manifest.json`, and `processing_summary.json` under `results/{user_id}/{job_id}/manifests/`. |
| Stable result hydration | `lib/r2.ts` | R2 object keys are sorted before result hydration. |
| Pothole width fix | `lib/crack-metrics.ts`, `lib/jobs/results.ts`, `worker/pipeline/depthpro_inference.py` | D40 potholes are excluded from crack-width/length derivation. DepthPro crack-width estimation returns `None` for D40. |
| Honest metric fallback | `worker/pipeline/depthpro_inference.py` | DepthPro failure now marks `depth_m`, `camera_surface_distance_m`, `pixel_size_m`, and `mask_area_m2` unavailable and adds `metric_error: "depthpro_unavailable"`. |
| PCI scoring sanity | `worker/pipeline/pci_scorer.py` | Added `drisora_pci_v1`, clean-frame roughness default of 100, D40 count/extent scoring, and pothole caps so potholes cannot be hidden by the weighted average. |
| Architecture documentation | `docs/DRISORA_ARCHITECTURAL_BIBLE.md` | Updated the repository architecture bible to reflect the actual repaired behavior and remaining honesty notes. |

## Verification Already Run

```bash
python3 -m py_compile worker/ingest/video_handler.py worker/jobs/dispatcher.py worker/handler.py worker/pipeline/pci_scorer.py worker/pipeline/depthpro_inference.py
npx eslint components/upload/DroneFootagePanel.tsx components/upload/HandheldVideoPanel.tsx lib/crack-metrics.ts lib/jobs/results.ts lib/r2.ts
npx tsc --noEmit
git diff --check
npm run build
```

All passed locally. The first build attempt was blocked by sandboxed Google Fonts DNS access; the build passed after network access was allowed.

## Required Production Validation

These fixes make the implementation much less brittle, but PCI still needs empirical validation on the real worker and real footage.

1. Run the exact high-frame-rate test video through the deployed RunPod worker.
2. Confirm `results/{user_id}/{job_id}/manifests/frame_manifest.json` contains the source-derived expected frame count.
3. Repeat the same upload twice and compare:
   - frame count
   - frame timestamps
   - raw file SHA256
   - model SHA256 values
   - scoring version
   - per-frame PCI distribution
4. Confirm reports no longer show crack-width values for D40-only pothole detections.
5. Inspect any frame with `metric_error` and ensure the UI/report does not present metric depth/width as measured.
6. Calibrate `drisora_pci_v1` against civil-engineering-labeled survey segments before calling the score standard-certified PCI.

## Honest Remaining Work

- The current PCI scorer is an application-level engineering heuristic, not yet a validated certified PCI engine.
- Full-frame high-resolution processing is much heavier than preview sampling; RunPod timeout, GPU memory, R2 write volume, and webhook duration should be tested with the full decoded frame count from real source media.
- The report UI should surface metric-quality flags more explicitly so users can distinguish measured metric outputs from unavailable metric outputs.
- A worker-container regression test should be added with a tiny known-FPS video fixture to assert frame extraction count and timestamp determinism.
