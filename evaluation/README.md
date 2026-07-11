# Drisora Evaluation Module

This module evaluates the current **bounded section contract**. It does not turn a synthetic fixture into research evidence and does not compute point-PCI MAE from imagery-only output.

## Fixture gate

```bash
node evaluation/drisora_eval.mjs validate \
  --labels evaluation/fixtures/sample_labels.json

node evaluation/drisora_eval.mjs compute \
  --export evaluation/fixtures/sample_export.json \
  --labels evaluation/fixtures/sample_labels.json \
  --out evaluation/output/fixture
```

The checked-in fixture is explicitly marked `synthetic_fixture`. Its generated metrics carry:

```json
{
  "evidence_status": "synthetic_fixture_only_not_research_evidence",
  "research_claim_permitted": false
}
```

Its only purpose is to verify schema validation, 72-point interval handling, reference-coverage arithmetic, and defect-class comparison.

## Export a real job

```bash
node evaluation/drisora_eval.mjs export \
  --job-results <job_results.json> \
  --survey-id <survey_id> \
  --processing-summary <processing_summary.json> \
  --run-manifest <run_manifest.json> \
  --out evaluation/output/<survey_id>
```

The exporter consumes real `jobResults.sections`; it never relabels frames as sections or assigns fixed lengths to frames.

## Label protocol

Lock reference data at the same section IDs before metric computation. Each label records:

- `source_kind`: `real_survey` or `synthetic_fixture`;
- `section_id`;
- independently observed defect classes;
- reviewer identity and review status;
- optional `reference_complete_pci`, only when all six physical parameters were measured independently.

For a real reference PCI, the evaluator reports whether that value lies inside the imagery-derived interval and its distance outside the interval. It does not collapse the 72-point interval into a point prediction or condition band.

## Research boundary

Real raw media may remain access-controlled, but a publication claim still requires archived manifests, anonymized survey metadata, locked labels, the measurement protocol, reviewer provenance, and generated diagnostics. The evaluator always emits `research_claim_permitted: false`; scientific sufficiency is a human review gate, not a software flag.
