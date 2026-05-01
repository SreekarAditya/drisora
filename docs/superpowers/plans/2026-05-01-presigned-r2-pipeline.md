# Presigned R2 Upload + Full Pipeline Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multipart proxy uploads with client-side presigned R2 PUTs, wire all three upload panels end-to-end, rebuild the worker main loop, and add job status/webhook API routes.

**Architecture:** Client calls `/api/jobs/create` → `/api/upload/presign` → XHR PUTs directly to R2; RunPod worker polls Redis, downloads from R2, processes frame-by-frame, uploads results, then POSTs webhook to Next.js; webhook updates Supabase async.

**Tech Stack:** Next.js App Router, @aws-sdk/client-s3 + s3-request-presigner, Upstash Redis, Supabase (service role for webhook), boto3 + python-dotenv (worker), RunPod Docker

---

## File Map

**Create:**
- `hooks/useUpload.ts` — shared XHR upload hook (job-create → presign → XHR loop)
- `app/api/jobs/[id]/route.ts` — GET job status from Redis (auth-gated)
- `app/api/webhooks/job-complete/route.ts` — POST from worker, updates Supabase async
- `worker/main.py` — new RunPod entrypoint (poll loop + R2 download/upload)
- `worker/R2_CORS_CONFIG.json` — CORS config to paste into Cloudflare Dashboard
- `supabase/migrations/005_jobs.sql` — jobs table with RLS

**Rewrite:**
- `lib/r2.ts` — replace multipart helpers with `getPresignedPutUrl`, rename env vars to R2_*
- `app/api/upload/presign/route.ts` — new auth-gated presign endpoint
- `app/api/jobs/create/route.ts` — new status enum, add Supabase insert, add last_updated/output_r2_prefix/error_message fields
- `components/upload/ImageBatchPanel.tsx` — use useUpload hook + per-file progress
- `components/upload/HandheldVideoPanel.tsx` — use useUpload hook + per-file progress
- `components/upload/DroneFootagePanel.tsx` — use useUpload hook + per-file progress
- `worker/Dockerfile` — update CMD to main.py, add all packages
- `worker/requirements.txt` — add python-dotenv
- `worker/handler.py` — remove (replaced by main.py)

**Delete:**
- `app/api/upload/abort/route.ts`
- `app/api/upload/complete/route.ts`
- `app/api/upload/initiate/route.ts`
- `app/api/upload/metadata/route.ts`
- `app/api/upload/r2-webhook/route.ts`
- `app/api/upload/resume/route.ts`

**Update:**
- `README.md` — CORS setup note

---

## Task 1: Rewrite lib/r2.ts

**Files:** Modify `lib/r2.ts`

- [ ] Replace contents with lazy S3Client init + single `getPresignedPutUrl` export using R2_* env vars:

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _r2: S3Client | null = null;

function getR2Client(): S3Client {
  if (_r2) return _r2;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 environment variables");
  }
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _r2;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Missing R2_BUCKET_NAME");
  return bucket;
}

export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  ttlSeconds = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: ttlSeconds });
}
```

---

## Task 2: Rewrite app/api/upload/presign/route.ts

**Files:** Modify `app/api/upload/presign/route.ts`

- [ ] Replace full file with:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPresignedPutUrl } from "@/lib/r2";

interface FileInput {
  name: string;
  size: number;
  type: string;
}

interface PresignBody {
  job_id: string;
  files: FileInput[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PresignBody;
  try {
    body = (await request.json()) as PresignBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.job_id || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json(
      { error: "job_id and files are required" },
      { status: 400 },
    );
  }

  const urls = await Promise.all(
    body.files.map(async (file) => {
      const r2_key = `uploads/${user.id}/${body.job_id}/raw/${file.name}`;
      const presigned_url = await getPresignedPutUrl(
        r2_key,
        file.type || "application/octet-stream",
      );
      return { filename: file.name, presigned_url, r2_key };
    }),
  );

  return NextResponse.json({ urls });
}
```

---

## Task 3: Rewrite app/api/jobs/create/route.ts

**Files:** Modify `app/api/jobs/create/route.ts`

- [ ] Replace full file:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";

export type JobMode = "image_batch" | "handheld_video" | "drone_footage";

export type JobStatus =
  | "queued"
  | "extracting_frames"
  | "detecting"
  | "segmenting"
  | "scoring"
  | "complete"
  | "failed";

export interface JobRecord {
  job_id: string;
  user_id: string;
  mode: JobMode;
  status: JobStatus;
  frame_count: number;
  processed_count: number;
  gps_available: boolean;
  output_r2_prefix: string;
  last_updated: string;
  created_at: string;
  error_message: string | null;
  options: Record<string, unknown>;
  file_names: string[];
  total_bytes: number;
}

