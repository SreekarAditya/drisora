"use client";

import { useEffect, useMemo, useState } from "react";
import { useUpload } from "@/hooks/useUpload";

const SECONDS_PER_IMAGE = 3;

interface FilePreview {
  file: File;
  url: string;
}

export function ImageBatchPanel({ projectId }: { projectId?: string | null }) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const { phase, progress, failedFiles, fileLabels, uploadError, startUpload, retryFile } =
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
        project_id: projectId ?? null,
        file_names: files.map((f) => f.file.name),
        total_bytes: files.reduce((sum, f) => sum + f.file.size, 0),
        options: {
          enable_metric_analysis: enableMetricAnalysis,
          enable_depthpro: enableMetricAnalysis,
        },
      },
    );
  }

  return (
    <section className="rounded-[10px] border border-[rgba(255,255,255,0.10)] bg-[#111116] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      <h2 className="text-lg font-semibold text-[#F0F0F4]">Image batch</h2>
      <p className="mt-1 text-sm text-[#8A8A9A]">
        Upload JPEG/PNG images as a batch. If the images include geotags or EXIF GPS, Drisora maps them automatically.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-10 transition-colors ${
          dragOver
            ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]"
            : "border-[rgba(255,255,255,0.10)] bg-[#0D0D11] hover:border-[rgba(255,255,255,0.20)]"
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
          className="h-10 w-10 text-[#4A4A5A]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <p className="mt-3 text-sm font-medium text-[#F0F0F4]">
          Drag &amp; drop images, or click to browse
        </p>
        <p className="mt-1 text-xs text-[#4A4A5A]">JPEG and PNG · batch upload up to 1,000 files</p>
      </label>

      {Object.keys(fileErrors).length > 0 && (
        <div className="mt-4 space-y-1.5">
          {Object.entries(fileErrors).map(([name, reason]) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-[rgba(239,68,68,0.10)] px-3 py-2">
              <span className="max-w-[70%] truncate text-xs text-[#EF4444]">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#EF4444]">{reason}</span>
                <button
                  type="button"
                  onClick={() => setFileErrors((prev) => {
                    const next = { ...prev };
                    delete next[name];
                    return next;
                  })}
                  className="text-xs text-[#4A4A5A] hover:text-[#8A8A9A]"
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
              <span className="rounded-full bg-[#F5A623]/10 px-3 py-1 text-xs font-semibold text-[#F5A623]">
                {files.length} {files.length === 1 ? "image" : "images"}
              </span>
              <span className="text-xs text-[#8A8A9A]">
                Estimated processing time:{" "}
                <span className="text-[#F0F0F4]">{eta}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                files.forEach((f) => URL.revokeObjectURL(f.url));
                setFiles([]);
                setFileErrors({});
              }}
              className="text-xs font-medium text-[#8A8A9A] hover:text-[#F0F0F4]"
            >
              Clear all
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {files.slice(0, 48).map((f, idx) => (
              <div
                key={idx}
                className="group relative aspect-square overflow-hidden rounded-md border border-[rgba(255,255,255,0.07)] bg-[#0D0D11]"
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
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-[#09090C]/90 text-xs text-[#F0F0F4] group-hover:flex"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            {files.length > 48 && (
              <div className="flex aspect-square items-center justify-center rounded-md border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] text-xs text-[#8A8A9A]">
                +{files.length - 48} more
              </div>
            )}
          </div>
        </>
      )}

      <label className="mt-5 flex items-center justify-between gap-4 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-[#F0F0F4]">Metric Analysis</span>
          <span className="mt-0.5 block text-xs text-[#4A4A5A]">
            Camera-to-surface distance and width from pixels. Adds processing time.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enableMetricAnalysis}
          onChange={(e) => setEnableMetricAnalysis(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-amber-500"
        />
      </label>

      {isUploading && progress.size > 0 && (
        <ProgressList progress={progress} failedFiles={failedFiles} fileLabels={fileLabels} onRetry={retryFile} />
      )}

      {phase === "error" && failedFiles.size > 0 && (
        <ProgressList progress={progress} failedFiles={failedFiles} fileLabels={fileLabels} onRetry={retryFile} />
      )}

      {uploadError && failedFiles.size === 0 && (
        <p className="mt-4 rounded-md bg-[rgba(239,68,68,0.10)] px-3 py-2 text-sm text-[#EF4444]">
          {uploadError}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading || files.length === 0 || Object.keys(fileErrors).length > 0}
          className="rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D] disabled:cursor-not-allowed disabled:opacity-50"
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
  fileLabels,
  onRetry,
}: {
  progress: Map<string, number>;
  failedFiles: Set<string>;
  fileLabels: Map<string, string>;
  onRetry: (filename: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {Array.from(progress.entries()).map(([filename, pct]) => {
        const failed = failedFiles.has(filename);
        return (
          <div key={filename}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="max-w-[70%] truncate text-xs text-[#8A8A9A]">
                {fileLabels.get(filename) ?? filename}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${failed ? "text-[#EF4444]" : "text-[#8A8A9A]"}`}>
                  {failed ? "Failed" : `${Math.round(pct * 100)}%`}
                </span>
                {failed && (
                  <button
                    type="button"
                    onClick={() => onRetry(filename)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-[#F5A623] hover:text-[#FFBE4D]"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(245,166,35,0.15)]">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  failed ? "bg-[#EF4444]" : "bg-[#F5A623]"
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
