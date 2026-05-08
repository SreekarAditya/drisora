"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobMode } from "@/types";

export interface UseUploadOptions {
  mode: JobMode;
  project_id?: string | null;
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

interface UploadItem {
  file: File;
  storageName: string;
  label: string;
}

export function useUpload() {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());
  const [fileLabels, setFileLabels] = useState<Map<string, string>>(new Map());
  const [uploadError, setUploadError] = useState<string | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const pendingFilesRef = useRef<UploadItem[]>([]);

  const submitJob = useCallback(
    async (jobId: string) => {
      const submitRes = await fetch(`/api/jobs/${jobId}/submit`, {
        method: "POST",
      });

      if (!submitRes.ok) {
        throw new Error(await responseMessage(submitRes, "Failed to start processing"));
      }

      router.push(`/jobs/${jobId}`);
    },
    [router],
  );

  const startUpload = useCallback(
    async (files: File[], jobOptions: UseUploadOptions) => {
      setPhase("creating_job");
      setUploadError(null);
      setProgress(new Map());
      setFailedFiles(new Set());
      const uploadItems = files.map((file, index) => ({
        file,
        storageName: storageFileName(file.name, index),
        label: uploadLabel(file.name, index, files),
      }));
      const uploadOptions = {
        ...(jobOptions.options ?? {}),
        original_file_names: jobOptions.file_names,
        storage_file_names: uploadItems.map((item) => item.storageName),
        srt_storage_name: srtStorageName(jobOptions.options, jobOptions.file_names, uploadItems),
        video_storage_filenames: storageNamesForList(
          jobOptions.options,
          "video_filenames",
          jobOptions.file_names,
          uploadItems,
        ),
        srt_storage_filenames: storageNamesForList(
          jobOptions.options,
          "srt_filenames",
          jobOptions.file_names,
          uploadItems,
        ),
      };
      pendingFilesRef.current = uploadItems;
      setFileLabels(new Map(uploadItems.map((item) => [item.storageName, item.label])));

      const jobRes = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: jobOptions.mode,
          project_id: jobOptions.project_id ?? null,
          file_count: files.length,
          file_names: uploadItems.map((item) => item.storageName),
          total_bytes: jobOptions.total_bytes,
          options: uploadOptions,
        }),
      });

      if (!jobRes.ok) {
        const text = await jobRes.text();
        let message = `Failed to create job (${jobRes.status})`;
        try {
          const json = JSON.parse(text) as { error?: string };
          if (json.error) message = json.error;
        } catch {
          if (text) message = text;
        }
        setUploadError(message);
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
          files: uploadItems.map((item) => ({
            name: item.storageName,
            size: item.file.size,
            type: item.file.type,
          })),
        }),
      });

      if (!presignRes.ok) {
        const text = await presignRes.text();
        let message = `Failed to get upload URLs (${presignRes.status})`;
        try {
          const json = JSON.parse(text) as { error?: string };
          if (json.error) message = json.error;
        } catch {
          if (text) message = text;
        }
        setUploadError(message);
        setPhase("error");
        return;
      }

      const { urls } = (await presignRes.json()) as {
        urls: Array<{ filename: string; presigned_url: string; r2_key: string }>;
      };

      setPhase("uploading");
      setProgress(new Map(uploadItems.map((item) => [item.storageName, 0])));
      const urlsByName = new Map(urls.map((url) => [url.filename, url]));

      const results = await Promise.allSettled(
        uploadItems.map((item) => {
          const entry = urlsByName.get(item.storageName);
          if (!entry) return Promise.reject(new Error(`No URL for ${item.label}`));
          return xhrUpload(item.file, entry.presigned_url, (pct) =>
            setProgress((prev) => new Map(prev).set(item.storageName, pct)),
          );
        }),
      );

      const failed = new Set<string>();
      results.forEach((result, i) => {
        if (result.status === "rejected") failed.add(uploadItems[i].storageName);
      });

      if (failed.size > 0) {
        setFailedFiles(failed);
        setPhase("error");
        return;
      }

      try {
        await submitJob(job_id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start processing";
        setUploadError(message);
        setPhase("error");
        return;
      }
    },
    [submitJob],
  );

  const retryFile = useCallback(
    async (filename: string) => {
      if (!jobIdRef.current) return;
      const item = pendingFilesRef.current.find((f) => f.storageName === filename);
      if (!item) return;

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
          files: [{
            name: item.storageName,
            size: item.file.size,
            type: item.file.type,
          }],
        }),
      });

      if (!presignRes.ok) {
        setFailedFiles((prev) => new Set(prev).add(filename));
        return;
      }

      const { urls } = (await presignRes.json()) as {
        urls: Array<{ filename: string; presigned_url: string }>;
      };
      const url = urls.find((entry) => entry.filename === item.storageName)?.presigned_url;
      if (!url) {
        setFailedFiles((prev) => new Set(prev).add(filename));
        return;
      }

      try {
        await xhrUpload(item.file, url, (pct) =>
          setProgress((prev) => new Map(prev).set(filename, pct)),
        );
        let shouldSubmit = false;
        setFailedFiles((prev) => {
          const next = new Set(prev);
          next.delete(filename);
          shouldSubmit = next.size === 0;
          return next;
        });
        if (shouldSubmit && jobIdRef.current) {
          await submitJob(jobIdRef.current);
        }
      } catch {
        setFailedFiles((prev) => new Set(prev).add(filename));
      }
    },
    [submitJob],
  );

  return { phase, progress, failedFiles, fileLabels, uploadError, startUpload, retryFile };
}

function storageFileName(name: string, index: number) {
  const baseName = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = baseName
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/\.\.+/g, ".")
    .replace(/^\.+/, "")
    .slice(0, 180);
  const safeName = cleaned.length > 0 ? cleaned : "file";
  return `${String(index + 1).padStart(4, "0")}-${safeName}`;
}

function uploadLabel(name: string, index: number, files: File[]) {
  const occurrences = files.filter((file) => file.name === name);
  if (occurrences.length <= 1) return name;
  const duplicateIndex = files.slice(0, index + 1).filter((file) => file.name === name).length;
  return `${name} (${duplicateIndex})`;
}

function srtStorageName(
  options: Record<string, unknown> | undefined,
  originalNames: string[],
  uploadItems: UploadItem[],
) {
  const srtName = options?.srt_name;
  if (typeof srtName !== "string" || srtName.length === 0) return null;

  const index = originalNames.findIndex((name) => name === srtName && /\.srt$/i.test(name));
  return index >= 0 ? uploadItems[index]?.storageName ?? null : null;
}

function storageNamesForList(
  options: Record<string, unknown> | undefined,
  field: string,
  originalNames: string[],
  uploadItems: UploadItem[],
) {
  const names = options?.[field];
  if (!Array.isArray(names)) return null;

  return names.map((name) => {
    if (typeof name !== "string" || name.length === 0) return null;
    const index = originalNames.findIndex((candidate) => candidate === name);
    return index >= 0 ? uploadItems[index]?.storageName ?? null : null;
  });
}

async function responseMessage(response: Response, fallback: string) {
  const text = await response.text();
  let message = `${fallback} (${response.status})`;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) message = json.error;
  } catch {
    if (text) message = text;
  }
  return message;
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
