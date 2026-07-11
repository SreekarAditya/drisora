# Drisora Architecture Audit

Date: 2026-06-14

Repository: `/Users/sreekaraditya/Desktop/Drisora`

Audited git branch: `main`

Audited commit: `63a124b`

Primary objective: produce a complete technical architecture audit from the local codebase, available chat/memory context, GitHub connector, Supabase connector, Vercel connector availability, and deployment-related code.

## Audit Scope And Source Discipline

This document is code-first. Exact names, exact values, and exact constraints are included where they exist in the repository or connector output. If a value is only in local secret-bearing environment files, this document records non-secret infrastructure identifiers but does not print secret tokens, service-role keys, API keys, JWTs, access-key secrets, or webhook secrets.

The local worktree was dirty before this audit document was added:

```text
 M .env.example
 M .env.local.example
 M README.md
 M docs/DRISORA_ARCHITECTURAL_BIBLE.md
 M docs/DRISORA_ARTIFACT_GUIDE.md
 M docs/DRISORA_RESEARCH_READINESS.md
 M docs/DRISORA_SYSTEM_PAPER_DRAFT.md
 M package.json
 M worker/.env.example
 M worker/Dockerfile
?? scripts/deploy_runpod_worker.mjs
```

The audit therefore treats the current local tree as the implementation being inspected, while explicitly noting that several files already had uncommitted edits.

The repository `AGENTS.md` warns that this Next.js version has breaking changes and instructs agents to read relevant documentation under `node_modules/next/dist/docs/` before writing code. For this document-only audit, the relevant Next.js local docs were consulted before touching repository files.

## Connector And Memory Evidence

### GitHub Connector

Installed GitHub account visible to the connector: `SreekarAditya`.

The current HEAD commit was fetched through the GitHub connector:

```text
commit: 63a124b4f2b21c9587b06ee3496f17214effe71a
message: fix(auth): remove professional consent checkbox
files:
  app/(auth)/login/page.tsx
  components/legal/ConsentFields.tsx
```

GitHub workflow runs for this commit returned an empty list:

```text
workflow_runs: []
```

AUDIT_FLAG: There is no connector-confirmed CI run for `63a124b`. Local code and connector-visible commit metadata are confirmed; GitHub Actions status is not.

### Supabase Connector

Supabase project retrieved through the connector:

```text
project id/ref: xkwzxuduyhgmbcryfkob
name: drisora
region: us-east-1
status: ACTIVE_HEALTHY
database host: db.xkwzxuduyhgmbcryfkob.supabase.co
Postgres engine: 17
Postgres version: 17.6.1.111
release channel: ga
created_at: 2026-04-28T18:19:36.022715Z
public URL in local env: https://xkwzxuduyhgmbcryfkob.supabase.co
```

Remote migration tracking visible through the connector:

```text
20260611025656 consent_records
```

AUDIT_FLAG: The local repository has ten SQL migration files named `001_initial_schema.sql` through `010_consent_records.sql`, but the remote connector reported only `20260611025656 consent_records`. That does not prove the schema is missing remotely; it means the remote migration history visible through the connector is not a one-to-one record of the local migration filenames. Treat local migrations and remote applied-migration metadata as separate source-of-truth layers.

Supabase security advisors returned these warnings:

```text
WARN public.set_updated_at has mutable search_path.
WARN public.rls_auto_enable() is SECURITY DEFINER and executable by anon.
WARN public.rls_auto_enable() is SECURITY DEFINER and executable by authenticated.
WARN leaked password protection is disabled.
```

Supabase performance advisors returned many lints. The most architecture-relevant classes were:

```text
unindexed foreign keys:
  detections.section_id
  detections.source_video_id
  detections.survey_id
  jobs.survey_id
  jobs.user_id
  processed_zones.source_video_id
  surveys.user_id

RLS initplan warnings:
  repeated auth.uid() calls in policies should be wrapped as (select auth.uid())

policy density warnings:
  multiple permissive policies on jobs

unused indexes:
  several indexes were reported unused by advisor
```

AUDIT_FLAG: The security/performance warnings are connector-confirmed and should be treated as production hardening work, not speculative cleanup.

### Vercel Connector

The Vercel connector returned no visible teams:

```text
teams: []
```

No `.vercel/project.json` file exists in the repository.

The code and docs refer to Vercel deployment and `drisora.vercel.app`, but the connector could not verify a Vercel project, deployment, environment variables, build status, or domains in this audit.

AUDIT_FLAG: Vercel is part of the intended deployment topology by code/docs, but current live Vercel state was not connector-verified.

### RunPod Context

There is no RunPod connector available in this session. RunPod evidence is from local deployment code, environment keys, and prior memory:

```text
RUNPOD_ENDPOINT_ID in local env: d457qtzarj30v5
prior live endpoint/template pair from memory: d457qtzarj30v5 / 8vnf9yq94x
prior deployed image from memory:
  sreekaraditya/drisora-worker:serverless-v17@sha256:bff0719f7e1563ad7defd71930477285c2903f302bd42a619e49c2d182f94086
deploy script: scripts/deploy_runpod_worker.mjs
worker image default/local env: sreekaraditya/drisora-worker:serverless-local
```

AUDIT_FLAG: The RunPod endpoint/template values are consistent with prior memory and local env shape, but current RunPod endpoint runtime settings such as GPU type, min/max workers, idle timeout, and queue depth were not live-queried in this audit.

### Cloudflare R2 And Upstash Local Environment Identifiers

Non-secret infrastructure identifiers found in local environment files:

```text
CLOUDFLARE_R2_ACCOUNT_ID: e740d59d0395a0b1fafcd899224daf6a
CLOUDFLARE_R2_BUCKET_NAME: drisora-videos
UPSTASH_REDIS_REST_URL host: charming-drake-108469.upstash.io
```

Secret values were intentionally redacted from this document.

## Repository Inventory

The codebase analyzer reported:

```text
file_count: 429
TypeScript files: 243
Python files: 65
SQL files: 19
Shell files: 2
```

Primary top-level surfaces:

```text
app/                  Next.js App Router pages, layouts, route handlers
components/           Product UI, upload panels, reports, maps, legal consent UI
hooks/                Browser upload orchestration
lib/                  Supabase, Redis, R2, RunPod, jobs, result hydration, reports
worker/               RunPod Python worker, Dockerfile, ML/ingest/pipeline code
supabase/migrations/  Local Postgres/PostGIS/RLS schema migrations
scripts/              RunPod worker deployment script
docs/                 Architecture, research readiness, work logs, superpowers specs
evaluation/           Offline evaluation fixtures/scripts
types/                Shared TypeScript contracts
```

Package/runtime versions from `package.json`:

```json
{
  "next": "^16.2.4",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "@supabase/ssr": "^0.10.2",
  "@supabase/supabase-js": "^2.105.1",
  "@upstash/redis": "^1.37.0",
  "bullmq": "^5.76.3",
  "@aws-sdk/client-s3": "^3.1038.0",
  "@aws-sdk/s3-request-presigner": "^3.1038.0",
  "@react-pdf/renderer": "^4.5.1",
  "playwright": "^1.59.1",
  "leaflet": "^1.9.4",
  "recharts": "^3.8.1",
  "typescript": "^5"
}
```

NPM scripts:

```json
{
  "dev": "next dev --webpack",
  "build": "next build --webpack",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test:worker": "python3 -m unittest discover -s worker/tests -v",
  "eval:sample": "node evaluation/drisora_eval.mjs compute --export evaluation/fixtures/sample_export.json --labels evaluation/fixtures/sample_labels.json --out evaluation/output/sample",
  "deploy:runpod": "node scripts/deploy_runpod_worker.mjs",
  "verify": "npm run lint && npm run typecheck && npm run test:worker && npm run eval:sample && npm run build"
}
```

## System Architecture

### Architectural Split

Drisora is split into:

1. Browser/UI control plane.
2. Next.js App Router server/API control plane.
3. Supabase Auth/Postgres/PostGIS/RLS durable state.
4. Cloudflare R2 object storage for raw media and generated worker artifacts.
5. Upstash Redis REST for fast job state.
6. RunPod Serverless Python GPU worker for frame extraction, model inference, and PCI scoring.
7. Supabase Storage legacy/report path for survey PDFs.

The active modern job path is:

```text
Browser
  -> Next.js /api/jobs/create
  -> Supabase jobs row + Upstash job JSON
  -> Next.js /api/upload/presign
  -> Browser direct PUT to Cloudflare R2
  -> Next.js /api/jobs/[id]/submit
  -> RunPod /run
  -> Python worker downloads raw R2 objects
  -> worker uploads frames/detections/manifests/summary to R2
  -> worker updates Upstash Redis progress
  -> worker POSTs /api/webhooks/job-complete
  -> Next.js service-role update to Supabase jobs
  -> Browser polls /api/jobs/[id] and loads /api/jobs/[id]/results
```

Important non-active or legacy surfaces:

```text
lib/queue.ts                    BullMQ scaffold, not active in current upload path
worker/main.py                  local testing poller, not active RunPod serverless entrypoint
app/api/survey/[id]/ingest      retired route, returns 410
app/api/job/callback            legacy callback, returns 501
app/api/survey/[id]/status      legacy SSE route using survey_id jobs
app/api/survey/[id]/results     legacy survey result loader from PostGIS tables
```

### Runtime And Service Inventory