interface CreateJobBody {
  mode: JobMode;
  file_count: number;
  file_names: string[];
  total_bytes: number;
  options?: Record<string, unknown>;
}

const VALID_MODES: JobMode[] = ["image_batch", "handheld_video", "drone_footage"];

function jobKey(jobId: string) {
  return `job:${jobId}`;
}

function userJobsKey(userId: string) {
  return `user:${userId}:jobs`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json(
      { error: `Invalid mode. Expected one of ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.file_names) || body.file_names.length === 0) {
    return NextResponse.json({ error: "file_names is required" }, { status: 400 });
  }

  if (body.mode === "image_batch" && body.file_names.length > 1000) {
    return NextResponse.json(
      { error: "Image batch limited to 1,000 files" },
      { status: 400 },
    );
  }

  if (
    (body.mode === "handheld_video" || body.mode === "drone_footage") &&
    body.file_count !== 1
  ) {
    return NextResponse.json(
      { error: "Video modes require exactly one video file" },
      { status: 400 },
    );
  }

  const options = body.options ?? {};
  const gpsAvailable =
    body.mode === "image_batch"
      ? true
      : body.mode === "handheld_video"
        ? false
        : options.gps_source === "embedded" || options.has_srt === true;

  if (body.mode === "drone_footage" && !gpsAvailable) {
    return NextResponse.json(
      { error: "Drone footage requires embedded GPS or an .SRT file" },
      { status: 400 },
    );
  }

  const jobId = randomUUID();
  const now = new Date().toISOString();

  const job: JobRecord = {
    job_id: jobId,
    user_id: user.id,
    mode: body.mode,
    status: "queued",
    frame_count: 0,
    processed_count: 0,
    gps_available: gpsAvailable,
    output_r2_prefix: `results/${user.id}/${jobId}`,
    last_updated: now,
    created_at: now,
    error_message: null,
    options,
    file_names: body.file_names,
    total_bytes: body.total_bytes ?? 0,
  };

  const redis = getRedisClient();
  await Promise.all([
    redis.set(jobKey(job.job_id), JSON.stringify(job)),
    redis.lpush(userJobsKey(user.id), job.job_id),
  ]);

  await supabase.from("jobs").insert({
    id: jobId,
    user_id: user.id,
    mode: body.mode,
    status: "queued",
    frame_count: 0,
    gps_available: gpsAvailable,
    r2_prefix: `results/${user.id}/${jobId}`,
    created_at: now,
  });

  return NextResponse.json({ job_id: job.job_id, job }, { status: 201 });
}
```

---

## Task 4: Create app/api/jobs/[id]/route.ts

**Files:** Create `app/api/jobs/[id]/route.ts`

- [ ] Create file:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import type { JobRecord } from "@/app/api/jobs/create/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const redis = getRedisClient();
  const raw = await redis.get<string>(`job:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = (typeof raw === "string" ? JSON.parse(raw) : raw) as JobRecord;
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    status: job.status,
    processed_count: job.processed_count,
    frame_count: job.frame_count,
    mode: job.mode,
    gps_available: job.gps_available,
    error_message: job.error_message ?? null,
  });
}
```

---

## Task 5: Create app/api/webhooks/job-complete/route.ts

**Files:** Create `app/api/webhooks/job-complete/route.ts`

- [ ] Create file:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface WebhookBody {
  job_id: string;
  user_id: string;
  status: string;
  error_message?: string;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WORKER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as WebhookBody;

  void updateSupabase(body);

  return NextResponse.json({ ok: true });
}

async function updateSupabase(body: WebhookBody) {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from("jobs")
      .update({
        status: body.status,
        completed_at: new Date().toISOString(),
        error_message: body.error_message ?? null,
      })
      .eq("id", body.job_id);
  } catch (err) {
    console.error("webhook supabase update failed:", err);
  }
}
```

---

## Task 6: Delete 6 multipart upload routes + handler.py

**Files:** Delete `app/api/upload/{abort,complete,initiate,metadata,r2-webhook,resume}/route.ts` and `worker/handler.py`

- [ ] Run:
```bash
rm -rf app/api/upload/abort app/api/upload/complete app/api/upload/initiate \
  app/api/upload/metadata app/api/upload/r2-webhook app/api/upload/resume \
  worker/handler.py
```

---

## Task 7: Create hooks/useUpload.ts

**Files:** Create `hooks/useUpload.ts`

- [ ] Create file:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobMode } from "@/app/api/jobs/create/route";

export interface UploadFileSpec {
  name: string;
  size: number;
  type: string;
}

export interface UseUploadOptions {
  mode: JobMode;
  file_names: string[];
  total_bytes: number;
  options?: Record<string, unknown>;
}

export type UploadPhase =
  | "idle"
  | "creating_job"
  | "presigning"
  | "uploading"
  | "error";

export function useUpload() {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const pendingFilesRef = useRef<File[]>([]);

  const startUpload = useCallback(
    async (files: File[], jobOptions: UseUploadOptions) => {
      setPhase("creating_job");
      setUploadError(null);
      setProgress(new Map());
      setFailedFiles(new Set());
      pendingFilesRef.current = files;

      const jobRes = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: jobOptions.mode,
          file_count: files.length,
          file_names: jobOptions.file_names,
          total_bytes: jobOptions.total_bytes,
          options: jobOptions.options ?? {},
        }),
      });

      if (!jobRes.ok) {
        const text = await jobRes.text();
        setUploadError(text || `Failed to create job (${jobRes.status})`);
        setPhase("error");
        return;
      }

      const { job_id } = (await jobRes.json()) as { job_id: string };
      jobIdRef.current = job_id;

      setPhase("presigning");

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id,
          files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        }),
      });

      if (!presignRes.ok) {
        const text = await presignRes.text();
        setUploadError(text || `Failed to get upload URLs (${presignRes.status})`);
        setPhase("error");
        return;
      }

      const { urls } = (await presignRes.json()) as {
        urls: Array<{ filename: string; presigned_url: string; r2_key: string }>;
      };

      setPhase("uploading");
      setProgress(new Map(files.map((f) => [f.name, 0])));

      const results = await Promise.allSettled(
        files.map((file) => {
          const entry = urls.find((u) => u.filename === file.name);
          if (!entry) return Promise.reject(new Error(`No URL for ${file.name}`));
          return xhrUpload(file, entry.presigned_url, (pct) =>
            setProgress((prev) => new Map(prev).set(file.name, pct)),
          );
        }),
      );

      const failed = new Set<string>();
      results.forEach((result, i) => {
        if (result.status === "rejected") failed.add(files[i].name);
      });

      if (failed.size > 0) {
        setFailedFiles(failed);
        setPhase("error");
        return;
      }

      router.push(`/jobs/${job_id}`);
    },
    [router],
  );

  const retryFile = useCallback(
    async (filename: string) => {
      if (!jobIdRef.current) return;
      const file = pendingFilesRef.current.find((f) => f.name === filename);
      if (!file) return;

      setFailedFiles((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
      setProgress((prev) => new Map(prev).set(filename, 0));

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobIdRef.current,
          files: [{ name: file.name, size: file.size, type: file.type }],
        }),
      });

      if (!presignRes.ok) {
        setFailedFiles((prev) => new Set(prev).add(filename));
        return;
      }

      const { urls } = (await presignRes.json()) as {
        urls: Array<{ filename: string; presigned_url: string }>;
      };
      const url = urls[0]?.presigned_url;
      if (!url) {
        setFailedFiles((prev) => new Set(prev).add(filename));
        return;
      }

      try {
        await xhrUpload(file, url, (pct) =>
          setProgress((prev) => new Map(prev).set(filename, pct)),
        );
        setFailedFiles((prev) => {
          const next = new Set(prev);
          next.delete(filename);
          if (next.size === 0 && jobIdRef.current) {
            router.push(`/jobs/${jobIdRef.current}`);
          }
          return next;
        });
      } catch {
        setFailedFiles((prev) => new Set(prev).add(filename));
      }
    },
    [router],
  );

  return { phase, progress, failedFiles, uploadError, startUpload, retryFile };
}

function xhrUpload(
  file: File,
  url: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}
```

---

## Task 8: Update ImageBatchPanel.tsx

**Files:** Modify `components/upload/ImageBatchPanel.tsx`

- [ ] Replace full file content with version that uses `useUpload` and shows per-file progress bars and retry buttons.

---

## Task 9: Update HandheldVideoPanel.tsx

**Files:** Modify `components/upload/HandheldVideoPanel.tsx`

- [ ] Replace full file content with version that uses `useUpload`.

---

## Task 10: Update DroneFootagePanel.tsx

**Files:** Modify `components/upload/DroneFootagePanel.tsx`

- [ ] Replace full file content with version that uses `useUpload`.

---

## Task 11: Create supabase/migrations/005_jobs.sql

**Files:** Create `supabase/migrations/005_jobs.sql`

---

## Task 12: Update worker/requirements.txt + Dockerfile

**Files:** Modify `worker/requirements.txt`, `worker/Dockerfile`

---

## Task 13: Create worker/main.py

**Files:** Create `worker/main.py`

---

## Task 14: Create worker/R2_CORS_CONFIG.json + update README.md

---

## Task 15: TypeScript check

- [ ] Run: `npx tsc --noEmit`
- [ ] Fix any errors.
- [ ] Commit all changes.
