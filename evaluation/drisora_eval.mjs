#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CONDITION_BANDS = new Set(["good", "satisfactory", "fair", "poor", "very_poor"]);

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
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(stable(value), null, 2)}\n`);
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

function normalizeBand(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return CONDITION_BANDS.has(normalized) ? normalized : null;
}

function bandFromPci(pci) {
  if (typeof pci !== "number" || !Number.isFinite(pci)) return null;
  if (pci >= 85) return "good";
  if (pci >= 70) return "satisfactory";
  if (pci >= 55) return "fair";
  if (pci >= 40) return "poor";
  return "very_poor";
}

function classSet(values) {
  if (!Array.isArray(values)) return new Set();
  return new Set(
    values
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase())
      .sort(),
  );
}

function setEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function validateLabels(labels) {
  const errors = [];
  if (labels.schema_version !== "drisora-labels-v1") {
    errors.push("schema_version must be drisora-labels-v1");
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
    if (typeof segment.segment_id !== "string" || segment.segment_id.length === 0) {
      errors.push(`${prefix}.segment_id is required`);
    } else if (seen.has(segment.segment_id)) {
      errors.push(`${prefix}.segment_id duplicates ${segment.segment_id}`);
    } else {
      seen.add(segment.segment_id);
    }

    if (
      segment.manual_pci != null &&
      (typeof segment.manual_pci !== "number" ||
        !Number.isFinite(segment.manual_pci) ||
        segment.manual_pci < 0 ||
        segment.manual_pci > 100)
    ) {
      errors.push(`${prefix}.manual_pci must be a number from 0 to 100 when present`);
    }

    if (!normalizeBand(segment.manual_condition_band)) {
      errors.push(`${prefix}.manual_condition_band must be one of ${[...CONDITION_BANDS].join(", ")}`);
    }

    if (!Array.isArray(segment.defect_classes)) {
      errors.push(`${prefix}.defect_classes must be an array`);
    }

    if (typeof segment.reviewer_id !== "string" || segment.reviewer_id.length === 0) {
      errors.push(`${prefix}.reviewer_id is required`);
    }

    if (!["self_labeled", "engineer_reviewed", "adjudicated"].includes(segment.review_status)) {
      errors.push(`${prefix}.review_status must be self_labeled, engineer_reviewed, or adjudicated`);
    }
  }
  return errors;
}

function validateExport(exportData) {
  const errors = [];
  if (exportData.schema_version !== "drisora-eval-export-v1") {
    errors.push("schema_version must be drisora-eval-export-v1");
  }
  if (typeof exportData.survey_id !== "string" || exportData.survey_id.length === 0) {
    errors.push("survey_id is required");
  }
  if (!Array.isArray(exportData.segments) || exportData.segments.length === 0) {
    errors.push("segments must be a non-empty array");
  }
  return errors;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function computeMetrics(exportData, labels) {
  const predictedBySegment = new Map(
    exportData.segments.map((segment) => [segment.segment_id, segment]),
  );

  const matched = labels.segments
    .map((label) => ({ label, pred: predictedBySegment.get(label.segment_id) }))
    .filter((pair) => pair.pred);

  const pciErrors = [];
  let bandComparable = 0;
  let bandAgreements = 0;
  let defectExactAgreements = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const { label, pred } of matched) {
    if (typeof label.manual_pci === "number" && typeof pred.pci_score === "number") {
      pciErrors.push(Math.abs(pred.pci_score - label.manual_pci));
    }

    const manualBand = normalizeBand(label.manual_condition_band);
    const predictedBand = normalizeBand(pred.condition_band) ?? bandFromPci(pred.pci_score);
    if (manualBand && predictedBand) {
      bandComparable += 1;
      if (manualBand === predictedBand) bandAgreements += 1;
    }

    const manualClasses = classSet(label.defect_classes);
    const predictedClasses = classSet(pred.defect_classes ?? pred.crack_types);
    if (setEqual(manualClasses, predictedClasses)) defectExactAgreements += 1;

    for (const item of predictedClasses) {
      if (manualClasses.has(item)) tp += 1;
      else fp += 1;
    }
    for (const item of manualClasses) {
      if (!predictedClasses.has(item)) fn += 1;
    }
  }

  const stageCounts = {};
  for (const segment of exportData.segments) {
    const stage = segment.analysis_stage ?? "unknown";
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 = precision != null && recall != null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;

  return {
    survey_id: labels.survey_id,
    job_id: exportData.job_id ?? null,
    segment_count: labels.segments.length,
    matched_segment_count: matched.length,
    missing_prediction_count: labels.segments.length - matched.length,
    pci_mae: round(mean(pciErrors)),
    pci_sample_count: pciErrors.length,
    condition_band_agreement: round(
      bandComparable > 0 ? bandAgreements / bandComparable : null,
    ),
    condition_band_sample_count: bandComparable,
    defect_exact_segment_agreement: round(
      matched.length > 0 ? defectExactAgreements / matched.length : null,
    ),
    defect_micro_precision: round(precision),
    defect_micro_recall: round(recall),
    defect_micro_f1: round(f1),
    pipeline_stage_counts: stageCounts,
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

function conditionBandLabel(pci) {
  return bandFromPci(pci) ?? "unknown";
}

function segmentId(index) {
  return `seg-${String(index).padStart(4, "0")}`;
}

function normalizeJobResultsExport(jobResults, options) {
  const frames = Array.isArray(jobResults.frames) ? jobResults.frames : [];
  const processingSummary = options.processingSummary ?? {};
  const runManifest = options.runManifest ?? {};
  const reportMetadata = options.reportMetadata ?? {};
  const sectionLengthM = Number(options.sectionLengthM ?? 10);

  return {
    schema_version: "drisora-eval-export-v1",
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
      processing_ms: processingSummary.end_to_end_processing_ms ?? processingSummary.total_processing_ms ?? null,
      report_generation_ms: reportMetadata.report_generation_ms ?? null,
      frames_per_minute: processingSummary.frames_per_minute ?? null,
      retry_count: reportMetadata.retry_count ?? 0,
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
      processed_count: processingSummary.processed_count ?? frames.length,
      average_pci: jobResults.summary?.average_pci ?? processingSummary.average_pci ?? null,
    },
    frames: frames.map((frame) => ({
      frame_id: frame.stem ?? `frame-${frame.index}`,
      index: frame.index,
      timestamp_ms: frame.timestamp_ms ?? null,
      pci_score: frame.pci_score ?? null,
      condition_band: conditionBandLabel(frame.pci_score),
      defect_classes: frame.crack_types ?? [],
      lat: frame.lat ?? null,
      lon: frame.lon ?? null,
      alt_m: frame.alt_m ?? null,
      processing_ms: frame.processing_ms ?? null,
      analysis_stage: frame.analysis_stage ?? "unknown",
      degraded_reasons: frame.degraded_reasons ?? [],
      yolo_detection_count: frame.yolo_detection_count ?? null,
      final_detection_count: frame.final_detection_count ?? null,
    })),
    gps_path: frames
      .filter((frame) => frame.lat != null && frame.lon != null)
      .map((frame) => ({
        index: frame.index,
        timestamp_ms: frame.timestamp_ms ?? null,
        lat: frame.lat,
        lon: frame.lon,
        alt_m: frame.alt_m ?? null,
      })),
    segments: frames.map((frame, index) => ({
      segment_id: frame.segment_id ?? segmentId(index),
      start_distance_m: index * sectionLengthM,
      end_distance_m: (index + 1) * sectionLengthM,
      pci_score: frame.pci_score ?? null,
      condition_band: conditionBandLabel(frame.pci_score),
      defect_classes: frame.crack_types ?? [],
      lat_start: frame.lat ?? null,
      lon_start: frame.lon ?? null,
      lat_end: frame.lat ?? null,
      lon_end: frame.lon ?? null,
      analysis_stage: frame.analysis_stage ?? "unknown",
      degraded_reasons: frame.degraded_reasons ?? [],
    })),
    report_metadata: reportMetadata,
  };
}

function csvFromObjects(rows) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const encode = (value) => {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value);
    }
    return value ?? "";
  };
  return [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((key) => `"${String(encode(row[key])).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n") + "\n";
}