| Runtime/service | Code/config | What runs there | Protocols |
|---|---|---|---|
| Browser | `app/`, `components/`, `hooks/useUpload.ts` | Auth UI, consent UI, upload panels, XHR PUT progress, job polling, result/report UI | HTTPS to Next.js API; presigned HTTPS PUT/GET to R2 |
| Next.js App Router | `app/api/**`, `proxy.ts`, `lib/**` | Auth-gated route handlers, job creation, presign, RunPod submission, webhook receiver, result hydration, PDF generation | HTTPS REST, Supabase client calls, Upstash REST through SDK, R2 S3-compatible API, RunPod REST |
| Supabase Auth | Supabase hosted project | Google OAuth, user sessions, JWT/cookie-backed identity | OAuth redirect, Supabase Auth API |
| Supabase Postgres/PostGIS | `supabase/migrations/*.sql` | Durable metadata: profiles, consent records, projects, jobs, surveys, spatial/geospatial tables | Supabase PostgREST/client RPC abstractions; SQL migrations |
| Supabase RLS | `supabase/migrations/*.sql` | Tenant isolation by `auth.uid()` and parent ownership | Postgres RLS |
| Cloudflare R2 | `lib/r2.ts`, worker boto3 client | Raw media, extracted frames, detections, manifests, processing summary | S3-compatible API; browser presigned PUT/GET |
| Upstash Redis REST | `lib/redis.ts`, `worker/handler.py` direct REST | Job JSON state and per-user job lists | HTTPS REST |
| RunPod Serverless | `lib/runpod.ts`, `worker/handler.py`, `worker/Dockerfile` | Python GPU inference worker | RunPod REST `/run`; worker webhook back to Next.js |
| BullMQ queue scaffold | `lib/queue.ts`, `bullmq` dependency | Defines `survey-processing` queue but not used by active job path | Redis TCP expectation, not active |
| Local worker poller | `worker/main.py` | Local testing poll loop | Redis TCP via `REDIS_URL`; not active |
| PDF rendering | `components/pdf/*`, `app/api/jobs/[id]/report`, `app/api/projects/[id]/report`, `app/api/survey/[id]/report` | React PDF job/project reports; Playwright legacy survey report rendering | HTTP PDF responses; Supabase Storage signed URL for legacy survey report |

### Communication Model

Active communication protocols:

```text
Browser -> Next.js:
  HTTPS REST route handlers under /api/*

Browser -> R2:
  HTTPS presigned PUT URLs generated by Next.js
  HTTPS presigned GET URLs generated by Next.js for result media

Next.js -> Supabase:
  Supabase SSR/server client over Supabase APIs
  Service-role client for trusted webhook/report operations

Next.js -> Upstash:
  @upstash/redis REST client

Next.js -> R2:
  AWS SDK S3-compatible ListObjectsV2/GetObject/PutObject presigner

Next.js -> RunPod:
  HTTPS POST https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run
  Authorization: Bearer RUNPOD_API_KEY
  body: { "input": { ...job payload... } }

RunPod worker -> Upstash:
  direct HTTPS REST:
    GET {UPSTASH_REDIS_REST_URL}/get/job:{job_id}
    POST {UPSTASH_REDIS_REST_URL}/set/job:{job_id}

RunPod worker -> R2:
  boto3 S3-compatible download_file/upload_file/put_object

RunPod worker -> Next.js:
  HTTPS POST {APP_CALLBACK_URL}/api/webhooks/job-complete
  header: X-Webhook-Secret

Next.js legacy survey status -> browser:
  Server-Sent Events in app/api/survey/[id]/status/route.ts
```

Protocols not found as active:

```text
WebSocket: no active WebSocket implementation found.
Message queue: BullMQ is present but not active in current submit path.
Webhook: active only from worker to Next.js completion endpoint.
Railway: no Railway config or connector evidence found.
Cloudflare Workers/Wrangler: no wrangler config found; Cloudflare usage is R2.
```

### Next.js App Runtime

Next.js version is `^16.2.4`. The app uses App Router route handlers and local docs require respecting version-specific APIs.

`next.config.ts` only configures:

```ts
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};
```

Build/dev scripts force webpack:

```text
next dev --webpack
next build --webpack
```

AUDIT_FLAG: The repository config names `turbopack.root`, while scripts use webpack. That may be harmless but should be considered if build behavior diverges.

### Proxy And Auth Gate

`proxy.ts` protects these prefixes:

```text
/dashboard
/projects
/surveys
/reports
/team
/profile
/about
/survey
/report
/onboarding
/upload
/jobs
```

It uses `createServerClient` from `@supabase/ssr` with cookie refresh propagation.

Behavior:

```text
if protected route and no Supabase user:
  redirect to /login?next={path}

if /report/:id has token query:
  allow unauthenticated report-token access

if /login or /signup and user exists:
  redirect to /dashboard
```

Matcher:

```ts
matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
```

### Docker Image Structure

Active worker container: `worker/Dockerfile`.

Base image:

```dockerfile
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime
```

Build metadata:

```dockerfile
ARG DRISORA_BUILD_SHA=unknown
LABEL org.opencontainers.image.revision=$DRISORA_BUILD_SHA
```

System packages:

```text
ca-certificates
curl
ffmpeg
git
libgomp1
libgl1
libglib2.0-0
```

Python dependencies from `worker/requirements.txt`:

```text
runpod
httpx
ultralytics>=8.0.0
opencv-python-headless
numpy
scipy
boto3
requests
Pillow
piexif
python-dotenv
redis
reportlab
```

Additional installs:

```dockerfile
RUN pip install hydra-core>=1.3.2 iopath>=0.1.10 \
    && pip install --no-build-isolation --no-deps git+https://github.com/facebookresearch/sam2.git

RUN git clone --depth 1 https://github.com/DepthAnything/Depth-Anything-V2.git /opt/depth-anything-v2
```

Default worker image environment in Dockerfile:

```text
SAM2_MODEL_PATH=/tmp/models/sam2.1_hiera_small.pt
DEPTH_ANYTHING_V2_REPO=/opt/depth-anything-v2
DEPTH_ANYTHING_V2_MODEL_PATH=/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth
DEPTH_ANYTHING_V2_ENCODER=vitl
DEPTH_ANYTHING_V2_MAX_DEPTH_M=80
DRISORA_DETERMINISTIC_SEED=1337
DRISORA_DETERMINISTIC_EXTRACTOR=1
DRISORA_YOLO_BATCH_SIZE=64
DRISORA_DEPTH_BATCH_SIZE=4
DRISORA_ENABLE_DEPTH_DEFAULT=1
DRISORA_BUILD_SHA=$DRISORA_BUILD_SHA
PYTHONHASHSEED=1337
CUBLAS_WORKSPACE_CONFIG=:4096:8
PYTHONPATH=/opt/depth-anything-v2:/app
```

Container command:

```dockerfile
CMD ["python", "handler.py"]
```

Runtime entrypoint:

```python
runpod.serverless.start({"handler": handler})
```

AUDIT_FLAG: `worker/main.py` states it is not used in serverless mode and is retained for local testing. The production/serverless worker is `worker/handler.py`.

### RunPod Deployment Script

`scripts/deploy_runpod_worker.mjs`:

1. Loads `.env`, `.env.local`, and `worker/.env`.
2. Computes full and short git SHA.
3. Builds Docker image with:

```text
docker buildx build
  --platform linux/amd64
  --build-arg DRISORA_BUILD_SHA={gitSha}
  -f worker/Dockerfile
  -t {image}
  worker
```

4. Pushes unless `--skip-push` is passed.
5. Resolves digest with `docker buildx imagetools inspect`.
6. Calls RunPod GraphQL at:

```text
https://api.runpod.io/graphql?api_key={RUNPOD_API_KEY}
```

7. Queries endpoints to find `templateId`.
8. Queries current template.
9. Sends `SaveTemplateInput` preserving existing env vars and setting:

```text
imageName: digest-qualified image
dockerArgs: existing template dockerArgs or "python handler.py"
containerDiskInGb: existing or 30
volumeInGb: existing or 0
isServerless: true
```

10. Merges a defined allowlist of environment keys into the template env, including Upstash, app callback, webhook secret, R2/object-storage values, RunPod API key, deterministic/model settings, SAM2, and Depth Anything V2 values.

AUDIT_FLAG: This script is new/untracked in the local worktree at audit time. It is architecturally central but not committed in the current git status.

### Deployment Topology

Confirmed or code-evidenced topology:

| Platform | Evidence | Runs |
|---|---|---|
| Vercel | Code/docs mention Next.js app, `drisora.vercel.app`, and Vercel serverless constraints; connector could not verify project | Next.js UI/API control plane, assumed |
| Supabase | Connector-confirmed live project `xkwzxuduyhgmbcryfkob`; local migrations | Auth, Postgres, PostGIS, RLS, some Storage for legacy survey reports |
| RunPod | Local RunPod API submit code; deploy script; local endpoint id; memory of endpoint/template | Serverless GPU worker running `worker/handler.py` |
| Cloudflare R2 | `lib/r2.ts`, worker boto3, local env bucket/account | Raw uploads and worker outputs |
| Upstash | `@upstash/redis`, local REST URL, worker direct REST | Job JSON/progress state |
| Cloudflare Workers | No config found | Not implemented |
| Railway | No config found | Not implemented |

## Data Flow

### Authentication Flow

Login page:

```text
app/(auth)/login/page.tsx
components/legal/ConsentFields.tsx
components/legal/ConsentSync.tsx
lib/supabase/client.ts
```

Visible login requirements:

```text
date of birth
Terms of Service checkbox
Privacy Policy checkbox
```

The professional-capacity checkbox was removed from visible login UI in commit `63a124b`. However, the client still stores `professional_capacity: true` in pending consent payload before Google OAuth.

Google OAuth flow:

1. User fills consent fields.
2. `handleGoogleLogin()` stores pending consent in `localStorage` under `PENDING_CONSENT_KEY`.
3. Browser calls Supabase `signInWithOAuth({ provider: "google" })`.
4. Redirect target is `${window.location.origin}/auth/callback`.
5. `app/auth/callback/route.ts` calls `exchangeCodeForSession(code)`.
6. Route reads `profiles.org_name, role`.
7. If no profile onboarding values, redirect to `/onboarding`.
8. Else redirect to `next` or `/dashboard`.

Consent persistence:

```text
app/api/consent/route.ts
supabase/migrations/010_consent_records.sql
```

Server-side consent API enforces:

```text
dob required
age >= 18 required through meetsAgeFloor(dob)
professional_capacity required in request body
authenticated Supabase user required
IP source from x-forwarded-for or x-real-ip
upsert on user_id,tos_version,pp_version
```

Consent row fields:

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
dob date not null
age_verified boolean not null default false
professional_capacity boolean not null default false
tos_version text not null
tos_accepted_at timestamptz not null default now()
pp_version text not null
pp_accepted_at timestamptz not null default now()
ip_at_registration inet
training_opt_in boolean not null default false
created_at timestamptz not null default now()
```

Consent RLS:

```sql
users_select_own_consent:
  using (auth.uid() = user_id)

