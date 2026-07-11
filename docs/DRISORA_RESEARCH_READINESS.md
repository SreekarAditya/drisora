# Drisora Research Readiness

Status: corrected implementation, evaluation dataset still missing.

## What is ready

- road-class-specific Appendix-2 equation functions;
- a documented correction for the malformed published MDR pothole polynomial;
- deterministic tests over all nine source input rows with independently recomputed totals;
- fail-closed detector and segmentation behavior;
- explicit nulls for unmeasured parameters;
- 100 m chainage, explicit width, relative-AGL GSD, uncertainty, and spatial deduplication;
- model, source, dependency, seed, and container pins;
- interval-only web, database, map, and PDF contracts.

## What is not ready

- a frozen real-survey dataset;
- all-six-parameter manual or instrumented reference surveys;
- engineer-reviewed labels;
- detector precision/recall on deployment imagery;
- section-level agreement and uncertainty evaluation;
- cross-camera, cross-altitude, cross-road-class, weather, blur, and lighting studies;
- external replication;
- an archived sample survey with distributable media rights.

## Submission gates

1. Archive at least one complete reproducible survey, including raw media/SRT, job input, manifests, section artifact, report, image digest, and code commit.
2. Collect 15–30 diverse surveys with manual Appendix-1 measurements for all six functional parameters.
3. Lock labels and obtain independent civil/transportation engineer review.
4. Report detector metrics, mask quality, GSD/area uncertainty, dedup error, section agreement, throughput, cost, and all failures.
5. Run ablations for detection-only, masks without dedup, calibrated masks with dedup, and complete manual six-input scoring.
6. Publish scripts and immutable data references that regenerate every table and figure.

Until these gates pass, Drisora should be described as a reproducible partial-assessment system, not a validated or compliant autonomous survey replacement.
