"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobMode } from "@/app/api/jobs/create/route";

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