users_insert_own_consent:
  with check (auth.uid() = user_id)
```

Consent is append-only for clients:

```text
No update/delete policies are created.
Erasure requests are documented as service-role work.
```

Re-consent modal:

```text
components/legal/ReConsentModal.tsx
```

Behavior:

```text
opens when accepted ToS or Privacy version differs from current constants
requires both updated checkboxes
requires DOB only when stored DOB is missing or below age floor
POSTs /api/consent with professional_capacity: true
decline path signs out
```

AUDIT_FLAG: Professional-capacity is still a server-side consent field and API requirement, but it is no longer a separate visible login checkbox. That is an intentional product/UI change in current HEAD, but it should be documented because compliance semantics remain.

### JWT, Cookies, And RLS Enforcement

Supabase SSR session handling:

```text
lib/supabase/server.ts
proxy.ts
```

`createClient()` uses:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
cookies() from next/headers
@supabase/ssr createServerClient
```

`createServiceRoleClient()` uses:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
auth.autoRefreshToken = false
auth.persistSession = false
```

RLS enforcement pattern:

```sql
user_id = auth.uid()
```

or:

```sql
survey_id in (select id from surveys where user_id = auth.uid())
```

Service-role bypass is used for trusted backend operations:

```text
app/api/webhooks/job-complete/route.ts
app/api/survey/[id]/report/route.ts
```

AUDIT_FLAG: JWT expiry/scope is not configured in repository code. It is Supabase project configuration. Local JWT values exist in env files but are secrets and are not reproduced here.

### Onboarding And Roles

Profile migration adds:

```text
profiles.user_id uuid references auth.users(id)
profiles.org_name text
profiles.role text check in:
  PWD Engineer
  Municipal Corporation
  College Infrastructure Team
  Private Contractor
  Other
profiles.phone text
```

`app/onboarding/page.tsx` writes role/profile details. `app/auth/callback/route.ts` uses role and organization only to decide whether onboarding is complete.

AUDIT_FLAG: No route-handler enforcement was found for "drone operator" versus "engineer" roles. Current API authorization is ownership-based, not role-permission-based. Role is product/profile metadata today.

### Upload Path From Client To R2

Browser orchestration:

```text
hooks/useUpload.ts
components/upload/ImageBatchPanel.tsx
components/upload/HandheldVideoPanel.tsx
components/upload/DroneFootagePanel.tsx
```

`useUpload.startUpload()` phases:

```text
idle
creating_job
presigning
uploading
error
```

Client-side storage filename normalization:

```text
base filename = last path segment
replace non [A-Za-z0-9._-] with _
collapse repeated _
collapse repeated dots
strip leading dots
slice to 180 characters
prefix 0001-, 0002-, ...
```

The client sends both original names and storage names:

```json
{
  "original_file_names": ["original names"],
  "storage_file_names": ["0001-safe-name.ext"],
  "srt_storage_name": "...",
  "video_storage_filenames": ["..."],
  "srt_storage_filenames": ["..."]
}
```

Step 1: create job.

```http
POST /api/jobs/create
Content-Type: application/json
```

Body:

```json
{
  "mode": "image_batch | handheld_video | drone_footage",
  "project_id": "uuid or null",
  "file_count": 1,
  "file_names": ["0001-safe-name.ext"],
  "total_bytes": 123,
  "options": {}
}
```

Job create validation:

```text
valid modes: image_batch, handheld_video, drone_footage
file_names required, non-empty
file names unique
safe filename regex: /^[A-Za-z0-9._-]+$/
filename length: 1..240
filename must not contain ..
file_count must equal file_names.length
total_bytes must be positive finite number
image_batch maximum: 1000 files
handheld_video: 1 or 2 files, second file must include .srt when two files
drone_footage single: one video and optional one .srt
drone_footage multi: is_multi_video=true, video_count > 0, valid video_filenames list, valid optional srt_filenames list, uploaded counts must match
project_id ownership checked against projects.user_id and deleted_at is null
```

Frame option normalization:

```text
if frame_extraction_mode is all_frames or no interval supplied:
  frame_extraction_mode = all_frames
  frame_interval_seconds = null
else:
  frame_extraction_mode = interval
  frame_interval_seconds = supplied positive number or 1
```

Supabase insert into `jobs`:

```text
id: generated UUID
user_id: auth user id
project_id: nullable
mode
status: uploading
frame_count: 0
processed_count: 0
gps_available
r2_prefix: results/{user_id}/{job_id}/
created_at
```

Redis writes:

```text
key: job:{jobId}
value: ProcessingJobRecord JSON

key: user:{userId}:jobs
operation: lpush(jobId)
```

AUDIT_FLAG: No Redis TTL is set on either `job:{jobId}` or `user:{userId}:jobs`.

Step 2: presign upload.

```http
POST /api/upload/presign
```

Validation:

```text
authenticated user required
job must exist in Redis
job.user_id must match current user
job.status must be uploading
requested file names must be safe and included in job manifest
file sizes must be positive finite numbers
```

R2 key pattern:

```text
uploads/{user_id}/{job_id}/raw/{file.name}
```

Presigned PUT TTL:

```text
3600 seconds default
```

R2 client endpoint:

```text
https://{CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com
region: auto
bucket env: CLOUDFLARE_R2_BUCKET_NAME
```

Step 3: browser direct upload.

```text
XMLHttpRequest PUT presigned_url
progress event updates per-file percentage
failed file retry requests a fresh presigned URL for only that file
when all files succeed, submit job
```

AUDIT_FLAG: Uploads do not pass binary bodies through Next.js/Vercel. That is an intentional architecture decision to avoid serverless request size/time constraints.

### Job Submission Flow

Submit endpoint:

```http
POST /api/jobs/{job_id}/submit
```

Validation:

```text
authenticated user required
Redis job exists
job.user_id matches current user
job.status must be uploading
```

RunPod call:

```http
POST https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run
Authorization: Bearer RUNPOD_API_KEY
Content-Type: application/json
```

RunPod body:

```json
{
  "input": {
    "job_id": "...",
    "user_id": "...",
    "project_id": "... or null",
    "mode": "...",
    "r2_prefix": "uploads/{user_id}/{job_id}/raw/",
    "file_names": ["..."],
    "options": {}
  }
}
```

Expected RunPod response:

```json
{ "id": "runpod-job-id" }
```

After successful submission:

```text
Redis job:
  runpod_job_id = response.id
  status = queued
  processed_count = 0
  frame_count = 0
  error_message = null
  last_updated = now

Supabase jobs:
  status = queued
  processed_count = 0
  frame_count = 0
  error_message = null
  completed_at = null
```

On RunPod submission failure:

```text
Supabase jobs.status = failed
Supabase jobs.error_message = error
Supabase jobs.completed_at = now
HTTP 500 returned to client
```

### BullMQ Flow

`lib/queue.ts` defines:

```ts
export const surveyQueue = new Queue("survey-processing", { connection });
```

Connection object:

```ts
const connection = {
  host: process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
} as const;
```

Queue add options:

```text
name: process-survey
payload: { surveyId }
attempts: 3
backoff: exponential, delay 5000 ms
removeOnComplete: true
removeOnFail: false
```

AUDIT_FLAG: The active `/api/jobs/create` -> `/api/jobs/[id]/submit` path does not call `enqueueSurveyJob()` and submits directly to RunPod. Also, BullMQ expects a Redis TCP connection, but this code passes `UPSTASH_REDIS_REST_URL` as `host`, which is not a complete TCP Redis configuration. Treat BullMQ as inactive scaffold until rewired or removed.

### Worker Lifecycle

RunPod invokes `worker/handler.py` with `event["input"]`.

Required worker input fields:

```text
job_id
user_id
mode
storage_prefix or r2_prefix
file_names
options
```

Required worker environment:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
OBJECT_STORAGE_BUCKET or CLOUDFLARE_R2_BUCKET_NAME
OBJECT_STORAGE_ACCESS_KEY_ID or CLOUDFLARE_R2_ACCESS_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY or CLOUDFLARE_R2_SECRET_ACCESS_KEY
APP_CALLBACK_URL or NEXT_PUBLIC_APP_URL
WORKER_WEBHOOK_SECRET or CLOUDFLARE_R2_WEBHOOK_SECRET or RUNPOD_CALLBACK_SECRET
CLOUDFLARE_R2_ACCOUNT_ID when OBJECT_STORAGE_ENDPOINT_URL is absent
```

Worker local paths:

```text
/tmp/{job_id}/raw
/tmp/{job_id}/results
/tmp/{job_id}/results/detections
```

Initial worker actions:

```text
Redis status = extracting_frames
create boto3 S3 client
download raw files from {storage_prefix}/{safe_file_name}
build dispatch file structure by mode
extract frames/GPS through dispatch_job()
upload run_manifest.json
upload frame_manifest.json
Redis status = detecting
warm/load models
process frames in YOLO batches
upload frame copies
upload detection JSON per frame
update Redis processed_count approximately 100 times per job
upload processing_summary.json
Redis status = complete
POST webhook to Next.js
delete /tmp/{job_id}
```

Redis status sequence actually emitted by `worker/handler.py`:

```text
extracting_frames
detecting
complete
failed
```

Valid TypeScript/SQL statuses include:

```text
uploading
queued
extracting_frames
detecting
segmenting
scoring
complete
failed
```

AUDIT_FLAG: `segmenting` and `scoring` are valid status values in the database contract, but the active worker does not emit them as separate states. SAM2, Depth Anything V2, and PCI scoring run inside the per-frame loop while status remains `detecting`.

### Worker Result Write-Back

R2 output prefix:

```text
results/{user_id}/{job_id}/
```

Worker object keys:

```text
results/{user_id}/{job_id}/manifests/run_manifest.json
results/{user_id}/{job_id}/manifests/frame_manifest.json
results/{user_id}/{job_id}/manifests/processing_summary.json
results/{user_id}/{job_id}/frames/{frame_filename}
results/{user_id}/{job_id}/detections/{frame_stem}.json
```

Worker webhook:

```http
POST {APP_CALLBACK_URL}/api/webhooks/job-complete
X-Webhook-Secret: {secret}
Content-Type: application/json
```

Complete webhook body:

