# Drisora PCI Engine Remediation — Pass 2

**Date:** 2026-07-11

**Scope:** the Next.js application, active RunPod worker, database contract, generated reports, documentation, container image, and public `drisora-backend` release snapshot.
**Source audit:** `AUDIT.md`

## Outcome

Drisora no longer emits a complete PCI from drone imagery. The production contract is now a **partial IRC:82-2023 PCI assessment** built from the two functional parameters the current detector can instrument:

- cracking extent, weight 0.12;
- pothole number derived from segmented pothole area divided by 0.1 m², weight 0.16.

Ravelling, patching, rut depth, and roughness remain `null`. Together they account for 0.72 of the composite weight. A current drone job therefore emits a section-level interval with an exact width of 72 PCI points:

```text
lower = 0.12 × cracking_sub_index + 0.16 × pothole_sub_index
upper = lower + 0.72 × 100
pci_complete = null
```

The only code path allowed to emit a point PCI is `evaluate_complete_pci`, which requires all six independently measured inputs. It exists for equation verification and future instrumented surveys; the drone worker does not call it.

## Corrections to the supplied remediation prompt

The user explicitly authorized changing prompt content that could be shown to be incorrect. Two conflicts were confirmed against the rendered physical IRC:82-2023 Appendix-2 pages and by direct substitution into the printed equations.

### 1. Worked-example totals

The nine input rows in the prompt were retained, but several supplied totals do not equal the weighted sum of the printed sub-index equations. Tests therefore assert the deterministic equation outputs rather than calibrating code to inconsistent totals. MDR rows explicitly select `SD`, because Table A2.2 makes roughness surface-dependent while the supplied rows omit surface type. Production has no such default and rejects an MDR request without a surface type.

| Road class | CE | RE | PN | PE | RD | IRI | Prompt total | Equation result | Condition |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Highway | 0.5 | 0.3 | 0 | 0.05 | 0.10 | 2.4 | 93.58 | **93.883540** | Excellent |
| Highway | 5 | 3 | 2 | 2.6 | 10 | 4.5 | 41.37 | **40.839631** | Fair |
| Highway | 14 | 12 | 4 | 15 | 14 | 8 | 20.54 | **20.560098** | Poor |
| MDR/Rural, SD | 0.6 | 0.1 | 1 | 0.5 | 1 | 2.8 | 89.45 | **97.245466** | Excellent |
| MDR/Rural, SD | 6.5 | 4.7 | 6 | 6 | 8 | 9.2 | 47.17 | **47.411127** | Fair |
| MDR/Rural, SD | 20 | 16 | 10 | 12 | 22 | 12 | 22.44 | **22.411018** | Poor |
| Urban | 0.5 | 0.2 | 0 | 0.1 | 0 | 2.4 | 96.10 | **94.497500** | Excellent |
| Urban | 5 | 2 | 3 | 3.5 | 4 | 6 | 56.86 | **46.835660** | Fair |
| Urban | 12 | 8 | 4 | 10 | 12 | 7 | 34.68 | **27.652728** | Poor |

These rows are regression tests, not claims about a real Drisora survey.

### 2. MDR/Rural pothole equation

The final printed Table A2.2 pothole polynomial is malformed: it lacks a decreasing term, rises above 100 as pothole number increases, and contradicts the curve printed beside it. Drisora does not silently guess around that defect. It uses the curve-consistent polynomial published in the preceding official IRC H-6 draft:

```text
0.1204 PN³ − 1.5385 PN² − 6.519 PN + 99.231
```

Every MDR result carries an explicit `standard_errata` provenance note until IRC publishes a corrigendum. The malformed final polynomial is not used and no result is tuned to a historical Drisora number.

## Finding-by-finding disposition

### Finding 1 — hardcoded terms and missing IRI

**Status: fixed by changing the output contract.**

