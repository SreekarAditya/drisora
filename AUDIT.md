# DRISORA FULL CODEBASE AUDIT — Research-Grade Integrity (Pass 1: Audit Only)

**Date:** 2026-07-11
**Scope:** `/Users/sreekaraditya/Desktop/drisora` (Next.js platform + `worker/` backend) and the public release snapshot `dist/drisora-backend/`.
**Method:** Every finding below was verified by reading the implementation. Two findings (the PDF `NameError` and the scorer's numeric behavior) were additionally verified by executing the actual code. No code was changed in this pass.

**Standard applied:** a number is research-grade only if it is (a) produced by code that runs in the production path, (b) on real input data, (c) deterministically or with a fixed seed, and (d) would survive a reviewer reading the public backend repo.

---

## Executive summary

The deployed scoring pipeline (RunPod serverless, `worker/handler.py`) computes a per-frame composite in which **58% of the weight is hardcoded constants**, one of the three "measured" terms is **dimensionally meaningless** (rut depth from the standard deviation of a depth map × 0.3 × 1000), and every failure mode **silently substitutes a plausible number** (50.0 on exception, ~100 "Excellent" on detector failure). The IRC:82-2023 sectioning, GSD calibration, and RPCI code that the README describes as *the* pipeline **exists but is not wired into the production path** — it is reachable only from a local CLI script, and its PDF report generator **crashes unconditionally with a `NameError`** (verified by execution). The published "PCI = 82.4" / "8 CBIT drone surveys" figures are **not traceable to anything in either repo**: no raw inputs, no outputs, no manifests, no mention of the number. The paper draft is an honest scaffold with every results field blank.

Verdict (justified at the end): **not submittable** to an IF 11.5 journal in its current state.

---

## Finding 1 — 58% of every PCI score is a hardcoded constant; IRI is never computed

**Severity:** BLOCKER
**Location:** [worker/pipeline/pci_scorer.py:204](worker/pipeline/pci_scorer.py:204), :207, :209, :217, :219–226

**Evidence:**

```python
ce = _crack_extent_pct(detections, frame_area_px)
re = 0.0                                   # ravelling extent — hardcoded
pn = _pothole_count(detections)
pothole_extent_pct = _pothole_extent_pct(detections, frame_area_px)
pe = 0.0                                   # patching extent — hardcoded
rd = _rut_depth_mm(depth_map)
iri = None                                 # roughness — never computed

individual_scores = {
    "cracking": pci_cracking(ce),
    "ravelling": pci_ravelling(re),        # pci_ravelling(0.0) == 100.0 always
    "pothole": min(pci_pothole(float(pn)), 100.0 - min(85.0, pothole_extent_pct * 12.0)),
    "patching": pci_patch(pe),             # pci_patch(0.0) == 100.0 always
    "rut": pci_rut(rd),
    "roughness": 100.0,                    # hardcoded
}
pci = (
    0.40 * individual_scores["roughness"]
    + 0.16 * individual_scores["pothole"]
    + 0.14 * individual_scores["rut"]
    + 0.12 * individual_scores["cracking"]
    + 0.10 * individual_scores["ravelling"]
    + 0.08 * individual_scores["patching"]
)
```

**What it actually does:** Roughness (weight 0.40), ravelling (0.10), and patching (0.08) are constants: `0.40·100 + 0.10·100 + 0.08·100 = 58.0` points of every PCI are invariant to the pavement. Only pothole (0.16), rut (0.14), and cracking (0.12) respond to data at all — and rut is itself pseudo-data (Finding 2). The `iri` field is emitted as `null` in every production score. The PCI floor is 58 for any road, however destroyed, unless the pothole cap (Finding 6) engages.

**Why it fails the standard:** (a) and (b) — the dominant terms are not produced by code running on data; they are literals.

**Impact on published numbers:** For any reported PCI of value *P*, 58 of those points are constants; e.g., a hypothetical PCI = 82.4 would be **70% constant** (58/82.4), with only 24.4 points traceable to imagery — of which up to 14 come from the meaningless rut term. Verified numerically: the scorer's actual dynamic range in production is [25, 100] (bounded below by the pothole cap floor, not by distress math).

**Remediation options (do not implement in this pass):**
1. Drop roughness/ravelling/patching from the composite and renormalize the remaining weights, reporting a 3-component index honestly (hours).
2. Add real roughness (e.g., IRI proxy from consecutive-frame depth profiles or vehicle IMU) and detect ravelling/patching with a model trained for those classes (weeks–months).
3. Report only defect detections + extents and remove the composite PCI claim entirely (days).

---

## Finding 2 — Rut depth in millimetres is dimensionally meaningless and noise-driven

**Severity:** BLOCKER
**Location:** [worker/pipeline/pci_scorer.py:177](worker/pipeline/pci_scorer.py:177)–191 (formula at :188); [worker/pipeline/depth_anything_v2_inference.py:22](worker/pipeline/depth_anything_v2_inference.py:22)

**Evidence:**

```python
top_third = arr[: max(1, arr.shape[0] // 3), :]
top_third = top_third[np.isfinite(top_third)]
...
return max(0.0, float(np.std(top_third)) * 0.3 * 1000.0)
```

**What it actually does:** "Rut depth (mm)" = standard deviation of the depth map over the **top third of the frame** (in a nadir drone shot, an arbitrary strip; in a handheld shot, often the horizon/sky) × an unexplained scale factor 0.3 × 1000. The depth checkpoint is `Depth-Anything-V2-Metric-VKITTI-Large` — a metric model fine-tuned on **Virtual KITTI**, synthetic forward-facing driving imagery, applied here to nadir drone frames far outside its training domain. Even granting metric-ish output, the std of scene depth is dominated by camera tilt, terrain slope, and model noise, not transverse rut profile; IRC-style rut depth requires a straightedge/transverse profile measurement.

**Executed verification:** scoring an empty (defect-free) frame with a synthetic 30 m depth map:
- depth noise σ = 1 m → `rut_depth_mm = 300.2`, rut score 0.08, **PCI = 86.0 "Good"**
- depth noise σ = 0.05 m → `rut_depth_mm = 15.0`, rut score 25.2, PCI = 89.5
- depth disabled → rut = 0 → rut score 100, **PCI = 100.0 "Excellent"**

The same clean road scores 86, 89.5, or 100 depending on depth-map noise and a feature toggle. The 0.14-weight rut term is a random-number generator seeded by scene geometry.

**Why it fails the standard:** (b) — the number is not a measurement of the quantity it is named after; (d) — a reviewer computing `np.std(depth)·0.3·1000` will identify this immediately.

**Impact on published numbers:** Up to 14 PCI points per frame are noise. In depth-enabled drone jobs the rut score collapses toward 0 for any realistic depth variance, silently deducting ~14 points from every frame including clean pavement.

**Remediation options:**
1. Remove rut from the composite until a defensible transverse-profile method exists (hours).
2. Fit a plane to the road surface region and measure residual depression along detected wheel paths, with uncertainty reporting (weeks).
3. Declare rut "not measured" in output schema (`rut: null`) as is already done for IRI (hours).

---

## Finding 3 — Silent fallbacks fabricate plausible scores on every failure path

**Severity:** BLOCKER
**Location:** [worker/pipeline/pci_scorer.py:92](worker/pipeline/pci_scorer.py:92)–114 and :252–254; [worker/handler.py:612](worker/handler.py:612)–633, :741–746, :1033, :1081; [worker/pipeline/yolo_inference.py:139](worker/pipeline/yolo_inference.py:139)–141 and :165–170; [worker/pipeline/depth_anything_v2_inference.py:35](worker/pipeline/depth_anything_v2_inference.py:35), :131–143, :235

**Evidence (four independent fabrication paths):**

```python
# pci_scorer.py — any exception in scoring:
except Exception as e:
    print(f"[PCI] scoring failed: {e}")
    return _safe_fallback()          # returns pci=50.0, all subscores 50.0

# handler.py — any exception in a frame:
except Exception as exc:
    ...
    pci_result = _fallback_pci(str(exc))   # pci=50.0, folded into the average at :1033

# handler.py:1081 — zero frames:
average_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 50.0

# yolo_inference.py — detector failure:
except Exception as e:
    print(f"[YOLO] frame {frame_index} inference failed: {e}")
    return []                         # scorer sees "no defects" → PCI ≈ 100 "Excellent"
```

Plus in the depth module: `DEFAULT_DEPTH_M = 1.0` returned when the depth lookup fails (`_center_depth`), and `pixel_size_m = ... if focal_length_px > 0 else 0.01` — fabricated camera geometry that flows into `mask_area_m2` and `crack_width_mm`.

**What it actually does:** No failure surfaces as a failure in the score. A crashed scorer yields "Fair, 50.0"; a crashed detector yields "Excellent, ~100"; a failed depth lookup yields 1.0 m camera distance and 1 cm pixels. Fallback frames are averaged into `average_pci` with equal weight (handler.py:1033) — the headline number can contain an arbitrary mixture of measured and invented frames. (Mitigating note: `degraded_reason_counts` and `analysis_stage` are recorded in `processing_summary.json`, so contamination is *detectable* post hoc — but nothing prevents or flags it in the reported PCI itself.)

**Why it fails the standard:** (a)+(b) — a reported figure may not have been produced by the pipeline running on data at all. The YOLO path is the worst case: an infrastructure failure produces the *best possible* score.

**Impact on published numbers:** Any survey mean PCI is potentially a blend of real scores, 50.0 constants, and ~100 "detector-crashed" frames, indistinguishable in the headline number. A reviewer who greps `_safe_fallback` in the public repo will ask exactly this question.

**Remediation options:**
1. Fail closed: raise on scorer/detector exceptions; exclude failed frames from the average and report `failed_frame_count` prominently (days).
2. Emit `pci: null` for degraded frames and make all aggregations null-aware (days).
3. At minimum, hard-fail the job when `degraded_frame_count / frame_count` exceeds a threshold (hours).

---

## Finding 4 — Production PCI is a flat per-frame average; the IRC 100 m sectioning code never runs in production

**Severity:** BLOCKER
**Location:** [worker/handler.py:735](worker/handler.py:735) (per-frame scoring), :1033 and :1081 (flat average); [worker/utils/pci_segmentation.py:22](worker/utils/pci_segmentation.py:22) (the unwired sectioning module); [worker/run_single_video.py:19](worker/run_single_video.py:19) (the only caller); [worker/utils/multi_video_processor.py:11](worker/utils/multi_video_processor.py:11)–13 (self-declared legacy)

**Evidence:** `handler.py` imports only `depth_anything_v2_inference, pci_scorer, sam2_inference, yolo_inference` (line 27). Grep confirms `utils/pci_segmentation.py` (100 m Haversine chainage, SRT-altitude GSD, RPCI flags, `SEGMENT_LENGTH_M = 100.0`) is imported **only** by `run_single_video.py` (a local CLI), the dead `multi_video_processor.py`, and tests. The deployed handler does:

```python
pci_result = pci_scorer.score(detections, frame_area_px=frame_area_px, depth_map=depth_map)  # per frame
...
pci_scores.append(float(frame_result["pci_score"]))
...
average_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 50.0
```

`multi_video_processor.py` says so itself: *"This is a legacy survey-level helper. The active RunPod path builds a `drone_footage` multi-video payload and dispatches through `jobs.dispatcher`."* Its GPS dedup (`utils/gps_dedup.py`) is therefore also dead in production. The `pci_segments` Supabase table (migration `009_multi_video_survey.sql:100`) has **zero producers or consumers** in app code.

**What it actually does:** Production PCI = arithmetic mean of per-frame PCIs over *all extracted frames*, with `all_frames` as the default extraction mode ([worker/jobs/dispatcher.py:84](worker/jobs/dispatcher.py:84)–97). At 30–60 fps with no cross-frame deduplication, every pavement point is scored dozens of times; a pothole visible for 3 seconds contributes ~90 capped frames to the mean. **The average measures fraction-of-flight-time-over-defects, not distress density per length of road.** Even in the local CLI path, `compute_segment_pci` (pci_segmentation.py:349–374) just averages the same per-frame PCIs within each 100 m bucket — section-level distress extents are never recomputed over section area, so it is per-frame PCI with a GPS grouping, not IRC section PCI. There is an RPCI (`is_relative`) mechanism for sub-100 m sections — but only in this unwired path.

**Why it fails the standard:** (a) — the sectioning the README/paper describe is not the code that runs; (d) — a reviewer will diff `handler.py` against the README architecture diagram in minutes.

**Impact on published numbers:** Any survey-level PCI from the deployed product is a duplicate-weighted frame average. It is not comparable to an IRC section PCI, and its value depends on flight speed, frame rate, and hover time — three variables with no pavement meaning.

**Remediation options:**
1. Wire `build_pci_sections` + GPS dedup into `handler.py` for drone jobs, and report section PCIs as primary (days).
2. Weight the frame average by inter-frame chainage distance as a stopgap, and label the output "frame-average condition indicator", not PCI (days).
3. Keep per-frame scores as diagnostics only; make section PCI the sole survey metric (days–week).

---

## Finding 5 — The IRC:82-2023 compliance claim is unsupported: no clause mapping, uncited equations, undetectable distress classes

**Severity:** BLOCKER
**Location:** [worker/pipeline/pci_scorer.py:16](worker/pipeline/pci_scorer.py:16) (`IRC_STANDARD = "IRC:82-2023"` stamped on every payload), :21–75 (uncited equations); [README.md:3](README.md:3), :18, :123 (bibtex); [NOTICE.md](NOTICE.md) ("This repository implements scoring logic" of IRC:82-2023); [components/pdf/JobReport.tsx:578](components/pdf/JobReport.tsx:578) and :677 ("IRC:82-2023 COMPLIANCE STAMP"); [app/landing/page.tsx:340](app/landing/page.tsx:340) ("IRC:82-2023 COMPLIANT")

**Evidence (the equations, verbatim):**

```python
def pci_cracking(ce):  ... 7231.0 / (ce**2 - 0.737*ce + 73.09)
def pci_ravelling(re): ... 52.92*exp(-0.02525*re) + 44.1*exp(-0.2899*re)
def pci_pothole(pn):   ... 100.0 - 28.0*pn
def pci_rut(rd):       ... 7231.0 / (rd**2 - 0.737*rd + 73.09)   # identical curve reused for a different distress
def pci_roughness(iri): ... 100.0 / (iri**1.91 - 3.542*iri + 4.315)
```

**What it actually does:**
- **No provenance.** Not one coefficient (7231, 73.09, 0.737, 52.92, 0.02525, 44.1, 0.2899, 28.0, 1.91, 3.542, 4.315) or the weight vector (0.40/0.16/0.14/0.12/0.10/0.08) carries a citation anywhere in the repo — no clause number, no paper, no comment. The functional forms resemble academic Indian OPCI regression models (cf. Shah et al. 2013, *Development of Overall Pavement Condition Index for Urban Road Network*), not deduct-curve procedures. This is **neither IRC:82-2023's published method nor ASTM D6433** (which uses tabulated deduct curves with severity levels and a corrected-deduct procedure — none of which exists here). The cracking curve is reused verbatim for rutting with different units (% vs mm), which no standard does.
- **Severity is absent.** IRC/ASTM distress scoring is (type × severity × extent). This code has no severity dimension at all.
- **Undetectable distresses.** The detector is RDD2022-trained with classes `D00, D10, D20, D40` ([worker/pipeline/yolo_inference.py:24](worker/pipeline/yolo_inference.py:24)) — longitudinal/transverse/alligator cracks and potholes. The model **physically cannot detect** ravelling, patching, rutting, or roughness. The code papers over this by hardcoding ravelling/patching extents to 0 (i.e., "perfect"), pseudo-measuring rut from depth noise, and hardcoding roughness to 100 (Findings 1–2).
- **The internal docs know this.** [docs/DRISORA_PCI_REPRODUCIBILITY_REPAIR_LOG.md:64](docs/DRISORA_PCI_REPRODUCIBILITY_REPAIR_LOG.md:64): *"The current PCI scorer is an application-level engineering heuristic, not yet a validated certified PCI engine."* The public README, NOTICE, bibtex title ("…for IRC:82-2023 Road Surveys"), landing page, and a literal "COMPLIANCE STAMP" on customer PDFs say otherwise.

**Why it fails the standard:** (d) categorically — this is the load-bearing claim of the paper, and the public repo contradicts it.

**Impact on published numbers:** Every score labeled `irc_standard: "IRC:82-2023"` is mislabeled. In a journal submission this is not a limitation, it is a misstatement.

**Remediation options:**
1. Rename the metric (e.g., "Drisora Composite Condition Index, drisora_pci_v1") everywhere, describe it as heuristic, and cite the actual equation source if one exists (days).
2. Implement the actual IRC:82-2023 procedure for the distresses the system can measure, and state explicitly which it cannot (weeks).
3. Keep IRC:82-2023 only as the *reporting format* (bands/terminology) and say exactly that, removing "compliant"/"COMPLIANCE STAMP" language (days).

---

## Finding 6 — Reproducibility chain is broken end-to-end; the PCI=82.4 / 8-survey CBIT claim is untraceable

**Severity:** BLOCKER
**Location:** [scripts/download_models.sh:34](scripts/download_models.sh:34)–39; `worker/weights/` (git-tracked content: `.gitkeep` only); [worker/requirements.txt](worker/requirements.txt); [worker/Dockerfile:27](worker/Dockerfile:27)–29; [dist/drisora-backend/worker/Dockerfile](dist/drisora-backend/worker/Dockerfile) (`COPY weights/ weights/`); [docs/DRISORA_SYSTEM_PAPER_DRAFT.md:9](docs/DRISORA_SYSTEM_PAPER_DRAFT.md:9)–19

**Evidence:**
- **The detector cannot be obtained.** `git ls-files worker/weights` → `.gitkeep`. `download_models.sh` has no YOLO URL: *"Set DRISORA_YOLO_WEIGHTS_URL to download the YOLOv12s RDD2022 checkpoint."* No such URL is published anywhere in the repo. A reviewer cloning `drisora-backend` stops at step 1.
- **The public release image cannot build.** `dist/drisora-backend/worker/Dockerfile` contains `COPY weights/ weights/` but the release ships no `weights/` directory → the build fails at that instruction. (The local `worker/Dockerfile` could not be build-verified in this audit — the Docker daemon is unavailable on this machine — but static review found no fatal instruction; note the base image is `pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime`, so the `libgl1-mesa-glx`/trixie concern does not apply — it correctly installs `libgl1`.)
- **Dependencies float.** `requirements.txt` pins nothing (`ultralytics>=8.0.0`, bare `numpy`, `torch` not even listed — inherited from the base image). SAM2 is installed from git HEAD (`git+https://github.com/facebookresearch/sam2.git`, no commit); Depth-Anything-V2 is `git clone --depth 1` of master at build time. Model weights are fetched at runtime by URL with no expected-hash check ([worker/pipeline/sam2_inference.py:26](worker/pipeline/sam2_inference.py:26)–29). The run manifest records SHA256s *after the fact* (good forensics, no pinning).
- **The claimed figures do not exist in the repo.** A full-text search for `82.4` across both repos returns nothing. "CBIT" appears once, in a UI mockup ([docs/drisora_opus_frontend_prompt.md:306](docs/drisora_opus_frontend_prompt.md:306)). There are no archived survey inputs, outputs, manifests, or evaluation exports for any real survey. The paper draft's entire Results section is blank placeholders, and [docs/DRISORA_RESEARCH_READINESS.md](docs/DRISORA_RESEARCH_READINESS.md) says "Real-survey dataset: **Not started in repo**." The only computed evaluation output ([evaluation/output/sample/paper_tables.md](evaluation/output/sample/paper_tables.md): PCI MAE 2.67, F1 = 1, 214.3 frames/min, $0.41/job) is generated from a **hand-written synthetic fixture** (`evaluation/fixtures/sample_export.json`), not from any pipeline run.
- **Positive note:** determinism plumbing is genuinely present — seed 1337, `torch.use_deterministic_algorithms`, `CUBLAS_WORKSPACE_CONFIG`, deterministic ffmpeg extraction with frame-count validation ([worker/handler.py:36](worker/handler.py:36)–63, [worker/ingest/video_handler.py:200](worker/ingest/video_handler.py:200)–207), and run/frame manifests with SHA256s. This is criterion (c) done reasonably; it does not rescue (a), (b), (d).

**Why it fails the standard:** (b) — no real data is archived; (d) — the reproduction walk breaks at weights, again at the public Dockerfile, and again at floating deps.

**Impact on published numbers:** Nothing quantitative in the intended paper is currently reproducible by anyone, including the author. PCI = 82.4 has no chain of custody whatsoever.

**Remediation options:**
1. Publish the YOLO checkpoint (HF Hub) with SHA256 pinned in the repo; pin `requirements.txt` (`pip freeze`), SAM2/DAv2 by commit hash, and weights by expected hash (days).
2. Archive one complete real survey (raw video+SRT, manifests, detections, scores, evaluation export) as the paper artifact, e.g. Zenodo (days, given data exists).
3. Fix the release script so `dist/drisora-backend` builds and matches deployed code (days).

---

## Finding 7 — The backend PDF report generator crashes unconditionally (verified by execution)

**Severity:** BLOCKER
**Location:** [worker/pipeline/report_generator.py:24](worker/pipeline/report_generator.py:24)–27 (function-local imports), :54 (first `_table_style()` call), :76–93 (module-level function referencing them)

**Evidence:**

```python
def generate_irc82_pdf_report(...):
    try:
        from reportlab.lib import colors          # local to this function
        ...
    story.append(Table(report_rows, colWidths=[140, 330], style=_table_style()))  # line 54

def _table_style(header: bool = False) -> TableStyle:   # module level
    commands = [("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B8C0CC")), ...]  # `colors` not in scope
```

**Executed verification:** with reportlab stubbed importable, calling `generate_irc82_pdf_report(...)` raises:

```
NameError: name 'colors' is not defined
```

**What it actually does:** `colors` and `TableStyle` are imported inside `generate_irc82_pdf_report`, but `_table_style` is a module-level function whose name lookups resolve in module globals — where they don't exist. The function cannot complete for any input. Therefore the "IRC:82-2023 PDF report" advertised as a backend output ([README.md:19](README.md:19) "JSON + PDF report output", :102 `report.pdf`) **has never been produced by this code**, and `run_single_video.py` (the only path exercising the 100 m sectioning) crashes at its final step (line 91) on every run — after writing `results.json`, so partial outputs may exist while the advertised deliverable does not.

**Why it fails the standard:** (a) — the claimed output is produced by code that cannot run. It is also direct evidence that the local sectioning path was never executed end-to-end.

**Impact on published numbers:** Any claim that the backend emits IRC PDF reports is false as written. (The *customer-facing* PDF is a separate Next.js path — see Finding 9.)

**Remediation options:**
1. Move the reportlab imports to module level guarded by try/except, or pass style objects in (minutes).
2. Add one smoke test that actually calls the generator (hours).

---

## Finding 8 — The platform fabricates crack widths and lengths from type-based priors

**Severity:** MAJOR
**Location:** [lib/crack-metrics.ts:117](lib/crack-metrics.ts:117)–148; consumed at [lib/jobs/results.ts:162](lib/jobs/results.ts:162)–191 and [app/report/[id]/page.tsx:214](app/report/[id]/page.tsx:214)

**Evidence:**

```ts
function typeWidth(type: string) {
  if (value.includes("alligator") ...) return { avgWidthMm: 4.5, maxWidthMm: 7,   lengthM: 5.4 };
  if (value.includes("transverse"))    return { avgWidthMm: 2.8, maxWidthMm: 4.2, lengthM: 2.6 };
  if (value.includes("longitudinal"))  return { avgWidthMm: 2.4, maxWidthMm: 3.6, lengthM: 4.2 };
  return { avgWidthMm: 2.5, maxWidthMm: 3.8, lengthM: 2.2 };
}
const pciFactor = pci < 40 ? 1.45 : pci < 55 ? 1.28 : pci < 70 ? 1.12 : pci < 85 ? 1 : 0.82;
const densityFactor = crackCount >= 8 ? 1.18 : crackCount >= 4 ? 1.08 : 1;
```

**What it actually does:** When measured widths are absent (which includes every depth-disabled or depth-failed frame), the UI/report layer **invents** millimetre widths from a lookup table scaled by PCI band and detection count, and invents crack lengths in metres per type (`lengthM` priors × count × a hardcoded `sectionLengthM: 10`). These appear in the customer PDF next to real measurements. Mitigations exist — an `estimated` flag renders as "est."/"legacy estimate" in several views ([components/pdf/JobReport.tsx:378](components/pdf/JobReport.tsx:378), [components/results/jobs/ImageBatchResults.tsx:92](components/results/jobs/ImageBatchResults.tsx:92)) — but the PDF methodology text claims *"Crack width in millimeters is estimated by converting pixel measurements using the available depth and camera geometry"* ([components/pdf/JobReport.tsx:663](components/pdf/JobReport.tsx:663)), which is false for prior-derived values, and [lib/civil-intelligence.ts](lib/civil-intelligence.ts:44) phrases recommendations as "because the **measured** opening is below 3 mm". Note also [lib/jobs/results.ts:164](lib/jobs/results.ts:164) coerces a missing PCI to `0`, which pushes `pciFactor` to the 1.45 worst-case inflator.

**Why it fails the standard:** (b) — numbers presented as physical measurements are not computed from data.

**Impact on published numbers:** Any width/length statistic sourced from platform exports may be partially or wholly synthetic. If the paper reports crack-width distributions, they must come exclusively from the worker's `crack_width_mm` (which has its own problems — Finding 10), never from this layer.

**Remediation options:**
1. Return `null` instead of estimating; render "not measured" (days, UI churn).
2. Keep estimates but label the *values* (not just a footnote) and correct the methodology text (days).

---

## Finding 9 — The customer PDF relabels individual frames as "10 m sections" with a compliance stamp

**Severity:** MAJOR
**Location:** [components/pdf/JobReport.tsx:346](components/pdf/JobReport.tsx:346) ("10 m section summary"), :360–367 (`rows.map((frame ...` with `sectionLengthM: 10`), :578 and :677 (compliance stamps); dead RPCI table at :98, :641 (prop `pciSegments` never passed — [app/api/jobs/[id]/report/route.ts:50](app/api/jobs/[id]/report/route.ts:50)–54 supplies only `results, surveyDate, orgName`)

**Evidence:** The "Section Summary Table" iterates frames and prints each as a section row; every frame is assigned a fictitious 10 m length. The honest segment table (with the RPCI footnote "*Relative PCI computed for road section < 100m coverage…*") is dead code: its `pciSegments` prop has no producer anywhere in the codebase, consistent with Finding 4 (nothing computes segments in production).

**What it actually does:** Fabricates chainage. The deliverable a PWD engineer receives presents per-frame scores as fixed-length road sections under an "IRC:82-2023 COMPLIANCE STAMP", while the landing page says "Drisora scores every 10 m section" ([app/landing/page.tsx:556](app/landing/page.tsx:556)) and the README says 100 m — three mutually inconsistent section stories, none implemented.

**Why it fails the standard:** (a), (d).

**Impact on published numbers:** Any figure or screenshot of the report in the paper embeds the frame≠section misrepresentation.

**Remediation options:** 1. Relabel the table "Frame summary" and remove per-row lengths (hours). 2. Implement real sectioning (Finding 4) and feed `pciSegments` (days).

---

## Finding 10 — Measurement chain: hardcoded FOV, three inconsistent camera models, and a metric normalization that cancels out

**Severity:** MAJOR
**Location:** [worker/pipeline/depth_anything_v2_inference.py:36](worker/pipeline/depth_anything_v2_inference.py:36) (`FOV_RADIANS = 1.0`), :146–147, :225–243; [worker/utils/gsd_calibration.py:11](worker/utils/gsd_calibration.py:11)–13 (DJI Mini 5 Pro constants); [worker/utils/multi_video_processor.py:30](worker/utils/multi_video_processor.py:30) (Mavic 3, 73.7°); [worker/pipeline/pci_scorer.py:125](worker/pipeline/pci_scorer.py:125)–147; [worker/ingest/srt_parser.py:119](worker/ingest/srt_parser.py:119)–128

**Evidence and what it actually does:**
- **Production GSD** comes from `pixel_size_m = depth_m / focal_length_px` with `focal_length_px = width / (2·tan(FOV/2))` and `FOV_RADIANS = 1.0` (≈57.3°) — a hardcoded guess matching no DJI camera (Mini-series ≈ 82–84°, Mavic 3 ≈ 73.7° — which two *other* modules hardcode differently). EXIF/SRT intrinsics are never read. GSD error is systematic; **area error is quadratic**: a FOV of 82° treated as 57.3° understates pixel size ~1.5× and mask areas ~2.2×.
- **`mask_area_m2` and `crack_width_mm` inherit this**, plus `DEFAULT_DEPTH_M = 1.0` on depth-lookup failure (a drone at 30 m gets 1 m camera distance → 30× width error, 900× area error, silently).
- **The metric crack-extent path is circular.** `_crack_extent_pct` computes `crack_area_m2 / (frame_area_px · mean(mask_area_m2/mask_area_px))` — the pixel-size factor appears in numerator and denominator and cancels. **Executed verification:** metric path 1.5000000000000002 vs pixel path 1.5 for identical masks. Depth contributes *nothing* to crack extent; the pipeline's headline "metric" claim adds no information to the PCI input it feeds.
- **Extent denominators are full frame area** (`_frame_area_px`, sky/roadside included) — extent is diluted by whatever non-pavement is in frame; no pavement segmentation restricts the denominator.
- **SRT altitude ambiguity (sectioning path only):** `parse_srt` prefers `rel_alt` (AGL, correct) but falls back through a generic `alt:` regex to `abs_alt` (MSL), and the compact `GPS(lon,lat,alt)` tuple altitude — typically absolute — is used when no `rel_alt` field exists. Silent MSL-as-AGL substitution (e.g., ~500 m MSL in Hyderabad vs 30 m AGL) scales the section GSD ~17× and areas ~280×. EXIF altitude (`GPSAltitude`, MSL) has the same hazard for image batches.

**Why it fails the standard:** (b) — physical quantities derive from invented camera geometry; (d) — `FOV_RADIANS = 1.0` with no comment is a one-line review kill.

**Impact on published numbers:** All `mask_area_m2` / `crack_width_mm` values carry an uncharacterized systematic error of order 2× (and 30×/900× in silent-fallback frames). Crack-extent %, and hence the cracking 12% of PCI, is unaffected by depth at all (it is a pure pixel ratio) — which at least makes it consistent, but falsifies the "metric depth feeds PCI" narrative.

**Remediation options:** 1. Read intrinsics/FOV from EXIF or a per-camera profile keyed to SRT model strings; single source of truth (days). 2. Use SRT AGL altitude for nadir GSD (the drone case) instead of monocular depth (days). 3. Propagate and report per-measurement uncertainty (weeks).

---

## Finding 11 — Silent bbox-for-mask substitution inflates crack areas when SAM2 degrades

**Severity:** MAJOR
**Location:** [worker/pipeline/sam2_inference.py:77](worker/pipeline/sam2_inference.py:77)–81, :164–168

**Evidence:**

```python
def _fallback_detection(detection):
    updated = dict(detection)
    updated["mask_area_px"] = float(updated.get("area_px") or 0.0)   # bbox area stands in for mask area
    updated["mask_area_m2"] = None
    return updated
```

**What it actually does:** On any SAM2 failure (model load, per-box predict, whole-frame exception) the detection's `mask_area_px` becomes the YOLO **bounding-box** area. For thin linear cracks, bbox area exceeds mask area by an order of magnitude or more. This flows directly into `_crack_extent_pct` and the cracking subscore with no flag on the detection itself distinguishing mask-derived from bbox-derived areas.

**Why it fails the standard:** (b) — the quantity changes definition silently mid-dataset.

**Impact on published numbers:** Crack extent (and the 12% cracking term) is not a consistent measurement across frames; mixed populations of mask and bbox areas are statistically incomparable.

**Remediation options:** 1. Mark substituted areas (`area_source: "bbox"`) and exclude them from extent stats (hours). 2. Fail the frame into the degraded path instead (hours).

---

## Finding 12 — Uncited magic constants throughout the scoring surface

**Severity:** MAJOR
**Location:** [worker/pipeline/pci_scorer.py:162](worker/pipeline/pci_scorer.py:162)–174 (`_pothole_cap` 78/65/50/35/25 with count/extent breakpoints), :214 (`pothole_extent_pct * 12.0`, cap `85.0`), :45 (`28.0` per pothole), :188 (`0.3` rut scale); [lib/crack-metrics.ts:120](lib/crack-metrics.ts:120)–123 (1.45/1.28/1.12/0.82, 1.18/1.08, 1.35, +0.8); [lib/jobs/results.ts:172](lib/jobs/results.ts:172) (`sectionLengthM: 10`); [worker/utils/multi_video_processor.py:30](worker/utils/multi_video_processor.py:30)–31 (`73.7°`, `30.0 m` default altitude); [worker/utils/gps_dedup.py:143](worker/utils/gps_dedup.py:143) (0.60 overlap threshold)

**What it actually does:** The pothole cap is the *binding constraint* on the low end of production PCI (verified: fully-distressed frame scores exactly the 25.0 cap), so the reported score for bad roads is chosen by these unexplained thresholds, not by the distress math. The internal bible calls the cap "a pragmatic application-level safety rule, not a claim that the current implementation is a certified PCI standard engine" ([docs/DRISORA_ARCHITECTURAL_BIBLE.md](docs/DRISORA_ARCHITECTURAL_BIBLE.md), §4.6) — an honesty that appears nowhere user- or reviewer-facing.

**Why it fails the standard:** (d) — every constant will be challenged; none has a source.

**Impact on published numbers:** Low-end PCI values are cap artifacts; e.g., any frame with ≥12 potholes reports exactly 25.0.

**Remediation options:** 1. Cite or derive each constant from labeled data; publish the calibration (weeks). 2. Present caps as explicit business rules separate from the index (days).

---

## Finding 13 — Dead, stub, and divergent code in the public artifact

**Severity:** MAJOR
**Location:** [worker/pipeline/spatial_dedup.py](worker/pipeline/spatial_dedup.py), [worker/pipeline/frame_extractor.py](worker/pipeline/frame_extractor.py), [worker/pipeline/geojson_builder.py](worker/pipeline/geojson_builder.py), [worker/pipeline/srt_parser.py](worker/pipeline/srt_parser.py) — all four are **empty** (license header only, zero code); [worker/pipeline/depthpro_inference.py](worker/pipeline/depthpro_inference.py) (shim re-exporting Depth Anything V2); [worker/main.py:342](worker/main.py:342)–343; `dist/drisora-backend/` (13 files diverge from `worker/`)

**Evidence (main.py, the "local testing" entrypoint):**

```python
score = score_frame(detections, depth, segments)   # wrong arg order: depth passed as frame_area_px
pci_scores.append(float(score))                    # float() on a dict → TypeError
det_record = {**detections, ...}                   # detections is a list → TypeError
```

**What it actually does:** `spatial_dedup.py` — the module named for the cross-frame deduplication axis of this audit — **contains no code at all**; production has no dedup (Finding 4) and the only real dedup lives in dead `utils/` code. `main.py` cannot execute past its first scored frame (three type errors), confirming it is unmaintained dead code shipped in the public repo. The public release snapshot diverges from the working tree in 13 files (`handler.py`, `pci_segmentation.py`, `report_generator.py` — where the dist version says "10 m sections" vs local "100 m" — `Dockerfile`, etc.): the repo a reviewer reads is not the code that runs. RF-DETR: no references found anywhere (already fully removed). DepthPro survives only as the shim and stale `yolo_sam2_depthpro` stage names in the paper draft ([docs/DRISORA_SYSTEM_PAPER_DRAFT.md:72](docs/DRISORA_SYSTEM_PAPER_DRAFT.md:72)) and evaluation sample output.

**Why it fails the standard:** (d) — empty files named after core claimed capabilities are self-incriminating in a public AGPL repo.

**Impact on published numbers:** None directly, but it invalidates the "reviewer reads the backend and finds the claimed pipeline" test.

**Remediation options (report-only; do not delete in this pass):** remove-candidates: the four empty pipeline stubs, `main.py`, `depthpro_inference.py` shim, `utils/multi_video_processor.py` (or wire it in), `pci_segments` migration (or wire it in); regenerate `dist/` from HEAD via `scripts/create_backend_release.sh` (hours).

---

## Finding 14 — Tests never exercise the scoring path; the scorer is mocked in its own test suite

**Severity:** MAJOR
**Location:** [worker/tests/test_utils.py:281](worker/tests/test_utils.py:281)–292; all of `worker/tests/`

**Evidence:**

```python
_mock_pci_scorer_module = unittest.mock.MagicMock()
_mock_pci_scorer_module.score = unittest.mock.MagicMock(
    return_value={"pci": 50.0, "individual_scores": {}}
)
```

**What it actually does:** Six test files (2,001 lines) cover: SRT parsing, GPS dedup geometry, chainage/segment assignment, weighted-summary arithmetic, SAM2/depth batching plumbing (with stub models), YOLO batching (mocked), dispatcher routing, and ffmpeg extraction. **Coverage of the scoring path: zero.** `pci_scorer.score` is never called by any test — it is replaced with a MagicMock returning 50.0 (ironically, the same value as the production fallback). No test would catch Findings 1, 2, 3, 5, 7, 10, or 11. Notably, the best-tested modules (`gps_dedup`, `pci_segmentation`) are precisely the ones **not wired into production** — the suite validates the dead code and mocks the live code. The tests that exist are real assertions (not always-pass gates), which is to their credit; the defect is what they don't touch.

**Why it fails the standard:** (d) — a reviewer running the suite gets green while every scoring defect above ships.

**Remediation options:** 1. Golden-file tests: fixed detection fixtures → exact expected PCI payloads, including fallback and degradation cases (days). 2. A tiny known-FPS video fixture through `run_single_video.py` asserting sections and report generation (days — currently impossible until Finding 7 is fixed, which is the point).

---

## Finding 15 — Dockerfile: silently discarded version constraints; build unverifiable in this audit

**Severity:** MINOR
**Location:** [worker/Dockerfile:27](worker/Dockerfile:27)

**Evidence:**

```dockerfile
RUN pip install hydra-core>=1.3.2 iopath>=0.1.10 \
    && pip install --no-build-isolation --no-deps git+https://github.com/facebookresearch/sam2.git
```

**What it actually does:** Unquoted `>=` is shell output redirection: this runs `pip install hydra-core iopath` (latest, unconstrained) and creates a stray file literally named `=0.1.10` in `/app`. The constraints are silently discarded. Otherwise: base image `pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime` is sound; `libgl1` (not the defunct `libgl1-mesa-glx`) is correctly used; layer ordering is cache-reasonable (`COPY requirements.txt` before `COPY . .`); `.dockerignore` excludes `.env*` so no secrets are baked; no module-level network clients in `handler.py` (boto3 client is created per job — correct for RunPod serverless). **Build not executed:** the Docker daemon is not running on this machine; the local Dockerfile is statically plausible, the public dist Dockerfile statically fails (Finding 6).

**Remediation options:** quote the specs (`pip install "hydra-core>=1.3.2" "iopath>=0.1.10"`) and pin SAM2 to a commit (minutes).

---

## Finding 16 — Assorted consistency defects in reported fields

**Severity:** MINOR
**Locations & evidence:**
- **`iri` semantics flip:** production scores emit `iri: null` ([pci_scorer.py:209](worker/pipeline/pci_scorer.py:209), :243) but both fallbacks emit `iri: 2.5` ([pci_scorer.py:101](worker/pipeline/pci_scorer.py:101), [handler.py:620](worker/handler.py:620)) — a fabricated roughness value that appears *only* on failed frames.
- **Missing PCI coerced to 0:** [lib/jobs/results.ts:164](lib/jobs/results.ts:164) `pci: ... : 0` — a frame with absent PCI is treated as a failed road (and inflates estimated widths ×1.45, Finding 8).
- **Landing-page numbers:** "±2 m GPS accuracy", "32 sections scored", "Pixel-level accuracy" ([app/landing/page.tsx:99](app/landing/page.tsx:99), :271, :19) have no measurement basis anywhere in the codebase.
- **Condition bands disagree:** `pci_scorer._condition_and_recommendation` uses >90/80/60/40/20 Excellent…Failed; `pci_segmentation._IRC_GRADES` uses ≥85/70/55/40/25/10 Good…Failed. Two different band systems both labeled IRC.
- **`score_frame`'s flexible signature** ([pci_scorer.py:257](worker/pipeline/pci_scorer.py:257)–268) silently coerces wrong argument types (a non-numeric `frame_area_px` becomes 1.0) instead of raising — which is how `main.py`'s wrong-argument call would produce garbage numbers rather than an error if its other bugs were fixed.

**Remediation:** align band tables, emit nulls not sentinels, delete or substantiate marketing numbers (days).

---

## Claims vs. code table

| # | Claim (source) | Verdict | Basis |
|---|---|---|---|
| 1 | "IRC:82-2023 PCI scoring" (README:3,18; NOTICE; bibtex; UI stamps) | **UNSUPPORTED** | Finding 5 — no clause mapping, uncited regression curves, no severity dimension, 58% constants |
| 2 | "100 m GPS-chainage PCI sections" (README:3,17) | **UNSUPPORTED in production; PARTIAL in local CLI** | Finding 4 — handler never sections; CLI path sections but only averages frame PCIs, and crashes at report step |
| 3 | "IRC:82-2023 PDF report" (README:19,102) | **UNSUPPORTED** | Finding 7 — generator raises NameError on every call (verified by execution) |
| 4 | "Metric crack features / crack width in mm" (README:3,16; PDF methodology) | **PARTIALLY SUPPORTED** | Code exists and runs, but FOV is a hardcoded guess, silent 1.0 m depth fallback, bbox-for-mask substitution, VKITTI domain shift (Findings 10, 11) |
| 5 | "GSD calibration from altitude" (README:12) | **UNSUPPORTED in production** | `gsd_calibration.py` only reachable from local CLI; production GSD is depth ÷ hardcoded-FOV focal length |
| 6 | "Drisora scores every 10 m section" (landing:556) | **UNSUPPORTED** | No 10 m sectioning exists anywhere; PDF "10 m sections" are relabeled frames (Finding 9) |
| 7 | "YOLOv12s → SAM2 → Depth Anything V2 → PCI executes in deployed worker" (docs) | **SUPPORTED** | handler.py:27, :704–739 — the model chain itself is real and wired, with batching |
| 8 | Deterministic processing, seeded, manifests with SHA256 (repair log) | **SUPPORTED** (as plumbing) | handler.py:36–63, :396–475; Dockerfile ENV block |
| 9 | "GPS deduplication of overlapping footage" (implied by spatial_dedup.py, gps_dedup.py) | **UNSUPPORTED in production** | spatial_dedup.py is an empty file; gps_dedup only used by dead multi_video_processor |
| 10 | PCI MAE 2.67 / F1 = 1 / 214.3 fpm / $0.41 (evaluation/output/sample) | **UNSUPPORTED as evidence** | Computed from a hand-written synthetic fixture, not a pipeline run |
| 11 | PCI = 82.4 on CBIT surveys; 8 drone surveys | **UNTRACEABLE** | Zero occurrences of the figure in either repo; no archived inputs/outputs; readiness doc: "Real-survey dataset: Not started in repo" |
| 12 | "±2 m GPS accuracy", "32 sections scored" (landing) | **UNSUPPORTED** | No measurement basis in code |
| 13 | Paper-draft results (MAE, agreement, F1, throughput, cost) | **N/A — blank** | All placeholder fields; the draft honestly says "scaffold" |
| 14 | "Reviewer can clone drisora-backend and reproduce" (artifact guide intent) | **UNSUPPORTED** | Weights unpublished, public Dockerfile fails at `COPY weights/`, deps unpinned, dist diverges from deployed code in 13 files |

## Survival table for every reported figure

| Figure | Where | Survives review? |
|---|---|---|
| Any production `pci` / `average_pci` | worker output, dashboards, PDFs | **No** — 58% constant, noise-driven rut, fallback contamination, duplicate-weighted frame average |
| `rut_depth_mm` | worker output | **No** — dimensionally meaningless (verified numerically) |
| `crack_extent_pct` | worker output | **Qualified** — real pixel ratio, but full-frame denominator, bbox substitution on SAM2 failure, and the "metric" branch is a verified no-op |
| `pothole_count` / `pothole_extent_pct` | worker output | **Qualified** — real per-frame counts, but multiplied by frame overlap in survey aggregates |
| `crack_width_mm` (worker) | worker output | **No** — hardcoded FOV, 1.0 m depth fallback, VKITTI domain shift |
| `avg/max_crack_width_mm`, `crack_type_lengths_m` (platform) | UI/PDF | **No** — partially fabricated from type priors (Finding 8) |
| PCI MAE 2.67, F1 1.0, 214.3 fpm, $0.41 | evaluation/output/sample | **No** — synthetic fixture |
| PCI = 82.4, 8 CBIT surveys | (claimed externally) | **No** — untraceable in repo |
| Model SHA256s, frame manifests, timing breakdowns | run manifests | **Yes** — genuinely computed at runtime |
| YOLOv12s benchmark numbers (mAP50 0.6192 etc.) | architectural bible | **Out of scope** — sourced from a separate research repo not audited here; not verifiable from this codebase |

---

## Verdict

**Is Drisora, as it stands, submittable to an IF 11.5 journal? No.**

Justification: The paper's load-bearing quantitative object — an IRC:82-2023 PCI computed from drone imagery over 100 m sections — does not exist in the production code. What exists is a per-frame heuristic whose weighted composite is 58% literal constants, whose only depth-derived term is statistically noise, whose failure modes fabricate scores in both directions (50.0 and ~100), and whose survey aggregate is a frame-rate-weighted average with no spatial deduplication. The 100 m sectioning code that matches the paper's narrative is unreachable from the deployed path and terminates in a function that cannot execute (verified `NameError`). No real survey data, no published detector weights, and no pinned environment exist for anyone — including the author — to reproduce any number. The headline figure (82.4) has no chain of custody in either repository. A hostile Reviewer 2 with the public AGPL backend needs approximately one hour to find `roughness: 100.0`, `re = 0.0`, `pe = 0.0`, `np.std(...)*0.3*1000`, `return _safe_fallback()`, an empty `spatial_dedup.py`, and a PDF generator that has never run — any one of which is sufficient grounds for rejection on soundness; together they read as systematic misrepresentation.

The honest path to submittability is visible in the repo's own internal documents (the repair log and readiness gates are candid): wire the sectioning path into production, delete or fix every constant-and-fallback in the scorer, rename the index truthfully or implement the standard, publish weights and pins, run the 15–30 real surveys the readiness doc already specifies, and archive them. Until the evaluation exists, no amount of code cleanup makes this a results paper.

*End of audit. No code was modified.*