function metricsCsv(metrics) {
  const rows = [
    ["metric", "value"],
    ["survey_id", metrics.survey_id],
    ["segment_count", metrics.segment_count],
    ["matched_segment_count", metrics.matched_segment_count],
    ["missing_prediction_count", metrics.missing_prediction_count],
    ["pci_mae", metrics.pci_mae],
    ["condition_band_agreement", metrics.condition_band_agreement],
    ["defect_exact_segment_agreement", metrics.defect_exact_segment_agreement],
    ["defect_micro_precision", metrics.defect_micro_precision],
    ["defect_micro_recall", metrics.defect_micro_recall],
    ["defect_micro_f1", metrics.defect_micro_f1],
    ["frames_per_minute", metrics.system.frames_per_minute],
    ["processing_ms", metrics.system.processing_ms],
    ["estimated_cost_usd", metrics.system.estimated_cost_usd],
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
}

function paperTable(metrics) {
  return [
    "# Drisora Evaluation Tables",
    "",
    "## Quality Metrics",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Matched segments | ${metrics.matched_segment_count} |`,
    `| PCI MAE | ${metrics.pci_mae ?? "NA"} |`,
    `| Condition band agreement | ${metrics.condition_band_agreement ?? "NA"} |`,
    `| Defect exact segment agreement | ${metrics.defect_exact_segment_agreement ?? "NA"} |`,
    `| Defect micro F1 | ${metrics.defect_micro_f1 ?? "NA"} |`,
    "",
    "## System Metrics",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Processing time, ms | ${metrics.system.processing_ms ?? "NA"} |`,
    `| Frames per minute | ${metrics.system.frames_per_minute ?? "NA"} |`,
    `| Report generation time, ms | ${metrics.system.report_generation_ms ?? "NA"} |`,
    `| Estimated cost, USD | ${metrics.system.estimated_cost_usd ?? "NA"} |`,
    "",
    "## Pipeline Stages",
    "",
    "| Stage | Segment count |",
    "|---|---:|",
    ...Object.entries(metrics.pipeline_stage_counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stage, count]) => `| ${stage} | ${count} |`),
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
    const jobResults = readJson(args["job-results"]);
    const options = {
      surveyId: args["survey-id"],
      sectionLengthM: args["section-length-m"] ? Number(args["section-length-m"]) : 10,
      runManifestPath: args["run-manifest"] ?? null,
      processingSummaryPath: args["processing-summary"] ?? null,
      reportMetadataPath: args["report-metadata"] ?? null,
      runManifest: args["run-manifest"] ? readJson(args["run-manifest"]) : {},
      processingSummary: args["processing-summary"] ? readJson(args["processing-summary"]) : {},
      reportMetadata: args["report-metadata"] ? readJson(args["report-metadata"]) : {},
    };
    const exportData = normalizeJobResultsExport(jobResults, options);
    fs.mkdirSync(args.out, { recursive: true });
    writeJson(path.join(args.out, "export.json"), exportData);
    fs.writeFileSync(path.join(args.out, "frames.csv"), csvFromObjects(exportData.frames));
    fs.writeFileSync(path.join(args.out, "segments.csv"), csvFromObjects(exportData.segments));
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
    fs.writeFileSync(path.join(args.out, "paper_tables.md"), paperTable(metrics));
    console.log(`metrics written to ${args.out}`);
    return;
  }

  usage();
  process.exit(2);
}

main();
