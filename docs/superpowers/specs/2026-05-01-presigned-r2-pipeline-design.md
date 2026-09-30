# Presigned R2 Upload + Full Pipeline Wiring

**Date:** 2026-05-01  
**Branch:** feat/google-oauth-auth-layer  
**Status:** Approved

---

## Overview

Wire the multi-mode survey upload system end-to-end: client → presigned R2 PUT → job queue → RunPod worker → results back to R2 → webhook to Next.js. Removes the multipart proxy routes that were routing binary data through Next.js/Vercel.

---

## STEP 0 — Presigned R2 Upload

### API: POST /api/upload/presign

Replaces the existing stub at `app/api/upload/presign/route.ts`.

- Auth-gated via Supabase session
- Body: `{ job_id: string, files: [{ name: string, size: number, type: string }] }`
- Uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (already in package.json)
- R2 endpoint: `https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `"auto"`
- Bucket: `CLOUDFLARE_R2_BUCKET_NAME` env var
- Key format: `uploads/{user_id}/{job_id}/raw/{filename}`
- URL TTL: 3600 seconds
- Returns: `{ urls: [{ filename: string, presigned_url: string, r2_key: string }] }`

### Delete multipart routes

Remove entirely (6 routes that proxy binaries through Next.js):
- `app/api/upload/abort/route.ts`
- `app/api/upload/complete/route.ts`
- `app/api/upload/initiate/route.ts`
- `app/api/upload/metadata/route.ts`
- `app/api/upload/r2-webhook/route.ts`
- `app/api/upload/resume/route.ts`

The existing `app/api/upload/presign/route.ts` is also deleted and replaced.

### Frontend upload flow (all three panels)

`ImageBatchPanel`, `HandheldVideoPanel`, `DroneFootagePanel` all follow the same flow via shared logic in `UploadClient`:

1. POST `/api/jobs/create` → `job_id`
2. POST `/api/upload/presign` with `job_id` + file list → presigned URLs
3. For each file: XHR PUT directly to R2 presigned URL
   - Progress tracked in `Map<filename, number>` via `xhr.upload.addEventListener('progress', ...)`
   - Per-file progress bar rendered during upload
4. On all success → redirect to `/jobs/[job_id]`
5. On any failure → show per-file retry button; do not redirect until all succeed

XHR is used (not fetch) because `fetch` does not expose upload progress natively.

### CORS config

`worker/R2_CORS_CONFIG.json`:
```json
[
  {
    "AllowedOrigins": ["https://drisora.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "*"],
    "MaxAgeSeconds": 3600
  }
]
```

README note added: must be applied in Cloudflare Dashboard → R2 → bucket → Settings → CORS before uploads will work.

---

## STEP 1 — Redis Job Schema

Extended job record fields (added to existing schema):

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"image_batch" \| "handheld" \| "drone"` | Upload mode |
| `gps_available` | `boolean` | Whether GPS data is present |
| `frame_count` | `number` | Total frames to process |
| `processed_count` | `number` | Frames processed so far |
| `output_r2_prefix` | `string` | R2 key prefix for results |
| `last_updated` | `string` | ISO8601 timestamp |

Status enum (ordered):
`queued → extracting_frames → detecting → segmenting → scoring → complete → failed`

New helper: `update_job_progress(job_id, processed_count)` — sets `processed_count` and `last_updated` atomically in Redis.

---

## STEP 2 — R2 Storage Structure

Convention documented in code (no infra to provision):

```
uploads/{user_id}/{job_id}/raw/           ← raw input files (written by client)
results/{user_id}/{job_id}/detections/    ← per-frame JSON
results/{user_id}/{job_id}/depth/         ← per-frame .npy
results/{user_id}/{job_id}/overlays/      ← crack overlay images
results/{user_id}/{job_id}/report.pdf     ← final PDF
```

---

## STEP 3 — worker/main.py (RunPod entrypoint)

Rebuilt from current minimal scaffold. Runs on RunPod Docker where `/tmp` is available.

**Startup:**
- Load env from `worker/.env` using `python-dotenv`
- Query Redis for jobs with `status NOT IN [complete, failed]` where `last_updated` is older than 10 minutes → reset those to `queued` (stale job recovery)

**Main loop (5s poll):**
1. Dequeue job from Redis
2. Download raw files from R2 to `/tmp/{job_id}/` via boto3
   - endpoint: `https://{CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
   - credentials from `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` env vars
   - region: `"auto"`
3. Call `dispatcher.dispatch_job(job)` → ingest for job's mode
4. For each frame: run `detect → segment → depth → pci_scorer`
5. Upload each result file to R2 immediately after processing
6. Call `update_job_progress(job_id, processed_count)` after each frame
7. **On complete:**
   - Set `status=complete`, `output_r2_prefix` in Redis
   - POST `{NEXT_PUBLIC_APP_URL}/api/webhooks/job-complete` with `{ job_id, user_id, status }` and header `X-Webhook-Secret: {CLOUDFLARE_R2_WEBHOOK_SECRET}`
8. **On error:**
   - Set `status=failed`, `error_message` in Redis
   - POST same webhook with `status=failed`
9. Always: `shutil.rmtree(/tmp/{job_id}/)` whether success or failure

`python-dotenv` added to `worker/requirements.txt`.

---

## STEP 4 — Next.js API Routes

### POST /api/jobs/create (rewrite existing)

- Auth-gated
- Body: `{ mode, gps_available, frame_count }`
- Creates job in Redis with all new schema fields (status: `queued`)
- Creates row in Supabase `jobs` table
- Returns `{ job_id }`

### GET /api/jobs/[id] (new)

- Auth-gated
- Reads job from Redis
- Returns 403 if `job.user_id !== current_user.id`
- Returns `{ status, processed_count, frame_count, mode, gps_available, error_message }`

### POST /api/webhooks/job-complete (new)

- Validate `X-Webhook-Secret` header against `CLOUDFLARE_R2_WEBHOOK_SECRET` env var → 401 if missing/wrong
- Return 200 immediately
- Async: update Supabase `jobs` table (`status`, `completed_at`, `error_message`)

---

## STEP 5 — Supabase Migration: 005_jobs.sql

New table `jobs`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users` |
| `mode` | `text` | `image_batch \| handheld \| drone` |
| `status` | `text` | status enum values |
| `frame_count` | `int` | nullable |
| `gps_available` | `boolean` | |
| `r2_prefix` | `text` | |
| `created_at` | `timestamptz` | default `now()` |
| `completed_at` | `timestamptz` | nullable |
| `error_message` | `text` | nullable |

- RLS enabled
- Policy: users can `SELECT` and `UPDATE` only rows where `user_id = auth.uid()`

---

## Environment Variables

**.env.local (Next.js):**
```
CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
R2_PUBLIC_URL
CLOUDFLARE_R2_WEBHOOK_SECRET
```

**worker/.env (Python):**
```
CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
NEXT_PUBLIC_APP_URL
CLOUDFLARE_R2_WEBHOOK_SECRET
REDIS_URL
```

---

## What Is NOT Changing

- `middleware.ts` — already protects `/upload`
- `worker/ingest/` modules — implemented last session, not touched
- `worker/pipeline/` scaffold modules — still scaffold; main.py calls them but their internals are out of scope
- Supabase auth/profiles tables (001–004 migrations)
