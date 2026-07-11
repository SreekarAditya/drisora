# Drisora Artifact Guide

## Verify the repository

```bash
npm install
npm run lint
npm run typecheck
npm run test:worker
npm run build
```

`npm run verify` runs the repository's combined gate. The worker acceptance suite covers all road classes, all five MDR surface curves, nine Appendix-2 source input rows, null unmeasured inputs, detector/SAM failure behavior, pothole area conversion, relative-AGL GSD, area uncertainty, GPS sectioning, and spatial deduplication.

## Configure a drone assessment

Required job options:

- `road_class`: `HIGHWAY`, `MDR_RURAL`, or `URBAN`;
- `surface_type`: required for MDR/rural (`SD`, `OGPC`, `MSS`, `SDBC`, or `BC`);
- `carriageway_width_m`;
- camera geometry (horizontal FOV, sensor/focal pair, or explicit estimated GSD);
- `camera_calibration_source`;
- `gsd_relative_error_pct`;
- all-frame extraction for section aggregation.

The SRT must contain latitude, longitude, relative altitude, yaw, and near-nadir pitch for each usable frame. Absolute MSL is never substituted for AGL.

## Verify a result

Inspect `partial_pci_sections.json` and confirm:

- `pci_complete` is null;
- every interval width is 72;
- measured weight is 0.28 and unmeasured weight is 0.72;
- ravelling, patching, rut depth, and roughness are null;
- each section has raw and unique detection counts;
- model hashes, seed, build commit, GSD source/error, and dedup method are present.

Cross-check `processing_summary.json` for processed counts and timing and `run_manifest.json` for input/model hashes. A successful request alone is not evidence of a valid assessment.

## Reproduce the container

`worker/Dockerfile` installs exact Python packages, pins the SAM2 commit, verifies the SAM2 checkpoint, copies and verifies the YOLO checkpoint, compiles the worker, and fixes deterministic seeds. Build with:

```bash
docker build --platform linux/amd64 \
  --build-arg DRISORA_BUILD_SHA=$(git rev-parse HEAD) \
  -f worker/Dockerfile worker
```

## Research acceptance

Code reproducibility is not empirical validation. A paper artifact additionally requires frozen real surveys, manual six-parameter field measurements, engineer-reviewed labels, uncertainty analysis, failure cases, image/detector metrics, and archived raw inputs plus outputs.