```json
{
  "job_id": "...",
  "user_id": "...",
  "status": "complete",
  "average_pci": 72.4,
  "frame_count": 100,
  "processed_count": 100,
  "output_storage_prefix": "results/{user_id}/{job_id}/",
  "output_r2_prefix": "results/{user_id}/{job_id}/"
}
```

Failure webhook body:

```json
{
  "job_id": "...",
  "user_id": "...",
  "status": "failed",
  "error_message": "..."
}
```

Webhook receiver:

```text
app/api/webhooks/job-complete/route.ts
```

Validates:

```text
header x-webhook-secret equals WORKER_WEBHOOK_SECRET or CLOUDFLARE_R2_WEBHOOK_SECRET
job_id non-empty string
user_id non-empty string
status in complete, failed
average_pci finite if present
frame_count integer >= 0 if present
processed_count integer >= 0 if present
output_r2_prefix string if present
```

Supabase update through service role:

```text
jobs.status
jobs.completed_at
jobs.error_message
jobs.average_pci if present
jobs.frame_count if present
jobs.processed_count if present
jobs.r2_prefix if output_r2_prefix present
where jobs.id = job_id and jobs.user_id = user_id
```

If webhook fails after successful processing, the worker stores `webhook_error` in Redis. `/api/jobs/[id]` contains a workaround:

```text
if Redis job status is failed,
and error_message includes /api/webhooks/job-complete,
and average_pci is finite,
and frame_count > 0,
and processed_count >= frame_count:
  normalize job to complete
  clear error_message
  sync terminal job to Supabase
```

AUDIT_FLAG: This is an explicit workaround for webhook-only failure. It protects UX from false failure after completed processing, but it also means status reconciliation depends on client polling after the fact.

### Results Read Path

Status endpoint:

```http
GET /api/jobs/{job_id}
```

Reads Redis `job:{job_id}`, verifies `job.user_id`, normalizes webhook-only failures, syncs terminal Redis state to Supabase, returns:

```json
{
  "status": "...",
  "processed_count": 0,
  "frame_count": 0,
  "mode": "...",
  "gps_available": true,
  "average_pci": null,
  "error_message": null
}
```

Results endpoint:

```http
GET /api/jobs/{job_id}/results
```

Requirements:

```text
authenticated user
Redis job exists
job.user_id matches current user
job.status complete
```

Result loader:

```text
lib/jobs/results.ts
```

R2 prefixes read:

```text
results/{user_id}/{job_id}/detections/
results/{user_id}/{job_id}/overlays/
results/{user_id}/{job_id}/frames/
uploads/{user_id}/{job_id}/raw/
```

Behavior:

```text
List detection JSONs.
If none, return emptyResults().
Optionally list overlays, frames, and raw images.
Fetch detection JSONs in batches of 50.
Presign matching overlay/frame/raw image URLs with 3600 second TTL.
Parse/derive crack metrics.
Sort frames by frame index.
Hydrate GPS from uploaded SRT if video/handheld results lack lat/lon.
Compute summary.
```

AUDIT_FLAG: The active job results path reads R2 artifacts. It does not query PostGIS `road_sections`, `detections`, or `pci_segments` for modern job results.

### Report Paths

Modern job PDF:

```text
app/api/jobs/[id]/report/route.ts
components/pdf/JobReport.tsx
@react-pdf/renderer
```

Modern project PDF:

```text
app/api/projects/[id]/report/route.ts
components/pdf/ProjectReport.tsx
@react-pdf/renderer
```

Legacy survey PDF:

```text
app/api/survey/[id]/report/route.ts
Playwright Chromium renders /report/{id}?token=...
uploads generated PDF to Supabase Storage bucket: reports
path: reports/{survey_id}/report.pdf
signed URL TTL: 60 * 60 seconds
```

AUDIT_FLAG: Report storage is split. Modern job/project reports are generated on demand as HTTP PDF responses. Legacy survey report route stores PDFs in Supabase Storage.

## Infrastructure Decisions

### Why Next.js/Vercel

Evidence:

```text
Next.js App Router codebase
docs reference Vercel and serverless upload limitations
proxy.ts handles SSR Supabase session refresh
app/api route handlers implement control-plane API
```

Architectural reason:

```text
Keep product UI, auth-gated API routes, presigned upload control plane, polling, and reports in one deployable web application.
```

Trade-offs:

```text
Next.js/Vercel should not carry raw video upload bodies or GPU inference.
Long-running processing must be externalized.
Vercel deployment state was not connector-verified.
```

### Why Cloudflare R2

Evidence:

```text
lib/r2.ts
hooks/useUpload.ts
worker boto3 S3 client
R2 bucket env: drisora-videos
```

Architectural reason:

```text
Large binary road-survey artifacts do not belong in Postgres or in Next.js serverless request bodies. R2 provides S3-compatible object storage for raw videos/images, extracted frames, detections, and manifests. Presigned PUT gives browser progress and avoids proxying media through the app server.
```

R2 key structure:

```text
uploads/{user_id}/{job_id}/raw/{filename}
results/{user_id}/{job_id}/frames/{frame_filename}
results/{user_id}/{job_id}/detections/{frame_stem}.json
results/{user_id}/{job_id}/manifests/run_manifest.json
results/{user_id}/{job_id}/manifests/frame_manifest.json
results/{user_id}/{job_id}/manifests/processing_summary.json
results/{user_id}/{job_id}/overlays/{frame_stem}.png  # reader supports, active worker did not show overlay upload in audited path
```

Presigned URL defaults:

```text
PUT: 3600 seconds
GET: 3600 seconds
```

AUDIT_FLAG: No R2 lifecycle/retention policy was found in code. Older docs/specs reference `worker/R2_CORS_CONFIG.json`, but `rg --files` did not find that file. Treat R2 CORS/lifecycle as externally configured or drifted documentation unless reintroduced.

### Why Supabase Postgres/PostGIS/RLS

Evidence:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_spatial_indexes.sql
supabase/migrations/008_projects_crack_metrics.sql
supabase/migrations/009_multi_video_survey.sql
lib/supabase/server.ts
```

Architectural reason:

```text
Supabase supplies Auth, server/client SDKs, Postgres durability, RLS tenant isolation, and PostGIS spatial data types/indexes for road sections and detections.
```

Trade-offs:

```text
Schema evolution has drifted between legacy survey tables and current job/R2 artifact flow.
RLS policies need performance hardening per Supabase advisors.
Remote migration history does not mirror local migration filenames.
```

### Why Upstash Redis REST

Evidence:

```text
lib/redis.ts uses @upstash/redis with REST URL/token
worker/handler.py uses direct httpx GET/POST to Upstash REST endpoints
```

Architectural reason:

```text
Fast cross-runtime job state is needed between Vercel/Next.js and RunPod worker. Upstash REST works from serverless environments without persistent TCP connections.
```

Stored keys:

```text
job:{job_id} -> JSON ProcessingJobRecord
user:{user_id}:jobs -> Redis list of job ids
```

Known fields in `ProcessingJobRecord`:

```text
job_id
user_id
project_id
runpod_job_id
mode
status
frame_count
processed_count
gps_available
output_r2_prefix
last_updated
created_at
error_message
options
file_names
total_bytes
average_pci
completed_at
```

TTL/cleanup:

```text
No TTL set in TypeScript saveRedisJob().
No TTL set in worker _save_job().
No cleanup strategy found for Redis job keys or user job lists.
```

AUDIT_FLAG: Redis can grow indefinitely under current code unless cleanup exists outside the repository.

### Why RunPod Serverless

Evidence:

```text
lib/runpod.ts
worker/Dockerfile
worker/handler.py
scripts/deploy_runpod_worker.mjs
README RunPod deployment notes
```

Architectural reason:

```text
GPU inference stack is too heavy for Next.js/Vercel. RunPod packages CUDA/PyTorch/YOLO/SAM2/Depth Anything V2 separately and runs it as serverless GPU work.
```

Trade-offs:

```text
Cold starts, model downloads, external platform availability, webhook failure modes, and endpoint concurrency are outside the Next.js runtime.
```

AUDIT_FLAG: No live RunPod concurrency/min-worker/max-worker/GPU-type/timeout values were connector-verified. The deploy script preserves and updates templates but does not encode all endpoint scaling policy as repository source of truth.

### Why BullMQ Is Not The Current Queue

`bullmq` is installed and `lib/queue.ts` exists, but active submission is direct RunPod `/run`. The active state queue is effectively:

```text
Supabase durable jobs row
Upstash Redis job JSON
RunPod serverless queue behind /run endpoint
```

AUDIT_FLAG: Any architecture description that says frontend -> BullMQ -> RunPod is not accurate for current active code. The correct active path is frontend -> Next.js -> Redis/Supabase -> RunPod direct submit. BullMQ is scaffold/legacy.

## Database And PostGIS Schema

### Local Migration Set

Local migrations:

```text
001_initial_schema.sql
002_rls_policies.sql
003_spatial_indexes.sql
004_profiles_google_auth.sql
005_jobs.sql
006_jobs_average_pci.sql
007_jobs_uploading_status.sql
008_projects_crack_metrics.sql
009_multi_video_survey.sql
010_consent_records.sql
```

### Extensions

`001_initial_schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Profiles

Initial:

```text
id uuid references auth.users primary key
full_name text
organization text
created_at timestamptz default now()
```

Added:

```text
user_id uuid references auth.users(id)
org_name text
role text check:
  PWD Engineer
  Municipal Corporation
  College Infrastructure Team
  Private Contractor
  Other
phone text
avatar_url text
notifications_enabled boolean not null default true
```

Constraints:

```text
profiles_user_id_unique unique(user_id)
```

RLS:

```sql
create policy "own profile" on profiles
  for all using (id = auth.uid());
```

AUDIT_FLAG: Policy uses `id = auth.uid()`, while `user_id` also exists. The migration backfills `user_id = id`, but the RLS source is still `id`.

### Surveys

Initial fields:

```text
id uuid primary key default gen_random_uuid()
user_id uuid references profiles(id)
name text not null
location text
engineer_name text
surveyed_at timestamptz
created_at timestamptz default now()
status text check in uploading, queued, processing, complete, failed default uploading
r2_key text
r2_upload_id text
srt_path text
report_path text
total_length_m float
average_pci float
coverage_area_m2 float
```

