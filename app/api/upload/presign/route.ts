import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRedisJob } from "@/lib/jobs/submit";
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

const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

function isSafeStorageName(name: string) {
  return (
    name.length > 0 &&
    name.length <= 240 &&
    SAFE_FILE_NAME.test(name) &&
    !name.includes("..")
  );
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

  const job = await loadRedisJob(body.job_id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "uploading") {
    return NextResponse.json(
      { error: `Cannot upload files while job is ${job.status}` },
      { status: 409 },
    );
  }

  const allowedNames = new Set(job.file_names);
  for (const file of body.files) {
    if (
      typeof file.name !== "string" ||
      !isSafeStorageName(file.name) ||
      !allowedNames.has(file.name) ||
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      return NextResponse.json(
        { error: "files must match the job upload manifest" },
        { status: 400 },
      );
    }
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
