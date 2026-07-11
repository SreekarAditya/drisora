#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EXPORT_SCHEMA = "drisora-eval-export-v2";
const LABEL_SCHEMA = "drisora-labels-v2";
const REVIEW_STATUSES = new Set([
  "synthetic_fixture",
  "self_labeled",
  "engineer_reviewed",
  "adjudicated",
]);

function usage() {
  console.error(
    [
      "Usage:",
      "  node evaluation/drisora_eval.mjs export --job-results job_results.json --survey-id survey-id --out evaluation/output/survey-id",
      "  node evaluation/drisora_eval.mjs validate --labels labels.json",
      "  node evaluation/drisora_eval.mjs compute --export export.json --labels labels.json --out evaluation/output/run",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])]),
  );
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(stable(value), null, 2)}\n`);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validBounds(value) {
  if (!value || typeof value !== "object") return false;
  if (
    !finiteNumber(value.lower) ||
    !finiteNumber(value.upper) ||
    !finiteNumber(value.width) ||
    value.lower < 0 ||
    value.upper > 100 ||
    value.lower > value.upper
  ) {
    return false;
  }
  return Math.abs(value.width - (value.upper - value.lower)) < 1e-6;
}

function classSet(values) {
  if (!Array.isArray(values)) return new Set();
  return new Set(
    values
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toUpperCase())
      .sort(),
  );
}

function setEqual(first, second) {
  if (first.size !== second.size) return false;
  for (const value of first) {
    if (!second.has(value)) return false;
  }
  return true;
}

function validateLabels(labels) {
  const errors = [];
  if (labels.schema_version !== LABEL_SCHEMA) {
    errors.push(`schema_version must be ${LABEL_SCHEMA}`);
  }
  if (!new Set(["synthetic_fixture", "real_survey"]).has(labels.source_kind)) {
    errors.push("source_kind must be synthetic_fixture or real_survey");
  }
  if (typeof labels.survey_id !== "string" || labels.survey_id.length === 0) {
    errors.push("survey_id is required");
  }
  if (!Array.isArray(labels.segments) || labels.segments.length === 0) {
    errors.push("segments must be a non-empty array");
    return errors;
  }

  const seen = new Set();
  for (const [index, segment] of labels.segments.entries()) {
    const prefix = `segments[${index}]`;
    if (typeof segment.section_id !== "string" || segment.section_id.length === 0) {
      errors.push(`${prefix}.section_id is required`);
    } else if (seen.has(segment.section_id)) {
      errors.push(`${prefix}.section_id duplicates ${segment.section_id}`);
    } else {
      seen.add(segment.section_id);
    }
    if (
      segment.reference_complete_pci != null &&
      (!finiteNumber(segment.reference_complete_pci) ||
        segment.reference_complete_pci < 0 ||
        segment.reference_complete_pci > 100)
    ) {
      errors.push(`${prefix}.reference_complete_pci must be from 0 to 100 when present`);
    }
    if (!Array.isArray(segment.defect_classes)) {
      errors.push(`${prefix}.defect_classes must be an array`);
    }
    if (typeof segment.reviewer_id !== "string" || segment.reviewer_id.length === 0) {
      errors.push(`${prefix}.reviewer_id is required`);
    }
    if (!REVIEW_STATUSES.has(segment.review_status)) {
      errors.push(`${prefix}.review_status is invalid`);
    }
    if (labels.source_kind === "synthetic_fixture" && segment.review_status !== "synthetic_fixture") {
      errors.push(`${prefix}.review_status must be synthetic_fixture for fixture data`);
    }
    if (labels.source_kind === "real_survey" && segment.review_status === "synthetic_fixture") {
      errors.push(`${prefix}.review_status cannot be synthetic_fixture for real data`);
    }
  }
  return errors;
}

function validateExport(exportData) {
  const errors = [];
  if (exportData.schema_version !== EXPORT_SCHEMA) {
    errors.push(`schema_version must be ${EXPORT_SCHEMA}`);
  }
  if (typeof exportData.survey_id !== "string" || exportData.survey_id.length === 0) {
    errors.push("survey_id is required");
  }
  if (!Array.isArray(exportData.sections) || exportData.sections.length === 0) {
    errors.push("sections must be a non-empty array");
    return errors;
  }
  const seen = new Set();
  for (const [index, section] of exportData.sections.entries()) {
    const prefix = `sections[${index}]`;
    if (typeof section.section_id !== "string" || section.section_id.length === 0) {
      errors.push(`${prefix}.section_id is required`);
    } else if (seen.has(section.section_id)) {
      errors.push(`${prefix}.section_id duplicates ${section.section_id}`);
    } else {
      seen.add(section.section_id);
    }
    if (section.pci_complete !== null) {
      errors.push(`${prefix}.pci_complete must be null for a partial assessment export`);
    }
    if (!validBounds(section.pci_bounds)) {
      errors.push(`${prefix}.pci_bounds is invalid`);
    } else if (Math.abs(section.pci_bounds.width - 72) >= 1e-6) {
      errors.push(`${prefix}.pci_bounds.width must be exactly 72 for the current partial contract`);
    }
    if (!Array.isArray(section.defect_classes)) {
      errors.push(`${prefix}.defect_classes must be an array`);
    }
    if (section.measured_weight_fraction !== 0.28 || section.unmeasured_weight_fraction !== 0.72) {
      errors.push(`${prefix} must expose measured/unmeasured weight fractions 0.28/0.72`);
    }
  }
  return errors;
}

function mean(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function distanceOutsideInterval(reference, bounds) {
  if (reference < bounds.lower) return bounds.lower - reference;
  if (reference > bounds.upper) return reference - bounds.upper;
  return 0;
}

function computeMetrics(exportData, labels) {
  const predictedBySection = new Map(
    exportData.sections.map((section) => [section.section_id, section]),
  );
  const matched = labels.segments
    .map((label) => ({ label, pred: predictedBySection.get(label.section_id) }))
    .filter((pair) => pair.pred);

  const intervalWidths = exportData.sections.map((section) => section.pci_bounds.width);
  const outsideDistances = [];
  let coveredReferences = 0;
  let intervalReferenceCount = 0;
  let defectExactAgreements = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (const { label, pred } of matched) {
    if (finiteNumber(label.reference_complete_pci)) {
      const distance = distanceOutsideInterval(label.reference_complete_pci, pred.pci_bounds);
      outsideDistances.push(distance);
      intervalReferenceCount += 1;
      if (distance === 0) coveredReferences += 1;
    }

    const referenceClasses = classSet(label.defect_classes);
    const predictedClasses = classSet(pred.defect_classes);
    if (setEqual(referenceClasses, predictedClasses)) defectExactAgreements += 1;
    for (const item of predictedClasses) {
      if (referenceClasses.has(item)) truePositive += 1;
      else falsePositive += 1;
    }
    for (const item of referenceClasses) {
      if (!predictedClasses.has(item)) falseNegative += 1;
    }
  }

  const precision = truePositive + falsePositive > 0
    ? truePositive / (truePositive + falsePositive)
    : null;
  const recall = truePositive + falseNegative > 0
    ? truePositive / (truePositive + falseNegative)
    : null;
  const f1 = precision != null && recall != null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  const scopeCounts = {};
  for (const section of exportData.sections) {
    const scope = section.assessment_scope ?? "unknown";
    scopeCounts[scope] = (scopeCounts[scope] ?? 0) + 1;
  }

  const fixtureOnly = labels.source_kind === "synthetic_fixture";
  return {
    schema_version: "drisora-eval-metrics-v2",
    survey_id: labels.survey_id,
    job_id: exportData.job_id ?? null,
    source_kind: labels.source_kind,
    evidence_status: fixtureOnly
      ? "synthetic_fixture_only_not_research_evidence"
      : "real_survey_analysis_requires_independent_method_review",
    research_claim_permitted: false,
    section_count: labels.segments.length,
    matched_section_count: matched.length,
    missing_prediction_count: labels.segments.length - matched.length,
    interval_reference_coverage: round(
      intervalReferenceCount > 0 ? coveredReferences / intervalReferenceCount : null,
    ),
    interval_reference_sample_count: intervalReferenceCount,
    interval_outside_distance_mae: round(mean(outsideDistances)),
    mean_interval_width: round(mean(intervalWidths)),
    defect_exact_section_agreement: round(
      matched.length > 0 ? defectExactAgreements / matched.length : null,
    ),
    defect_micro_precision: round(precision),
    defect_micro_recall: round(recall),
    defect_micro_f1: round(f1),
    assessment_scope_counts: scopeCounts,
    system: {
      upload_ms: exportData.system?.upload_ms ?? null,
      processing_ms: exportData.system?.processing_ms ?? null,
      report_generation_ms: exportData.system?.report_generation_ms ?? null,
      frames_per_minute: exportData.system?.frames_per_minute ?? null,
      retry_count: exportData.system?.retry_count ?? null,
      failure_rate: exportData.system?.failure_rate ?? null,
      estimated_cost_usd: exportData.system?.estimated_cost_usd ?? null,
    },
  };
}

function detectionClasses(section) {
  const detections = Array.isArray(section.unique_detections) ? section.unique_detections : [];
  return [...classSet(detections.map((detection) => detection.class ?? detection.crack_type))];
}

function normalizeJobResultsExport(jobResults, options) {
  const frames = Array.isArray(jobResults.frames) ? jobResults.frames : [];
  const sections = Array.isArray(jobResults.sections) ? jobResults.sections : [];
  const processingSummary = options.processingSummary ?? {};
  const runManifest = options.runManifest ?? {};
  const reportMetadata = options.reportMetadata ?? {};
  return {
    schema_version: EXPORT_SCHEMA,
    artifact_kind: "real_job_export",
    survey_id: options.surveyId,
    job_id: jobResults.job_id ?? runManifest.job_id ?? null,
    mode: jobResults.mode ?? runManifest.mode ?? null,
    generated_at:
      reportMetadata.generated_at ??
      processingSummary.completed_at ??
      runManifest.created_at ??
      new Date(0).toISOString(),
    system: {
      upload_ms: reportMetadata.upload_ms ?? null,
      processing_ms: processingSummary.end_to_end_processing_ms ?? null,
      report_generation_ms: reportMetadata.report_generation_ms ?? null,
      frames_per_minute: processingSummary.frames_per_minute ?? null,
      retry_count: reportMetadata.retry_count ?? null,
      failure_rate: reportMetadata.failure_rate ?? null,
      estimated_cost_usd: reportMetadata.estimated_cost_usd ?? null,
    },
    manifests: {
      run_manifest: options.runManifestPath ?? null,
      processing_summary: options.processingSummaryPath ?? null,
      report_metadata: options.reportMetadataPath ?? null,
    },
    summary: {
      frame_count: jobResults.summary?.frame_count ?? frames.length,
      section_count: sections.length,
      pci_complete: null,
      pci_bounds: jobResults.summary?.pci_bounds ?? processingSummary.pci_bounds ?? null,
    },
    frames: frames.map((frame) => ({
      frame_id: frame.stem ?? `frame-${frame.index}`,
      index: frame.index,
      timestamp_ms: frame.timestamp_ms ?? null,
      pci_complete: null,
      defect_classes: frame.crack_types ?? [],
      lat: frame.lat ?? null,
      lon: frame.lon ?? null,
      relative_altitude_m: frame.relative_altitude_m ?? null,
      processing_ms: frame.processing_ms ?? null,
      analysis_stage: frame.analysis_stage ?? "unknown",
      degraded_reasons: frame.degraded_reasons ?? [],
    })),
    sections: sections.map((section) => ({
      section_id: section.section_id,
      start_distance_m: section.start_distance_m,
      end_distance_m: section.end_distance_m,
      section_length_m: section.section_length_m,
      section_area_m2: section.section_area_m2,
      pci_complete: null,
      pci_bounds: section.pci_bounds,
      defect_classes: detectionClasses(section),
      raw_detection_count: section.raw_detection_count ?? null,
      unique_detection_count: section.unique_detection_count ?? null,
      assessment_scope: section.assessment?.assessment_scope ?? "partial",
      measured_weight_fraction: section.assessment?.measured_weight_fraction ?? 0.28,
      unmeasured_weight_fraction: section.assessment?.unmeasured_weight_fraction ?? 0.72,
      provenance: section.assessment?.provenance ?? null,
    })),
  };
}

function csvFromObjects(rows) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const encode = (value) =>
    Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value ?? "";
  return [
    keys.join(","),
    ...rows.map((row) =>
      keys.map((key) => `"${String(encode(row[key])).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n") + "\n";
}