- Deleted hardcoded `roughness = 100`, ravelling extent `0`, and patching extent `0` from scoring.
- Drone measurements cover only cracking and potholes.
- Unmeasured fields are `null`, `pci_complete` is `null`, and the measured/unmeasured weight fractions are explicit.
- The active APIs, dashboards, maps, and PDFs consume bounds instead of a fabricated point.

### Finding 2 — dimensionally meaningless rut depth

**Status: fixed.**

- Removed the `np.std(depth) × 0.3 × 1000` rut calculation.
- Depth Anything is not an input to any physical PCI parameter.
- The residual optional depth module exposes relative arrays only and is disabled in the production worker image.
- Rut depth remains `null` until supplied by a defensible instrumented or manual survey.

### Finding 3 — silent fallbacks

**Status: fixed.**

- Deleted the 50-point scorer fallback and all handler score fallbacks.
- Detector, segmentation, geometry, deduplication, and scoring exceptions propagate and fail the job.
- A successfully executed detector with zero supported distress detections is labeled `no_distress_found`; it still produces `pci_complete = null`.
- A detector that did not run or failed produces no assessment.

### Finding 4 — per-frame averaging instead of sections

**Status: fixed.**

- The active RunPod handler creates fixed 100 m chainage sections from SRT GPS.
- Carriageway width is mandatory and section area is `section_length × carriageway_width`.
- Frames are evidence assigned to chainage sections, never PCI sampling units.
- Cross-frame detections are deduplicated before section distress area is scored.
- The worker uploads `partial_pci_sections.json`; it does not calculate `average_pci`.

### Finding 5 — unsupported compliance claim and wrong equation scope

**Status: fixed and narrowed.**

- Implemented separate Appendix-2 equation dispatch for `HIGHWAY`, `MDR_RURAL`, and `URBAN`.
- Implemented all five Table A2.2 roughness curves for `SD`, `OGPC`, `MSS`, `SDBC`, and `BC`.
- Road class has no default. MDR/Rural surface type is mandatory.
- Table 5.4 weights, Table 5.5 bands, Clause 7.5.3.4 pothole units, and equation-table provenance are attached in code.
- Removed unconditional “compliant” language and compliance stamps.
- Product language now says “partial IRC:82-2023 PCI assessment,” identifies 2 of 6 parameters and 28% of weight, and describes the missing instruments.

### Finding 6 — broken reproducibility and untraceable results

**Status: engineering reproducibility fixed; research evidence explicitly not fixed.**

- The YOLO checkpoint is included in the release and pinned by SHA-256.
- The SAM2 source commit and checkpoint URL/SHA-256 are immutable.
- Python dependencies and packaging tools are exactly pinned.
- The container embeds the code revision, deterministic seed, model paths, and trusted hashes.
- The release generator now preserves the public repository metadata while replacing the published snapshot from the source tree.
- The old hand-written point-PCI/performance sample was replaced by a v2 interval-contract fixture. Its output is marked `synthetic_fixture_only_not_research_evidence`, system metrics are null, and `research_claim_permitted` is always false.

There is still no archived real-survey benchmark with manual six-parameter ground truth. No code change can create that evidence. PCI 82.4, “8 CBIT surveys,” synthetic sample metrics, and any paper-grade accuracy/generalization claims remain void and are not reproduced. A real evaluation dataset, independent labels, engineer review, uncertainty analysis, and an archived run bundle remain future research gates.

### Finding 7 — report generator `NameError`

**Status: fixed.**

- ReportLab names are imported in the scope used by the style helper.
- The backend report is a bounds/evidence report, not a compliance certificate.
- A smoke test executes the generator and verifies a non-empty PDF with a PDF header.

### Finding 8 — fabricated crack widths and lengths

**Status: fixed.**

- Deleted type-based width/length priors and PCI/detection-count multipliers.
- Missing physical width and length values remain `null` and render as “not measured.”
- Recommendations no longer claim an invented opening was measured.

### Finding 9 — frames relabeled as sections

