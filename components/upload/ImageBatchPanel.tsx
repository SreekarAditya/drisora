"use client";

import { useEffect, useMemo, useState } from "react";
import { useUpload } from "@/hooks/useUpload";

const SECONDS_PER_IMAGE = 3;

interface FilePreview {
  file: File;
  url: string;
}

export function ImageBatchPanel() {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const { phase, progress, failedFiles, uploadError, startUpload, retryFile } =
    useUpload();

  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(incoming: FileList | File[]) {
    const accepted: FilePreview[] = [];
    const newErrors: Record<string, string> = {};

    Array.from(incoming).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        newErrors[file.name] = "Unsupported format";
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        newErrors[file.name] = "File too large (max 50 MB)";
        return;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    });

    if (Object.keys(newErrors).length > 0) {
      setFileErrors((prev) => ({ ...prev, ...newErrors }));
    }
    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted].slice(0, 1000));
    }
  }

  function removeAt(index: number) {
    setFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
  }

  const totalSeconds = files.length * SECONDS_PER_IMAGE;
  const eta = useMemo(() => formatDuration(totalSeconds), [totalSeconds]);

  const isUploading = phase === "uploading" || phase === "presigning" || phase === "creating_job";

  async function handleSubmit() {
    if (files.length === 0) return;
    await startUpload(
      files.map((f) => f.file),
      {
        mode: "image_batch",
        file_names: files.map((f) => f.file.name),
        total_bytes: files.reduce((sum, f) => sum + f.file.size, 0),
        options: {},
      },
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <h2 className="text-lg font-semibold text-white">Image batch</h2>
      <p className="mt-1 text-sm text-gray-500">
        Drop up to 1,000 JPEG/PNG images. GPS will be read from each file&apos;s EXIF.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
          dragOver
            ? "border-amber-500 bg-amber-500/5"
            : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"
        }`}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <svg
          className="h-10 w-10 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <p className="mt-3 text-sm font-medium text-white">
          Drag &amp; drop images, or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-600">JPEG and PNG · up to 1,000 files</p>
      </label>

      {Object.keys(fileErrors).length > 0 && (
        <div className="mt-4 space-y-1.5">
          {Object.entries(fileErrors).map(([name, reason]) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
              <span className="max-w-[70%] truncate text-xs text-red-300">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">{reason}</span>
                <button
                  type="button"
                  onClick={() => setFileErrors((prev) => {
                    const next = { ...prev };
                    delete next[name];
                    return next;
                  })}
                  className="text-xs text-gray-600 hover:text-gray-400"
                  aria-label={`Dismiss error for ${name}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                {files.length} {files.length === 1 ? "image" : "images"}
              </span>
              <span className="text-xs text-gray-500">
                Estimated processing time:{" "}
                <span className="text-gray-300">{eta}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                files.forEach((f) => URL.revokeObjectURL(f.url));
                setFiles([]);
                setFileErrors({});
              }}
              className="text-xs font-medium text-gray-500 hover:text-white"
            >
              Clear all
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {files.slice(0, 48).map((f, idx) => (
              <div
                key={idx}
                className="group relative aspect-square overflow-hidden rounded-md border border-[#1a1a1a] bg-[#0a0a0a]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs text-white group-hover:flex"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            {files.length > 48 && (
              <div className="flex aspect-square items-center justify-center rounded-md border border-[#1a1a1a] bg-[#0a0a0a] text-xs text-gray-500">
                +{files.length - 48} more
              </div>
            )}
          </div>
        </>
      )}

      {isUploading && progress.size > 0 && (
        <ProgressList progress={progress} failedFiles={failedFiles} onRetry={retryFile} />
      )}

      {phase === "error" && failedFiles.size > 0 && (
        <ProgressList progress={progress} failedFiles={failedFiles} onRetry={retryFile} />
      )}

      {uploadError && failedFiles.size === 0 && (
        <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {uploadError}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading || files.length === 0 || Object.keys(fileErrors).length > 0}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "creating_job"
            ? "Creating job…"
            : phase === "presigning"
              ? "Preparing…"
              : phase === "uploading"
                ? "Uploading…"
                : "Start Survey"}
        </button>
      </div>
    </section>
  );
}

function ProgressList({
  progress,
  failedFiles,
  onRetry,
}: {
  progress: Map<string, number>;
  failedFiles: Set<string>;
  onRetry: (filename: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {Array.from(progress.entries()).map(([filename, pct]) => {
        const failed = failedFiles.has(filename);
        return (
          <div key={filename}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="max-w-[70%] truncate text-xs text-gray-400">
                {filename}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${failed ? "text-red-400" : "text-gray-500"}`}>
                  {failed ? "Failed" : `${Math.round(pct * 100)}%`}
                </span>
                {failed && (
                  <button
                    type="button"
                    onClick={() => onRetry(filename)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  failed ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}