Added:

```text
project_id uuid references projects(id) on delete set null
deleted_at timestamptz
```

RLS:

```sql
create policy "own surveys" on surveys for all using (user_id = auth.uid());
```

AUDIT_FLAG: The modern job upload path inserts into `jobs`, not `surveys`. Survey tables still back legacy survey routes and project maps for historical survey-section records.

### Upload Parts

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
part_number integer not null
etag text not null
uploaded_at timestamptz default now()
unique(survey_id, part_number)
```

RLS through parent survey:

```sql
survey_id in (select id from surveys where user_id = auth.uid())
```

AUDIT_FLAG: This table supports older resumable survey upload design, not the current browser presigned PUT job path.

### Jobs

Initial legacy fields:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
status text check in queued, extracting_frames, running_detection, scoring, generating_report, complete, failed default queued
progress integer default 0
current_frame integer default 0
total_frames integer default 0
error_message text
started_at timestamptz
completed_at timestamptz
created_at timestamptz default now()
```

Current fields added/reshaped:

```text
user_id uuid references auth.users(id) on delete cascade not null
mode text not null check in image_batch, handheld_video, drone_footage
frame_count int not null default 0
processed_count int not null default 0
gps_available boolean not null default false
r2_prefix text
average_pci real
project_id uuid references projects(id) on delete set null
deleted_at timestamptz
```

Current status check:

```text
uploading
queued
extracting_frames
detecting
segmenting
scoring
complete
failed
```

Current RLS:

```sql
users_select_own_jobs:
  using (user_id = auth.uid())

users_update_own_jobs:
  using (user_id = auth.uid())
  with check (user_id = auth.uid())

users_insert_own_jobs:
  with check (user_id = auth.uid())
```

AUDIT_FLAG: Performance advisor reports `jobs.user_id` and `jobs.survey_id` foreign keys as unindexed. `jobs.survey_id` also remains from legacy schema and may be null in modern job path.

### Projects

`008_projects_crack_metrics.sql` creates:

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
name text not null
road_name text
package_code text
agency text
corridor text
location text
description text
start_chainage_km real
end_chainage_km real
combined_report_path text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
deleted_at timestamptz
```

RLS:

```sql
users_select_own_projects using user_id = auth.uid()
users_insert_own_projects with check user_id = auth.uid()
users_update_own_projects using user_id = auth.uid()
users_delete_own_projects using user_id = auth.uid()
```

Indexes:

```text
projects_user_id_created_at_idx on projects(user_id, created_at desc) where deleted_at is null
jobs_project_id_created_at_idx on jobs(project_id, created_at desc) where deleted_at is null
surveys_project_id_created_at_idx on surveys(project_id, created_at desc) where deleted_at is null
```

### Road Sections

Initial fields:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
section_index integer
geom geometry(linestring, 4326)
pci_score float
condition_category text check in good, satisfactory, fair, poor, very_poor
recommended_intervention text
priority_rank integer
length_m float
```

Added civil/crack metric fields:

```text
avg_crack_width_mm real
max_crack_width_mm real
crack_length_m_by_type jsonb not null default '{}'
dominant_crack_type text
civil_severity text check in Low, Medium, High
maintenance_priority text check in Immediate, Preventive, Routine
possible_causes text[]
recommended_mitigation text
```

Spatial index:

```sql
create index idx_road_sections_geom on road_sections using gist (geom);
```

Width index:

```text
road_sections_width_idx on road_sections(survey_id, max_crack_width_mm desc)
```

RLS through parent survey:

```sql
survey_id in (select id from surveys where user_id = auth.uid())
```

AUDIT_FLAG: Active worker does not write `road_sections` in current job path.

### Detections

Initial fields:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
section_id uuid references road_sections(id)
frame_index integer
crack_type text
severity text check in low, medium, high
bbox jsonb
mask_rle jsonb
depth_m float
confidence float
location geometry(point, 4326)
gsd_cm_per_px float
```

Added:

```text
avg_width_mm real
max_width_mm real
length_m real
density_pct real
source_video_id uuid references survey_videos(id)
```

Spatial index:

```sql
create index idx_detections_location on detections using gist (location);
```

RLS through parent survey:

```sql
survey_id in (select id from surveys where user_id = auth.uid())
```

AUDIT_FLAG: Active worker writes per-frame detection JSON to R2, not rows into `detections`.

### Survey Videos

`009_multi_video_survey.sql` creates:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
video_filename text not null
srt_filename text
storage_path text not null
flight_bounds jsonb
frame_count int
processed_frame_count int
skipped_frame_count int
status text default pending check in pending, processing, done, error
created_at timestamptz default now()
```

RLS through parent survey for select/insert/update/delete.

Index:

```text
survey_videos_survey_id_idx on survey_videos(survey_id)
```

AUDIT_FLAG: Current multi-video upload path passes video/SRT lists in job options and stores artifacts in R2. It does not write `survey_videos` rows in the active audited flow.

### Processed Zones

Fields:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id) on delete cascade
source_video_id uuid references survey_videos(id) on delete cascade
lat float not null
lon float not null
altitude float
footprint_radius_m float
frame_index int
created_at timestamptz default now()
```

Indexes:

```text
processed_zones_survey_id_idx
processed_zones_survey_id_lat_lon_idx
```

RLS through parent survey.

AUDIT_FLAG: Active worker does not write `processed_zones` in the audited job path.

### PCI Segments

Fields:

```text
id uuid primary key default gen_random_uuid()
survey_id uuid references surveys(id)
segment_index int not null
start_distance_m float not null
end_distance_m float not null
total_length_m float not null
pci_score float
pci_grade text
is_relative boolean default false
detection_count int default 0
deduct_values jsonb
source_video_ids jsonb
created_at timestamptz default now()
```

Index:

```text
pci_segments_survey_id_segment_index_idx on pci_segments(survey_id, segment_index)
```

RLS through parent survey.

AUDIT_FLAG: `worker/utils/pci_segmentation.py` can compute GPS-chainage sections, but active `worker/handler.py` does not persist computed PCI segments into this table in the audited code.

## PostGIS Spatial Query Design

Implemented spatial data types:

```text
road_sections.geom: GEOMETRY(LINESTRING, 4326)
detections.location: GEOMETRY(POINT, 4326)
```

Implemented spatial indexes:

```text
idx_road_sections_geom using GIST(geom)
idx_detections_location using GIST(location)
```

Project map behavior:

```text
lib/project-map.ts
app/api/projects/[id]/map/route.ts
```

Map output combines:

1. Legacy survey road sections from `road_sections`.
2. Modern job results hydrated from R2 detections/frames.

For modern jobs, map segments are computed client/server-side from R2 `JobResults`:

```text
filter frames with lat/lon
compute cumulative Haversine distances
group into 100 m segments
build GeoJSON LineString from frame lon/lat points
average frame PCI per segment
derive crack counts/types/widths from result JSON
mark is_relative when segment length < 100 m
```

Constants:

```text
SEGMENT_LENGTH_M = 100
EARTH_RADIUS_M = 6371000
```

AUDIT_FLAG: The current modern map path does not use PostGIS spatial queries for job-derived segments. It computes GeoJSON from R2 artifacts. PostGIS remains relevant for legacy survey section tables and future durable geospatial state.

## ML Pipeline Architecture

### Pipeline Overview

Active worker modules:

```text
worker/handler.py
worker/jobs/dispatcher.py
worker/ingest/video_handler.py
worker/ingest/gps_telemetry.py
worker/ingest/image_batch.py
worker/pipeline/yolo_inference.py
worker/pipeline/sam2_inference.py
worker/pipeline/depth_anything_v2_inference.py
worker/pipeline/pci_scorer.py
worker/utils/pci_segmentation.py
```

Core per-frame pipeline:

```text
raw upload files
  -> dispatch mode-specific ingestion
  -> extract frames or read image batch
  -> attach GPS if available/required
  -> YOLOv12s detections
  -> if detections exist, SAM2 segmentation
  -> if metric/depth enabled, Depth Anything V2 depth map and detection enrichment
  -> PCI frame score
  -> R2 detection JSON and frame upload
```

### Determinism And Cached Model State

Worker global model caches:

```python
_yolo = None
_sam2 = None
_depth = None
```

Loaders cache models across frames and across warm container invocations:

```text
get_yolo()
get_sam2()
get_depth()
```

Determinism configuration:

```text
DRISORA_DETERMINISTIC_SEED default 1337
PYTHONHASHSEED default seed
CUBLAS_WORKSPACE_CONFIG default :4096:8
random.seed(seed)
numpy.random.seed(seed) if numpy available
torch.manual_seed(seed) if torch available
torch.cuda.manual_seed_all(seed) if CUDA available
torch.backends.cudnn.benchmark = False
torch.backends.cudnn.deterministic = True
torch.use_deterministic_algorithms(True, warn_only=True) where supported
```

AUDIT_FLAG: Deterministic flags reduce nondeterminism, but GPU libraries and model internals can still have nondeterministic behavior. The code does not claim formal bitwise reproducibility.

### Frame Extraction

Dispatcher modes:

```text
image_batch
handheld_video
drone_footage
```

Frame extraction settings:

```text
frame_extraction_mode: interval | all_frames
frame_interval_seconds: float or null
```

UI profiles:

```text
all_frames -> frame_extraction_mode all_frames, frame_interval_seconds null
0.25s -> interval, 0.25
0.5s -> interval, 0.5
1s -> interval, 1
```

Extractor:

```text
worker/ingest/video_handler.py
```

Default behavior:

```text
DRISORA_USE_FFMPEG_EXTRACTOR default 1
DRISORA_DETERMINISTIC_EXTRACTOR default 1
JPEG quality default 92
```

FFprobe collects:

```text
avg_frame_rate
r_frame_rate
nb_frames
duration
width
height
codec_name
```

All-frame extraction:

```text
ffmpeg -hide_banner -loglevel error -y -i {video} -vsync 0 -start_number 0 -q:v {quality} frame_%06d.jpg
```

Interval extraction:

```text
ffmpeg ... -vf fps={1 / interval_seconds} -start_number 0 -q:v {quality} frame_%06d.jpg
```

GPU utilization in extraction:

```text
When deterministic extractor is enabled or mode is all_frames:
  ffmpeg CPU path is used.