**Status: fixed.**

- Customer PDFs consume the real 100 m section artifact.
- Per-frame records are presented only as detection evidence and have `pci_score: null`.
- Removed fixed 10 m row lengths, frame-derived section tables, point gauges, and compliance stamps.

### Finding 10 — inconsistent camera geometry and altitude ambiguity

**Status: fixed for the currently supported measurements.**

- GSD uses SRT relative altitude (AGL) only; absolute altitude (MSL) is retained separately and is never accepted as a fallback.
- The job must provide horizontal FOV, sensor width plus focal length, or an explicit operator GSD estimate.
- Calibration source and relative error are mandatory.
- GSD error is propagated to area with `(1 − e)²` and `(1 + e)²` bounds and included in every measured section value.
- Hardcoded DJI camera profiles, default altitude, default depth, and crack-width calculations were removed from the active measurement chain.

### Finding 11 — bbox substituted for a SAM mask

**Status: fixed.**

- SAM2 model, frame, or box failure raises.
- Empty masks raise.
- Bounding-box area is never substituted for segmentation area.
- Every included area is labeled as SAM-mask-derived.

### Finding 12 — uncited scoring constants

**Status: fixed on the scoring surface.**

- Deleted the pothole cap, linear `100 − 28 PN`, extent multiplier, rut scale, width priors, default altitude, and fixed frame length.
- Remaining scorer coefficients are annotated to Table 5.4, Table 5.5, Clause 7.5.3.4, or Appendix-2.
- The spatial overlap threshold is an explicitly named deduplication algorithm parameter, is recorded in provenance, and does not masquerade as an IRC coefficient.

### Finding 13 — dead, stub, and divergent code

**Status: fixed.**

- Deleted the broken local entrypoint, legacy multi-video processor, duplicate SRT parsers, empty pipeline stubs, DepthPro shim, and obsolete per-frame report paths.
- Kept one SRT parser, one section builder, one scorer, and one active worker handler.
- Replaced the empty spatial-dedup module with the georeferenced production implementation.
- The release script now synchronizes the public backend checkout from the verified worker and preserves its `.git` directory.

### Finding 14 — scorer mocked in tests

**Status: fixed.**

- Tests call the real equation and partial-scoring functions.
- All nine Appendix-2 input rows are encoded.
- Contract coverage includes road-class dispatch, all five MDR surfaces, mandatory surface selection, null unmeasured parameters, the 72-point interval, pothole area conversion, zero-detection state, detector failure, unusable sections, provenance, and mandatory deduplication.
- Utility tests exercise real GSD uncertainty, SRT altitude semantics, sectioning, and spatial deduplication.
- A PDF smoke test calls the real generator.

### Finding 15 — Docker dependency constraints discarded

**Status: fixed.**

- Uses the CUDA 12.1 / cuDNN 9 PyTorch 2.4.1 runtime base.
- Uses Debian packages `libgl1` and `libglib2.0-0`.
- Every Python dependency is exactly pinned.
- SAM2 is installed from commit `c2ec8e14a185632b0a5d8b161928ceb50197eddc`.
- Both model files are verified during build and again at model load against fixed SHA-256 values.
- Model clients and storage/network clients are not created as persistent module-level TCP clients.

### Finding 16 — inconsistent output fields and unsupported landing claims

**Status: fixed.**

- IRI and all other unmeasured values are consistently `null`.
- Missing PCI is never coerced to zero.
- All code uses the six Table 5.5 bands.
- Removed unsupported GPS-accuracy, section-count, detection-count, pixel-accuracy, point-PCI, and compliance claims from active product surfaces.
- Removed the flexible legacy scorer signature that silently accepted wrong argument types.

## Production data contract

Each scored section contains:

```json
{
  "irc_edition": "IRC:82-2023",
  "assessment_scope": "partial",
  "road_class": "URBAN",
  "surface_type": null,
  "section_length_m": 100.0,
  "carriageway_width_m": 7.0,
  "section_area_m2": 700.0,
  "measured": {
    "cracking": {"area_m2": "measured", "extent_pct": "derived", "sub_index": "derived"},
    "pothole": {"area_m2": "measured", "number": "area / 0.1", "sub_index": "derived"}
  },
  "unmeasured": {
    "ravelling": null,
    "patching": null,
    "rut": null,
    "roughness": null
  },
  "measured_weight_fraction": 0.28,
  "unmeasured_weight_fraction": 0.72,
  "pci_complete": null,
  "pci_bounds": {"lower": "derived", "upper": "derived", "width": 72.0},
  "provenance": {
    "models": "SHA-256 records",
    "seed": 1337,
    "gsd": "source and uncertainty",
    "code_commit": "immutable revision"
  }
}
```

The values shown as strings above describe provenance categories; production payloads contain numeric measurements.

## Verification gates

The release gate uses:

```bash
npm run lint
npm run typecheck
python -m unittest discover -s worker/tests -v
npm run eval:fixture
npm run build
docker buildx build --platform linux/amd64 --load -f worker/Dockerfile worker
docker run --rm --entrypoint python <image> -m unittest discover -s tests -v
```

Pre-publication results on 2026-07-11:

- `npm run verify`: passed (ESLint, TypeScript, local worker suite, bounded synthetic contract fixture, and Next.js production build).
- Local worker suite: 41 tests discovered, 38 passed and 3 dependency-specific skips because the host Python lacks NumPy/ReportLab.
- `linux/amd64` container suite: 41/41 passed with no skips, including SAM batching, NumPy paths, and the real PDF smoke test.
- Container `pip check`: `No broken requirements found.`
- Imported OpenCV distribution/runtime: `4.12.0.88` / `4.12.0`.
- YOLO SHA-256: `138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3`.
- SAM2 SHA-256: `6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38`.
- Supabase project `xkwzxuduyhgmbcryfkob`: `ACTIVE_HEALTHY`; migration `20260711123936_partial_pci_bounds` is applied; live `information_schema` returned all four nullable interval-contract columns.

Final publication record:

- Verified source/image commit on `SreekarAditya/drisora` `main`: `5d741ad5cf0eaa9ff9da4ea4182302ab843a5a3a`.
- Synchronized public `SreekarAditya/drisora-backend` `main`: `97c7012cec072ee20d24e7dc3a75a74eb7c2ec17`.
- Container tag: `sreekaraditya/drisora-worker:serverless-pass2-5d741ad5cf0e`.
- Immutable multi-platform image digest used by RunPod: `sha256:b673d59ab7034d0c44a8b0c683cc8196d23395939a47c6602aee5abb081462c6`.
- Executable `linux/amd64` manifest: `sha256:66688539b84d38596fc63f1794bb9b79e0b173f1918b06b002f3eebee9b209ae`; its OCI metadata reports `DRISORA_BUILD_SHA` and `org.opencontainers.image.revision` as the verified source commit above.
- RunPod endpoint `d457qtzarj30v5` references serverless template `8vnf9yq94x`, which was re-read after update with the exact digest-qualified image and `python handler.py`; no RunPod API key or obsolete depth keys are present in template environment metadata.
- Supabase project `xkwzxuduyhgmbcryfkob` is `ACTIVE_HEALTHY`; migration `20260711123936_partial_pci_bounds` is applied, and live schema inspection confirmed nullable `pci_lower`, `pci_upper`, `pci_complete`, and `partial_pci_sections_key` columns.

## Remaining research boundary

This remediation makes the software honest and reproducible. It does **not** make the system a validated paper result, certified engineering survey, or autonomous replacement for IRC-required instruments. Those claims require real surveys, archived source media and telemetry, manual/instrumented six-parameter reference measurements, independent review, and a preregistered evaluation. Until those gates are complete, only the partial bounded assessment described here is supported.
