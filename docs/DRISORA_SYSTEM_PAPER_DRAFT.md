# Drisora: Reproducible Partial Pavement Assessment from Drone Video

Draft status: methods scaffold only. No quantitative result may be added without an archived run and reference dataset.

## Abstract scaffold

Drisora is a serverless geospatial system that converts calibrated drone video and telemetry into spatially deduplicated cracking and pothole measurements over 100 m sections. Because imagery does not measure four of the six IRC:82-2023 functional parameters, the system reports a 72-point PCI interval rather than a point estimate. The research contribution to evaluate is the reproducible measurement chain, failure semantics, interval contract, and serverless deployment—not certified PCI automation.

## Claimed contributions to test

1. A fail-closed evidence path from upload through pinned YOLO/SAM2 inference.
2. Relative-AGL GSD with explicit calibration and area uncertainty.
3. Georeferenced cross-frame deduplication before section aggregation.
4. Road-class-specific equation dispatch and null-preserving partial PCI bounds.
5. Immutable provenance linking raw inputs, models, seed, code, container, detections, and section outputs.

## Required evaluation

- detector and mask quality on deployment imagery;
- GSD and area error against surveyed targets;
- dedup precision/recall under varied overlaps and flight paths;
- 100 m section measurement agreement;
- complete six-input PCI comparison against field teams;
- sensitivity of the reported interval to camera error and missing frames;
- throughput, cold start, cost, and failure rate;
- representative failure cases and external replication.

## Limitations that must remain explicit

- ravelling and patching are not trained detector classes;
- monocular depth is not used as rut depth, IRI, crack width, or scale;
- relative AGL, near-nadir pose, camera geometry, and carriageway width are required;
- bounds do not establish a condition band or intervention;
- the published MDR pothole equation and worked examples contain source inconsistencies documented in `REMEDIATION.md`;
- no result paper is supportable until the real evaluation exists.