function metricsCsv(metrics) {
  const rows = [
    ["metric", "value"],
    ["source_kind", metrics.source_kind],
    ["evidence_status", metrics.evidence_status],
    ["research_claim_permitted", metrics.research_claim_permitted],
    ["section_count", metrics.section_count],
    ["matched_section_count", metrics.matched_section_count],
    ["missing_prediction_count", metrics.missing_prediction_count],
    ["interval_reference_coverage", metrics.interval_reference_coverage],
    ["interval_reference_sample_count", metrics.interval_reference_sample_count],
    ["interval_outside_distance_mae", metrics.interval_outside_distance_mae],
    ["mean_interval_width", metrics.mean_interval_width],
    ["defect_exact_section_agreement", metrics.defect_exact_section_agreement],
    ["defect_micro_precision", metrics.defect_micro_precision],
    ["defect_micro_recall", metrics.defect_micro_recall],
    ["defect_micro_f1", metrics.defect_micro_f1],
    ["frames_per_minute", metrics.system.frames_per_minute],
    ["processing_ms", metrics.system.processing_ms],
    ["estimated_cost_usd", metrics.system.estimated_cost_usd],
  ];
  return rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n") + "\n";
}

function evaluationSummary(metrics) {
  return [
    "# Drisora Evaluation Summary",
    "",
    `> Evidence status: **${metrics.evidence_status}**. This output does not authorize a research, accuracy, compliance, or generalization claim.`,
    "",
    "## Bounded assessment diagnostics",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Matched sections | ${metrics.matched_section_count} |`,
    `| Reference PCI inside reported interval | ${metrics.interval_reference_coverage ?? "NA"} |`,
    `| Reference sample count | ${metrics.interval_reference_sample_count} |`,
    `| Mean distance outside interval | ${metrics.interval_outside_distance_mae ?? "NA"} |`,
    `| Mean interval width | ${metrics.mean_interval_width ?? "NA"} |`,
    `| Defect exact section agreement | ${metrics.defect_exact_section_agreement ?? "NA"} |`,
    `| Defect micro F1 | ${metrics.defect_micro_f1 ?? "NA"} |`,
    "",
    "## Observed runtime fields",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Processing time, ms | ${metrics.system.processing_ms ?? "NA"} |`,
    `| Frames per minute | ${metrics.system.frames_per_minute ?? "NA"} |`,
    `| Report generation time, ms | ${metrics.system.report_generation_ms ?? "NA"} |`,
    `| Estimated cost, USD | ${metrics.system.estimated_cost_usd ?? "NA"} |`,
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "validate") {
    if (!args.labels) {
      usage();
      process.exit(2);
    }
    const errors = validateLabels(readJson(args.labels));
    if (errors.length > 0) {
      console.error(errors.join("\n"));
      process.exit(1);
    }
    console.log("labels: ok");
    return;
  }

  if (args.command === "export") {
    if (!args["job-results"] || !args["survey-id"] || !args.out) {
      usage();
      process.exit(2);
    }
    const options = {
      surveyId: args["survey-id"],
      runManifestPath: args["run-manifest"] ?? null,
      processingSummaryPath: args["processing-summary"] ?? null,
      reportMetadataPath: args["report-metadata"] ?? null,
      runManifest: args["run-manifest"] ? readJson(args["run-manifest"]) : {},
      processingSummary: args["processing-summary"] ? readJson(args["processing-summary"]) : {},
      reportMetadata: args["report-metadata"] ? readJson(args["report-metadata"]) : {},
    };
    const exportData = normalizeJobResultsExport(readJson(args["job-results"]), options);
    const errors = validateExport(exportData);
    if (errors.length > 0) {
      console.error(errors.join("\n"));
      process.exit(1);
    }
    fs.mkdirSync(args.out, { recursive: true });
    writeJson(path.join(args.out, "export.json"), exportData);
    fs.writeFileSync(path.join(args.out, "frames.csv"), csvFromObjects(exportData.frames));
    fs.writeFileSync(path.join(args.out, "sections.csv"), csvFromObjects(exportData.sections));
    console.log(`export written to ${args.out}`);
    return;
  }

  if (args.command === "compute") {
    if (!args.export || !args.labels || !args.out) {
      usage();
      process.exit(2);
    }
    const exportData = readJson(args.export);
    const labels = readJson(args.labels);
    const errors = [...validateExport(exportData), ...validateLabels(labels)];
    if (exportData.survey_id !== labels.survey_id) {
      errors.push("export survey_id must match labels survey_id");
    }
    if (errors.length > 0) {
      console.error(errors.join("\n"));
      process.exit(1);
    }
    const metrics = computeMetrics(exportData, labels);
    fs.mkdirSync(args.out, { recursive: true });
    writeJson(path.join(args.out, "metrics.json"), metrics);
    fs.writeFileSync(path.join(args.out, "metrics.csv"), metricsCsv(metrics));
    fs.writeFileSync(path.join(args.out, "evaluation_summary.md"), evaluationSummary(metrics));
    console.log(`bounded evaluation diagnostics written to ${args.out}`);
    return;
  }

  usage();
  process.exit(2);
}

main();