When deterministic extractor is disabled and mode is interval:
  worker tries ffmpeg -hwaccel cuda
  falls back to CPU if CUDA ffmpeg path fails.
```

Extraction validation:

```text
expected all_frames count from nb_frames or fps * duration
expected interval count from duration / interval_seconds + 1
tolerance all_frames: actual >= 90% expected
tolerance interval: actual >= 80% expected
validation skipped if expected is missing or < 10
under-sampled video raises RuntimeError
```

OpenCV fallback:

```text
Only used when ffmpeg fails and mode is interval.
All-frames ffmpeg failure raises.
```

Drone GPS requirement:

```text
drone_footage requires readable GPS telemetry from matching DJI .SRT or embedded telemetry captions.
image_batch GPS is optional from EXIF.
handheld_video GPS is optional.
```

Error message for missing drone GPS:

```text
Drone footage has no readable GPS telemetry. Upload the matching DJI .SRT file or use a video recorded with telemetry captions enabled.
```

### YOLO Inference

Module:

```text
worker/pipeline/yolo_inference.py
```

Weights:

```text
default path: worker/weights/yolov12s_rdd2022.pt
env path: DRISORA_YOLO_WEIGHTS_PATH
optional download URL: DRISORA_YOLO_WEIGHTS_URL
```

Classes:

```text
D00
D10
D20
D40
```

Thresholds:

```text
CONFIDENCE = 0.25
IOU = 0.45
```

Device:

```text
cuda if torch.cuda.is_available()
else cpu
```

Batch behavior:

```text
worker yolo batch size default: DRISORA_YOLO_BATCH_SIZE or 64
clamped to 1..256
model.predict(..., batch=batch_size)
on batch failure, falls back to per-frame inference
```

Detection output fields:

```text
class
confidence
bbox [x1, y1, x2, y2]
area_px
frame_index when available
```

### YOLO To SAM2 Gating Logic

SAM2 is invoked only if YOLO returns detections for that frame:

```text
if no detections:
  SAM2 is skipped
  analysis_stage can be yolo_only

if detections exist:
  SAM2 is attempted
  detections are enriched with mask_area_px
```

SAM2 module:

```text
worker/pipeline/sam2_inference.py
```

SAM2 defaults:

```text
SAM2_MODEL_PATH=/tmp/models/sam2.1_hiera_small.pt
SAM2_MODEL_CFG=configs/sam2.1/sam2.1_hiera_s.yaml
SAM2_MODEL_URL default in code:
  https://dl.fbaipublicfiles.com/segment_anything_v2/sam2.1_hiera_small.pt
```

Worker env example uses:

```text
https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt
```

AUDIT_FLAG: There is a URL difference between code default and env example for SAM2 model download. If both remain valid, it is harmless; if one is stale, cold-start model download can fail.

SAM2 warm state:

```text
_PREDICTOR global cache
DRISORA_WARM_SAM2 default 0
options.warm_sam2 can enable warmup
if not warm, SAM2 loads on first detected frame
predictor.set_image(image) called per frame
```

SAM2 prediction:

```text
batched boxes first with multimask_output=True
if batched prediction fails, fall back to per-box prediction
if bbox invalid or SAM2 fails, fallback mask_area_px = area_px
mask_area_m2 remains null until depth/metric enrichment
```

AUDIT_FLAG: The current SAM2 path persists scalar mask areas, not full mask polygons or RLE masks, in active R2 detection JSON.

### Depth Anything V2 Integration

Module:

```text
worker/pipeline/depth_anything_v2_inference.py
```

Defaults:

```text
DEPTH_ANYTHING_V2_REPO=/opt/depth-anything-v2 in Docker
DEPTH_ANYTHING_V2_MODEL_PATH=/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth
DEPTH_ANYTHING_V2_MODEL_URL=https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-VKITTI-Large/resolve/main/depth_anything_v2_metric_vkitti_vitl.pth
DEPTH_ANYTHING_V2_ENCODER=vitl
DEPTH_ANYTHING_V2_INPUT_SIZE=518
DEPTH_ANYTHING_V2_MAX_DEPTH_M=80
DEFAULT_DEPTH_M=1.0
FOV_RADIANS=1.0
```

Model configs:

```text
vits: features 64, out_channels [48, 96, 192, 384]
vitb: features 128, out_channels [96, 192, 384, 768]
vitl: features 256, out_channels [256, 512, 1024, 1024]
```

Enablement:

```text
DRISORA_ENABLE_DEPTH_DEFAULT default in Docker/env: 1
options.enable_metric_analysis can enable/disable through _depth_enabled()
options.enable_depth is also recognized
```

Batch behavior:

```text
DRISORA_DEPTH_BATCH_SIZE default 4
clamped to 1..64
if invalid, fallback min(16, yolo_batch_size)
worker batches depth per YOLO frame chunk
on batch failure, depth module falls back to per-frame inference
```

Detection enrichment:

```text
depth_m
camera_surface_distance_m
pixel_size_m
mask_area_m2
crack_width_mm for non-D40 classes when derivable
metric_error = depth_anything_v2_unavailable on fallback
```

Crack width estimate:

```text
length_px = max(abs(x2 - x1), abs(y2 - y1))
area_px = mask_area_px or area_px
pixel_size_m = depth_m / focal_length_px
width_m = (area_px / length_px) * pixel_size_m
width_mm = width_m * 1000
```

D40 potholes do not receive `crack_width_mm`.

AUDIT_FLAG: Depth-derived metric widths are monocular estimates. They are not ground-truth measurements and should not be presented as certified engineering dimensions without calibration/validation.

### PCI Scoring

Module:

```text
worker/pipeline/pci_scorer.py
```

Constants:

```text
CRACK_CLASSES = {"D00", "D10", "D20"}
POTHOLE_CLASS = "D40"
IRC_STANDARD = "IRC:82-2023"
BASELINE_IRI = 2.5
SCORING_VERSION = "drisora_pci_v1"
```

Individual score formulas:

```text
pci_cracking(ce):
  if ce <= 0: 100
  denom = ce^2 - 0.737 * ce + 73.09
  score = 7231 / denom, clamped 0..100

pci_ravelling(re):
  if re <= 0: 100
  score = 52.92 * exp(-0.02525 * re) + 44.1 * exp(-0.2899 * re), clamped 0..100

pci_pothole(pn):
  if pn <= 0: 100
  score = 100 - 28 * pn, clamped 0..100

pci_patch(pe):
  same exponential form as ravelling

pci_rut(rd):
  if rd <= 0: 100
  denom = rd^2 - 0.737 * rd + 73.09
  score = 7231 / denom, clamped 0..100

pci_roughness(iri):
  formula exists, but active score uses roughness = 100 and iri = null
