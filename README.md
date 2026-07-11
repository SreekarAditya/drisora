# Drisora

Drisora is a Next.js control plane and RunPod worker for georeferenced pavement-distress evidence. Its current scientific output is deliberately partial:

> Partial IRC:82-2023 PCI assessment: 2 of 6 functional parameters instrumented (cracking extent, pothole number; 28% of composite weight). Roughness, ravelling, patching, and rut depth require instrumented survey (ARSS/NSV or manual per IRC:82-2023 Appendix-1) and are not measured. PCI reported as bounds, not a point estimate.

No-detection evidence is not interpreted as PCI 100. Image batches and handheld video are detection-only. A drone job receives PCI bounds only when its GPS-chainage, relative AGL, camera calibration, carriageway width, detector, SAM2 masks, and spatial deduplication all pass validation.

## Active pipeline

```text
direct R2 upload
  -> deterministic frame extraction
  -> DJI SRT telemetry (relative AGL kept distinct from absolute MSL)
  -> YOLOv12s RDD2022 detection
  -> SAM2 mask segmentation
  -> explicit GSD calibration and area uncertainty
  -> georeferenced cross-frame deduplication
  -> fixed 100 m GPS-chainage sections
  -> road-class-specific IRC:82-2023 Appendix-2 equations
  -> partial PCI bounds + provenance JSON + evidence PDF
```

Monocular depth is excluded from physical PCI inputs. It is not converted into rut depth, IRI, crack width, or metric scale.

## Output contract

Each calibrated section includes:

- explicit road class (`HIGHWAY`, `MDR_RURAL`, or `URBAN`), with mandatory surface type for MDR/rural roads;
- section length, explicit carriageway width, and section area;
- spatially unique cracking and pothole mask areas with uncertainty;
- pothole number as total pothole area divided by 0.1 m² (IRC:82-2023 Clause 7.5.3.4);
- `null` for ravelling, patching, rut depth, roughness, and complete point PCI;
- a 72-point interval from the 28% measured contribution and the full admissible range of the 72% unmeasured contribution;
- model hashes, deterministic seed, GSD source/error, dedup method, and code commit.

The platform persists interval columns (`pci_lower`, `pci_upper`) and retains the old `average_pci` database column only to keep historical migrations readable. Current jobs write it as `NULL`.

## Standard-source note

The checked IRC:82-2023 copy contains two internal source defects:

1. The printed MDR/rural pothole polynomial increases above 100 and contradicts its adjacent decreasing curve. Drisora uses the curve-consistent polynomial in the official preceding IRC H-6 draft and emits this as an erratum in provenance.
2. Several Appendix-2 worked-example totals do not reproduce from the printed equations and Table 5.4 weights. Tests preserve the printed input rows but assert independently recomputed equation outputs. See `REMEDIATION.md` for the nine-row table.

## Local verification

```bash
npm install
npm run lint
npm run typecheck
npm run test:worker
npm run build
```

The full gate is:

```bash
npm run verify
```

## Model and environment pinning

The deployed path uses exactly:

- YOLO checkpoint SHA-256: `138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3`
- SAM2.1 Hiera Small SHA-256: `6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38`
- SAM2 source commit: `c2ec8e14a185632b0a5d8b161928ceb50197eddc`
- deterministic seed: `1337`

`worker/Dockerfile` verifies both checkpoint hashes during the build. `worker/requirements.txt` pins direct dependencies and `worker/constraints.txt` locks the resolved transitive set. The Docker base is `pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime` pinned by digest and installs `libgl1` plus `libglib2.0-0`.

Copy `.env.local.example` for the web app and `worker/.env.example` for deployment credentials. Never commit populated env files.

## RunPod deployment

The deployment command builds `linux/amd64`, pushes by digest, updates the existing RunPod Serverless template, and preserves service secrets while overriding checkpoint paths and hashes with the verified image contract:

```bash
npm run deploy:runpod -- --image sreekaraditya/drisora-worker:<tag>
```

## Research status

This repository supplies a corrected, reproducible measurement pipeline—not a validated results paper. Real-survey labels, manual six-parameter comparison data, engineer review, uncertainty analysis, and external validation are still required before claiming agreement, compliance, accuracy, or generalization.

## License

GNU Affero General Public License v3.0. Third-party notices are in `NOTICE.md`.
