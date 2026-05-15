# Drisora Research-Paper Readiness

Date: 2026-05-15

Scope: Drisora as a conference-level systems artifact. This document does not reuse or cite the separate submitted detector benchmark work.

## Thesis

Drisora is an end-to-end geospatial pavement condition assessment system that converts real survey media into defect detections, metric crack features, PCI-style road sections, interactive maps, and engineering reports using serverless GPU inference.

## Current Status

Estimated paper readiness after this implementation slice: 60%.

Why not higher:

- The repo now has explicit verification scripts, evaluation scaffolding, label validation, deterministic sample metrics, model asset documentation, and worker stage/degraded metadata.
- The system still needs 15-30 real surveys, locked labels, an engineer-reviewed subset, real end-to-end exports, aggregate metrics, figures, and a finished manuscript.

## Readiness Gates

| Gate | Status | Evidence |
|---|---|---|
| Repo lint/type/build scripts | Implemented | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run verify` |
| Worker unit-test script | Implemented | `npm run test:worker` |
| Multi-video mode/schema alignment | Implemented | Survey ingest now queues multi-video surveys as `drone_footage`, matching TypeScript and SQL constraints |
| Structured run manifests | Partial | Worker writes run/frame/processing manifests; processing summary now includes stage counts and degraded reasons |
| Evaluation export/labels/metrics | Implemented scaffold | `evaluation/drisora_eval.mjs`, sample export, sample labels, JSON schema, deterministic outputs |
| Real-survey dataset | Not started in repo | Requires 15-30 real surveys and locked labels |
| Engineer-reviewed labels | Not started in repo | Requires at least a representative subset reviewed by a civil/transportation engineer |
| Results and figures | Scaffold only | Metrics tables can regenerate; figures still need real exports |
| Manuscript | Scaffold only | See `docs/DRISORA_SYSTEM_PAPER_DRAFT.md` |
| Artifact guide | Implemented draft | See `docs/DRISORA_ARTIFACT_GUIDE.md` |

## Path To 100%

### 65%: One Real Survey Reproducible

Acceptance:

- Process one real survey from upload through worker completion and PDF report.
- Save the worker manifests:
  - `run_manifest.json`
  - `frame_manifest.json`
  - `processing_summary.json`
- Create one normalized evaluation export matching `drisora-eval-export-v1`.
- Create one label file matching `drisora-labels-v1`.
- Run:

```bash
npm run eval:sample
node evaluation/drisora_eval.mjs compute --export <real_export.json> --labels <real_labels.json> --out evaluation/output/<survey_id>
```

### 80%: Real-Survey Evaluation Dataset

Acceptance:

- 15-30 real surveys locked in a manifest.
- Each survey has raw media location, GPS/SRT availability, run manifest path, output export path, and label file path.
- Labels are segment-level:
  - PCI or condition band
  - visible defect classes
  - false positive notes
  - false negative notes
  - lighting/GPS/road-condition notes
- A representative subset is engineer-reviewed.

Private media can stay out of git. Commit only anonymized manifests, schemas, labels if safe, aggregate outputs, and tables.

### 90%: Results and Analysis

Acceptance:

- System metrics:
  - upload time
  - processing time
  - frames/minute
  - report generation time
  - failure rate
  - retry rate
  - cost/job estimate
- Quality metrics:
  - PCI MAE where manual PCI exists
  - condition-band agreement
  - defect class precision/recall/F1
  - GPS/segment consistency checks
  - degraded-stage impact
- Ablations:
  - YOLO-only
  - YOLO+SAM2
  - YOLO+SAM2+DepthPro/PCI
  - fallback/degraded paths
- Figures:
  - architecture diagram
  - end-to-end pipeline diagram
  - latency/cost table
  - PCI agreement plot
  - defect examples
  - failure cases

### 100%: Submission Package

Acceptance:

- Complete manuscript:
  - Abstract
  - Introduction
  - System Design
  - Methods
  - Dataset/Label Protocol
  - Evaluation
  - Results
  - Limitations
  - Reproducibility
- Artifact package:
  - setup guide
  - env var list without secrets
  - model acquisition/checksum process
  - sample survey
  - expected outputs
  - verification commands
  - aggregate table regeneration command

## Honest Claim Boundaries

Drisora should be positioned as a systems artifact, not a novel detector paper.

Allowed claims after real evaluation:

- End-to-end survey processing workflow.
- Reproducible manifests for inputs, frames, models, runtime, and outputs.
- Segment-level pavement-condition outputs with measurable agreement against labels.
- Practical serverless GPU deployment pattern for pavement media processing.

Claims to avoid unless validated:

- Certified PCI without field validation.
- Precision metric crack widths from monocular DepthPro as ground truth.
- Generalization across all countries, cameras, lighting, and road surfaces.
- Detector novelty.