```

Active frame-level PCI weights:

```text
0.40 * roughness
0.16 * pothole
0.14 * rut
0.12 * cracking
0.10 * ravelling
0.08 * patching
```

Pothole cap:

```text
no potholes: cap 100
count >= 1 or extent > 0: cap 78
count >= 2 or extent >= 1%: cap 65
count >= 4 or extent >= 3%: cap 50
count >= 8 or extent >= 6%: cap 35
count >= 12 or extent >= 10%: cap 25
```

Condition and recommendation thresholds:

```text
pci > 90: Excellent, Routine Maintenance
pci > 80: Good, Preventive Maintenance
pci > 60: Satisfactory, Renewal treatment recommended
pci > 40: Fair, Minor Rehabilitation (structural evaluation)
pci > 20: Poor, Major Rehabilitation / Structural Overlay
else: Failed, Reconstruction required
```

Fallback:

```text
PCI 50
condition/recommendation from 50
individual scores 50
iri BASELINE_IRI
no cracks
```

AUDIT_FLAG: `docs/DRISORA_PCI_REPRODUCIBILITY_REPAIR_LOG.md` already notes that this is an application-level engineering heuristic, not a validated certified PCI engine. The code labels `IRC:82-2023`, but calibration against engineer-labeled survey segments remains required.

### PCI Segmentation And Mapping To Road Segments

Module:

```text
worker/utils/pci_segmentation.py
```

Constants:

```text
SEGMENT_LENGTH_M = 100.0
FINAL_SECTION_MIN_LENGTH_M = 20.0
MAX_GPS_STEP_M = 50.0
LOW_CONFIDENCE_DETECTION_FRAMES = 5
```

Grade thresholds:

```text
>= 85: Good
>= 70: Satisfactory
>= 55: Fair
>= 40: Poor
>= 25: Very Poor
>= 10: Serious
>= 0: Failed
```

Chainage logic:

```text
valid GPS requires lat/lon finite, non-zero, in valid coordinate ranges
cumulative distance uses Haversine
GPS jumps over 50 m are telemetry gaps and do not increase cumulative distance
invalid GPS frames inherit last section index
section_index = floor(cumulative_distance_m / 100)
final section shorter than 20 m merges into previous section
```

Segment output includes:

```text
section_id
start_distance_m
end_distance_m
start_lat/start_lon
end_lat/end_lon
mean_altitude_m
gsd_mm_per_px
frame_count
detection_frame_count
low_confidence
telemetry_gap_count
pci_score
pci_grade
is_relative
total_length_m
deduct_values
detection_count
detections
```

AUDIT_FLAG: This segmentation utility is present and tested in code, but active `worker/handler.py` does not call `build_pci_sections()` in the audited path. Active R2 job results are frame-level; project maps compute 100 m-ish segments from hydrated result frames in TypeScript.

## Performance Characteristics

### Instrumentation Present

The worker writes:

```text
results/{user_id}/{job_id}/manifests/processing_summary.json
```

Fields include:

```text
processed_count
frame_count
average_pci
total_detections
total_processing_ms
end_to_end_processing_ms
frames_per_minute
timing_breakdown_ms
frame_stage_totals_ms
per_frame_average_ms
unattributed_frame_loop_ms
progress_update_every_frames
yolo_batch_size
depth_batch_size
pipeline_stage_counts
degraded_frame_count
degraded_reason_counts
completed_at
```

`run_manifest.json` includes runtime and model metadata:

```text
build_sha
python version
platform
ffmpeg first line
ffprobe first line
package versions for torch, ultralytics, opencv-python-headless, runpod
deterministic seed/extractor
YOLO confidence/IoU/weights file hash
SAM2 model path/config/hash
Depth Anything V2 model path/url/encoder/default enablement
PCI scoring version/standard
```

### Measured Throughput With Real Data

AUDIT_FLAG: No connector-verified or repository-checked-in real survey `processing_summary.json` with measured production throughput was found in this audit.

The repository contains:

```text
evaluation/fixtures/sample_export.json with sample frames_per_minute = 214.3
```

That fixture is not evidence of real deployed throughput unless separately tied to an actual worker run and input dataset. The research readiness document states the system still needs real surveys and aggregate metrics.

Therefore, the exact audited answer is:

```text
Measured throughput numbers with real data: not present in audited code/connectors.
Instrumentation to record throughput: implemented.
```

### Bottlenecks Identified In Code

Implemented bottleneck mitigations:

```text
Large uploads bypass Next.js through browser presigned PUT to R2.
YOLO runs in batches, default 64, clamp 1..256.
Depth runs in batches, default 4, clamp 1..64.
R2 result JSON loading batches detection fetches by 50.
Progress updates are limited to about 100 Redis writes per job.
Full-frame extraction validates expected frame count to avoid silent undersampling.
SAM2 loads lazily by default unless warmup is enabled.
Depth Anything V2 can be disabled per job option.
Webhook-only failure is reconciled from Redis polling.
```

Known unresolved bottlenecks:

```text
One RunPod job loops through all frames for a survey.
Each frame still uploads a frame image and detection JSON to R2.
Full-frame long videos can produce very large R2 write volume.
SAM2/Depth Anything V2 model load and checkpoint download can dominate cold starts.
No active queue-depth backpressure is implemented in Next.js.
No per-user or global upload/job rate limiter was found.
No persistent observability/tracing across browser -> Next.js -> RunPod -> webhook was found.
```

### Worker Memory Utilization

AUDIT_FLAG: No measured RSS/VRAM values per worker were found in code, docs, GitHub connector output, Supabase connector output, or local artifacts inspected in this audit.

Relevant memory-pressure facts:

```text
Base image is CUDA/PyTorch runtime.
YOLO, SAM2, and Depth Anything V2 are cached in one Python process.
Depth Anything V2 Metric VKITTI Large checkpoint path is used.
Depth model is vitl by default.
YOLO batch default is 64.
Depth batch default is 4.
Frame extraction writes frames to /tmp/{job_id}.
Each processed frame is uploaded to R2 but local temp directory remains until job finally block deletes /tmp/{job_id}.
```

AUDIT_FLAG: Peak disk usage under `/tmp` can be high for full-frame videos because extracted frames and detection JSONs accumulate during the job. The code cleans at job end, not continuously per frame.

### Known Limits

Client/API limits implemented:

```text
image_batch maximum files: 1000
image_batch per-file UI size limit: 50 MB
safe storage filename length: <= 240 in API
client sanitized basename length before numeric prefix: <= 180
handheld_video: 1 video plus optional 1 .srt
drone_footage single: 1 video plus optional 1 .srt
drone_footage multi: video_count > 0, uploaded videos must equal video_count, SRT count <= video_count
presigned PUT URL TTL: 3600 seconds
presigned GET URL TTL: 3600 seconds
Supabase Storage survey report signed URL TTL: 3600 seconds
worker YOLO batch size: 1..256
worker Depth batch size: 1..64
worker progress update target: about 100 updates per job
GPS telemetry gap threshold: 50 m
PCI segment length: 100 m
final PCI section merge threshold: 20 m
low-confidence detection segment threshold: < 5 frames with detections
```

Limits not implemented/found:

```text
No explicit video file size cap in upload panels or API.
No global total_bytes cap in /api/jobs/create beyond positive finite number.
No explicit max concurrent users.
No explicit max job queue depth.
No explicit max multi-video count other than >0 and matching counts.
No route-level rate limiting.
No R2 retention/lifecycle policy in repo.
No RunPod endpoint concurrency config in repo.
No Redis TTL/cleanup policy in code.
```

## Security And Auth

### Route-Level Auth Patterns

Common API pattern:

```text
create Supabase server client
supabase.auth.getUser()
return 401 when no user
check row/user ownership in query or Redis job
return 403/404 when ownership fails
```

Examples:

```text
/api/jobs/create checks project ownership before linking project_id
/api/upload/presign requires Redis job.user_id === user.id
/api/jobs/[id]/submit requires Redis job.user_id === user.id
/api/jobs/[id] requires Redis job.user_id === user.id
/api/projects routes filter by user_id
```

Webhook security:

```text
shared secret header x-webhook-secret
service role only after secret validation
job_id and user_id both used in Supabase update predicate
```

Report-token exception:

```text
proxy.ts allows /report/{id}?token=... without normal auth
```

AUDIT_FLAG: The report token secret and implementation should be audited separately if public report links are used; this audit confirmed the proxy bypass shape, not cryptographic design of report token generation.

### RLS Protection Summary

RLS enabled locally on:

```text
profiles
surveys
upload_parts
road_sections
detections
jobs
projects
survey_videos
processed_zones
pci_segments
consent_records
```

Protected ownership surfaces:

```text
profiles: own profile by auth.uid()
surveys: own surveys by user_id
jobs: own jobs by user_id
projects: own projects by user_id
upload_parts/road_sections/detections/survey_videos/processed_zones/pci_segments: ownership through parent survey
consent_records: select/insert own only
```

Service-role bypass:

```text
webhook finalization
legacy survey PDF generation/storage
potential server-side erasure or admin operations
```

AUDIT_FLAG: Supabase advisor warns several policies repeatedly call `auth.uid()` directly, which can cause per-row initplan overhead. Performance hardening should wrap these as `(select auth.uid())` where appropriate.

### Rate Limiting

No active rate limiter was found for:

```text
login/OAuth initiation
consent API
job creation
presign
job submission
results loading
report generation
webhook endpoint beyond shared secret
```

AUDIT_FLAG: Terms mention usage limits/access controls, but route-level rate limiting is not implemented in code inspected here.

### Input Validation And Object Storage Safety

Implemented protections:

```text
safe storage filenames restrict characters
filenames cannot contain ..
worker rejects uploaded filenames containing slash, backslash, or ..
job manifest controls which files can be presigned
project ownership checked before linking
drone footage GPS requirement prevents scoring unmapped drone footage
webhook validates status/counts/average types
R2 upload keys include authenticated user id and job id
```

Potential gaps:

```text
MIME/type validation is primarily client-side for video/image types.
API does not enforce total byte caps or actual uploaded byte count after R2 PUT.
No malware/content scanning.
No object lifecycle cleanup after job deletion.
Delete job route soft-deletes Supabase job but does not delete R2 objects or Redis keys.
```

### Supabase Security Advisor Findings

Connector-confirmed:

```text
public.set_updated_at mutable search_path
public.rls_auto_enable() SECURITY DEFINER executable by anon
public.rls_auto_enable() SECURITY DEFINER executable by authenticated
leaked password protection disabled
```

AUDIT_FLAG: These are live-project security hardening findings, not just code style issues.

## Known Limitations And Technical Debt

### Active Architecture Drift

1. BullMQ exists but is not active.

```text
lib/queue.ts defines survey-processing queue.
Current job submit path calls RunPod directly.
Queue connection is not a complete Upstash TCP Redis config.
```

2. Survey tables exist but modern job path is R2-artifact-based.

```text
road_sections/detections/pci_segments are not written by active worker.
legacy survey result/report routes still read them.
modern project map derives job features from R2 result JSON.
```

3. Worker status contract is broader than emitted statuses.

```text
SQL/TS allow segmenting/scoring.
worker emits extracting_frames -> detecting -> complete/failed.
```

4. R2 CORS config is referenced in old docs/specs but file is absent.

```text
docs/superpowers specs reference worker/R2_CORS_CONFIG.json.
rg --files did not find that file.
```

5. Supabase remote migration history does not mirror local migration filenames.

```text
connector saw only 20260611025656 consent_records.
local repo has 001..010 SQL migrations.
```

### Scale Breakpoints

Likely scale failure modes from audited code:

```text
Redis key/list growth because no TTL/cleanup is set.
R2 object growth because no lifecycle/retention/delete-on-job-delete policy is implemented.
Very long all-frame videos can fill /tmp during worker execution.
Per-frame R2 writes can become expensive/slow for high-FPS long videos.
No upload byte cap means users can create jobs with very large videos.
No route-level rate limiting means API can be abused until upstream platform limits intervene.
No application-level queue-depth backpressure means RunPod/API quotas become the real limiter.
No role-based permission model means all authenticated owners can operate their own jobs/projects with the same power.
Legacy and modern data models can produce inconsistent reporting if both are used for the same survey concept.
```

### Unimplemented Or Not Clear

Not implemented/found:

```text
WebSocket realtime progress
active BullMQ worker path
PostGIS persistence for modern RunPod detections/segments
role-based permissions for drone operator vs engineer
R2 lifecycle/retention policy
Redis TTL cleanup
video upload max file size
global max concurrent users
max job queue depth
RunPod endpoint scaling config in repo
Vercel deployment config/connector verification
Railway deployment
Cloudflare Worker deployment
rate limiting
memory/VRAM telemetry
OpenTelemetry/tracing
real-survey throughput table checked into repo
full mask polygon/RLE persistence from SAM2
certified PCI validation against engineer-reviewed labels
```

Not clear from code alone:

```text
Whether R2 CORS is configured in Cloudflare dashboard.
Whether R2 lifecycle/retention is configured outside repo.
Whether Vercel env vars exactly match local env examples.
Whether RunPod endpoint min/max workers, GPU type, idle timeout, and request timeout are set appropriately.
Whether Supabase remote schema exactly matches local migrations despite migration-history mismatch.
Whether Upstash instance has external maxmemory/eviction policies.
```

### Code-Level Workarounds And Defects

Observed in worker:

```text
worker/handler.py has a duplicate `return f"job:{job_id}"` after an earlier return in _job_key().
worker/handler.py writes duplicate "progress_update_target": 100 in run_manifest performance.
Webhook-only failure is reconciled by client polling status route.
```

Observed in docs/config:

```text
R2_CORS_CONFIG.json referenced but absent.
Some docs/plans describe worker polling Redis or BullMQ-style paths that no longer match the active serverless direct-submit path.
```

AUDIT_FLAG: These are not all user-visible bugs, but they are architectural reliability debt.

## End-To-End Request Lifecycles

### New User Login With Google And Consent

```text
User opens /login.
ConsentFields collects DOB, ToS, Privacy.
Client validates DOB with meetsAgeFloor().
Client stores pending consent payload in localStorage with professional_capacity=true.
Client starts Supabase Google OAuth.
Google/Supabase redirect to /auth/callback?code=...
/auth/callback exchanges code for session.
/auth/callback loads profiles.org_name and profiles.role.
If profile missing onboarding data, redirect /onboarding.
ConsentSync persists pending consent through POST /api/consent once authenticated.
/api/consent revalidates DOB age >= 18 server-side.
/api/consent upserts consent_records row for current ToS/Privacy versions.
```

### Image Batch Upload And Processing

```text
User selects images in ImageBatchPanel.
Client rejects non-image MIME and files > 50 MB.
Client caps selected list to 1000 images.
User chooses optional Metric Analysis.
useUpload normalizes storage names.
POST /api/jobs/create with mode=image_batch.
API enforces 1000-file maximum and safe names.
API inserts Supabase jobs status=uploading.
API writes Redis job:{id} and user:{user}:jobs.
POST /api/upload/presign.
API returns one R2 presigned PUT per file.
Browser XHR PUTs files to uploads/{user}/{job}/raw/.
Browser retries failed files with fresh presigned URLs if needed.
POST /api/jobs/{id}/submit.
Next.js calls RunPod /run.
Worker downloads raw images.
dispatcher image_batch reads EXIF GPS if present.
Worker runs YOLO/SAM2/Depth/PCI per frame/image.
Worker writes frames, detections, manifests, processing summary to R2.
Worker updates Redis progress.
Worker posts completion webhook.
Next.js webhook service-role updates Supabase jobs.
Browser polls /api/jobs/{id}.
Results page calls /api/jobs/{id}/results and hydrates R2 detections/media.
```

### Single Drone Video Upload And Processing

```text
User selects MP4/MOV and optional .SRT in DroneFootagePanel.
Client validates video extension/type and SRT extension.
User chooses frame extraction profile.
useUpload sends mode=drone_footage and gps_source=srt or embedded.
Job creation enforces one video plus optional SRT.
Browser uploads raw video/SRT to R2.
Submit triggers RunPod.
Worker downloads files.
dispatcher load_gps_telemetry(video, srt_path) reads SRT or embedded telemetry.
If no GPS entries, worker raises DRONE_GPS_REQUIRED_MESSAGE and job fails.
Worker extracts all frames or interval frames.
Worker attaches nearest GPS entry per timestamp.
Worker processes frames, writes results, webhook finalizes job.
```

### Multi-Video Drone Upload And Processing

```text
User chooses multi mode in DroneFootagePanel.
Client builds video_filenames and optional srt_filenames arrays.
useUpload maps original names to storage names.
POST /api/jobs/create with options.is_multi_video=true and video_count.
API checks:
  video_count > 0
  video_filenames length == video_count
  optional srt_filenames length == video_count if present
  uploaded video count == video_count
  uploaded SRT count <= video_count
  uploaded SRT count equals non-empty srt_filenames count
