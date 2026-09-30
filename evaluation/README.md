# Drisora Evaluation Module

This folder is the research-paper evaluation path for Drisora as a systems artifact. It is separate from any detector benchmark paper.

## Commands

Validate a label file:

```bash
node evaluation/drisora_eval.mjs validate --labels evaluation/fixtures/sample_labels.json
```

Normalize a saved `JobResults` JSON into a paper export bundle:

```bash
node evaluation/drisora_eval.mjs export \
  --job-results <job_results.json> \
  --survey-id <survey_id> \
  --processing-summary <processing_summary.json> \
  --run-manifest <run_manifest.json> \
  --out evaluation/output/<survey_id>
```

Compute metrics and paper tables from a frozen export plus labels:

```bash
node evaluation/drisora_eval.mjs compute \
  --export evaluation/fixtures/sample_export.json \
  --labels evaluation/fixtures/sample_labels.json \
  --out evaluation/output/sample
```

The command writes:

- `metrics.json`
- `metrics.csv`
- `paper_tables.md`

## Label Protocol

Lock labels at segment level before metric computation.

Required segment fields:

- `segment_id`
- `manual_condition_band`: `good`, `satisfactory`, `fair`, `poor`, or `very_poor`
- `defect_classes`: visible defect classes for that segment
- `reviewer_id`
- `review_status`: `self_labeled`, `engineer_reviewed`, or `adjudicated`

Recommended segment fields:

- `manual_pci`
- `start_distance_m`
- `end_distance_m`
- `major_false_positive_notes`
- `major_false_negative_notes`
- `notes` covering lighting, blur, GPS quality, occlusion, and road context

## Private Data Boundary

Raw survey media can stay outside git. Commit only:

- locked manifests
- anonymized survey metadata
- labels
- aggregate metrics
- generated paper tables and figures

Use `evaluation/private/` or external storage for raw videos, images, and GPS logs.
