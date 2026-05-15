# Drisora Artifact Guide

This guide is for reproducing a Drisora systems-artifact run. It does not require committing secrets or private survey media.

## Repo Verification

Run the local gates:

```bash
npm run lint
npm run typecheck
npm run test:worker
npm run eval:sample
npm run build
```

Or run the combined gate:

```bash
npm run verify
```

## Environment Variables

Use `.env.local.example` for the Next.js app and `worker/.env.example` for the worker. Keep real secrets in local env files or deployment secret stores only.

Required service groups:

- Supabase: URL, anon key, service role key
- Cloudflare R2: account ID, access key ID, secret key, bucket name
- Upstash Redis: REST URL and token
- RunPod: API key and endpoint ID
- Worker webhook: `WORKER_WEBHOOK_SECRET`
- App URL: `NEXT_PUBLIC_APP_URL`

## Model Assets

YOLO weights are expected under `worker/weights/`.

SAM2 and DepthPro are downloaded at runtime by the worker pipeline when absent:

- `SAM2_MODEL_PATH=/tmp/models/sam2.1_hiera_small.pt`
- `SAM2_MODEL_URL=https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt`
- `DEPTHPRO_MODEL_PATH=/tmp/models/depth_pro.pt`
- `DEPTHPRO_MODEL_URL=https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt`

For a locked paper artifact, record the SHA256 hashes emitted in `run_manifest.json` after the first successful run. Do not commit large model checkpoints unless the repository policy changes.

## Worker Outputs

Each successful worker job writes manifests under:

```text
results/<user_id>/<job_id>/manifests/
```

Expected files:

- `run_manifest.json`: job options, input/output prefixes, raw file hashes, runtime versions, model paths and hashes
- `frame_manifest.json`: extracted frame inventory and optional frame hashes
- `processing_summary.json`: processed frame count, average PCI, total detections, timing, frames/minute, pipeline stage counts, degraded-frame counts

Each frame detection JSON includes:

- PCI score and condition
- detections
- YOLO/SAM2/DepthPro counters
- metric fields where available
- `analysis_stage`
- `degraded_reasons`

## Evaluation Bundle

The normalized evaluation path is:

```text
evaluation/
  fixtures/
  schema/
  output/      # ignored by git
  private/     # ignored by git
```

For each real survey, prepare:

- one Drisora export JSON using `drisora-eval-export-v1`
- one label JSON using `drisora-labels-v1`
- optional media and GPS paths stored outside git or under ignored private storage

If you have a saved `JobResults` JSON from the app plus worker manifests, normalize it first:

```bash
node evaluation/drisora_eval.mjs export \
  --job-results <job_results.json> \
  --survey-id <survey_id> \
  --processing-summary <processing_summary.json> \
  --run-manifest <run_manifest.json> \
  --out evaluation/output/<survey_id>
```

Run:

```bash
node evaluation/drisora_eval.mjs validate --labels <labels.json>
node evaluation/drisora_eval.mjs compute --export <export.json> --labels <labels.json> --out evaluation/output/<survey_id>
```

Outputs:

- `metrics.json`
- `metrics.csv`
- `paper_tables.md`

## Real-Survey Artifact Acceptance

A minimally reproducible artifact is complete when another engineer can:

1. Configure env vars without secrets being present in git.
2. Process at least one sample survey from upload through PDF report.
3. Find the worker manifests for that job.
4. Run the evaluation command against frozen export and label files.
5. Regenerate the reported tables without spreadsheet edits.