Worker reconstructs per-video entries with storage/original mappings.
For each video:
  GPS telemetry is required.
  frames are extracted.
  GPS is attached.
Worker concatenates frames with continuous indices.
Worker processes all frames in one job.
```

AUDIT_FLAG: No explicit max multi-video count was found.

### Result Read And Project Map

```text
User opens job results.
Next.js confirms job complete in Redis.
loadJobResults lists R2 detection JSONs.
It batches JSON reads by 50.
It presigns media URLs for frames/overlays/raw images when available.
It derives crack metrics and hydrates GPS from SRT if needed.
Project map route loads linked completed jobs and surveys.
Survey sections come from PostGIS road_sections.
Job sections are computed from R2 frame GPS into 100 m LineStrings.
```

## File-Level Architecture Map

Control plane:

```text
proxy.ts
lib/supabase/server.ts
lib/supabase/client.ts
lib/redis.ts
lib/r2.ts
lib/runpod.ts
lib/jobs/submit.ts
lib/jobs/results.ts
lib/project-map.ts
```

Upload and jobs:

```text
hooks/useUpload.ts
components/upload/ImageBatchPanel.tsx
components/upload/HandheldVideoPanel.tsx
components/upload/DroneFootagePanel.tsx
app/api/jobs/create/route.ts
app/api/upload/presign/route.ts
app/api/jobs/[id]/submit/route.ts
app/api/jobs/[id]/route.ts
app/api/jobs/[id]/results/route.ts
app/api/jobs/[id]/retry/route.ts
app/api/webhooks/job-complete/route.ts
```

Auth and consent:

```text
app/(auth)/login/page.tsx
app/auth/callback/route.ts
app/api/consent/route.ts
components/legal/ConsentFields.tsx
components/legal/ReConsentModal.tsx
components/legal/ConsentSync.tsx
lib/legal/versions.ts
supabase/migrations/010_consent_records.sql
```

Database:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_spatial_indexes.sql
supabase/migrations/004_profiles_google_auth.sql
supabase/migrations/005_jobs.sql
supabase/migrations/006_jobs_average_pci.sql
supabase/migrations/007_jobs_uploading_status.sql
supabase/migrations/008_projects_crack_metrics.sql
supabase/migrations/009_multi_video_survey.sql
supabase/migrations/010_consent_records.sql
```

Worker:

```text
worker/Dockerfile
worker/requirements.txt
worker/handler.py
worker/main.py
worker/jobs/dispatcher.py
worker/ingest/video_handler.py
worker/ingest/gps_telemetry.py
worker/ingest/image_batch.py
worker/pipeline/yolo_inference.py
worker/pipeline/sam2_inference.py
worker/pipeline/depth_anything_v2_inference.py
worker/pipeline/pci_scorer.py
worker/utils/pci_segmentation.py
worker/utils/gps_dedup.py
worker/utils/gsd_calibration.py
```

Deployment:

```text
scripts/deploy_runpod_worker.mjs
package.json deploy:runpod
.env.example
.env.local.example
worker/.env.example
```

Reports:

```text
app/api/jobs/[id]/report/route.ts
app/api/projects/[id]/report/route.ts
app/api/survey/[id]/report/route.ts
components/pdf/JobReport.tsx
components/pdf/ProjectReport.tsx
app/report/[id]/page.tsx
```

Legacy/retired:

```text
app/api/job/callback/route.ts
app/api/survey/[id]/ingest/route.ts
app/api/survey/[id]/status/route.ts
app/api/survey/[id]/results/route.ts
worker/main.py
lib/queue.ts
```

## Priority Hardening Recommendations

These are not summaries; they are direct architecture actions implied by the audit evidence.

1. Decide and document the active queue model.

```text
Either remove BullMQ from the architecture/product docs or implement it correctly with a TCP-compatible Redis endpoint and an actual worker consumer. Current active architecture is direct RunPod submit plus Upstash REST job state.
```

2. Add Redis and R2 lifecycle cleanup.

```text
Set TTLs for job:{id} after terminal state.
Expire or compact user:{user_id}:jobs.
Delete R2 raw/results objects when jobs are permanently deleted, or define retention policy.
```

3. Add explicit upload and job backpressure.

```text
Server-enforce video max file size and total_bytes caps.
Add per-user job creation/submission rate limits.
Add max active jobs per user.
Expose RunPod queue/backlog state if possible.
```

4. Make modern job results durable in PostGIS or document R2 as source of truth.

```text
If PostGIS is required for reports/maps/querying, persist road_sections/detections/pci_segments from worker output.
If R2 is the source of truth, mark legacy survey tables as legacy and reduce duplicate pathways.
```

5. Align status machines.

```text
Either emit segmenting/scoring from worker or remove those states from active UX expectations.
Add a state-machine test covering upload -> queued -> extracting_frames -> detecting -> complete/failed.
```

6. Fix Supabase advisor warnings.

```text
Lock search_path for public.set_updated_at.
Restrict rls_auto_enable() execute privileges.
Enable leaked password protection if using password auth.
Add missing FK indexes or intentionally suppress with evidence.
Wrap auth.uid() as (select auth.uid()) in RLS policies where appropriate.
```

7. Capture real performance evidence.

```text
Run representative real surveys through deployed RunPod.
Archive run_manifest.json, frame_manifest.json, processing_summary.json, and input manifest hashes.
Record frames/minute, model-stage timings, R2 write volume, /tmp usage, and GPU memory.
```

8. Source-control deployment topology.

```text
Add non-secret deployment metadata for Vercel project mapping, RunPod endpoint/template settings, R2 CORS, and lifecycle policy.
Keep secret values in environment only.
```

9. Clarify role permissions.

```text
If Drisora needs drone operator vs engineer workflows, add role enum values and route-level policy checks. Current role field is onboarding metadata only.
```

10. Validate PCI and metric claims.

```text
Keep documents clear that drisora_pci_v1 is a PCI-style heuristic until calibrated against engineer-reviewed labels.
Do not call depth-derived widths certified physical measurements without validation.
```

## Bottom Line

The implemented architecture is a modern serverless control plane plus external GPU inference plane:

```text
Next.js/Supabase controls identity, authorization, metadata, presigning, submission, results, and reports.
R2 holds raw and derived binary artifacts.
Upstash Redis holds fast mutable job state.
RunPod executes the heavy CV/ML pipeline.
PostGIS exists for durable geospatial records but is only partially integrated with the active modern job path.
```

The most important correction to make in any external architecture description is that the current active job flow is not frontend -> BullMQ -> RunPod. It is frontend -> Next.js -> Supabase/Upstash -> RunPod direct submit -> R2 artifacts -> webhook -> Supabase/Redis -> client results.

The most important engineering risks are lifecycle cleanup, missing rate/backpressure controls, absent live performance/memory evidence, Supabase advisor warnings, RunPod/Vercel configuration not fully source-controlled, and the split between legacy PostGIS survey records and modern R2-backed job results.
