"use client";

import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";

const INTERVALS = [
  { value: 0.5, label: "Every 0.5s", hint: "Highest detail" },
  { value: 1, label: "Every 1s", hint: "Recommended" },
  { value: 2, label: "Every 2s", hint: "Balanced" },
  { value: 5, label: "Every 5s", hint: "Fast / overview" },
] as const;

type Interval = (typeof INTERVALS)[number]["value"];

export function HandheldVideoPanel() {
  const [video, setVideo] = useState<File | null>(null);
  const [interval, setInterval] = useState<Interval>(1);
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const { phase, progress, failedFiles, uploadError, startUpload, retryFile } =
    useUpload();

  function setSingleVideo(file: File | null) {
    if (!file) return;
    setVideoError(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|mov)$/i.test(file.name)) {
      setVideoError(`${file.name} — Unsupported format (MP4 or MOV required)`);
      return;
    }
    setVideo(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    setSingleVideo(event.dataTransfer.files?.[0] ?? null);
  }

  const isUploading =
    phase === "uploading" || phase === "presigning" || phase === "creating_job";

  async function handleSubmit() {
    if (!video) return;
    await startUpload([video], {
      mode: "handheld_video",
      file_names: [video.name],
      total_bytes: video.size,
      options: {
        frame_interval_seconds: interval,
        enable_metric_analysis: enableMetricAnalysis,
        enable_depthpro: enableMetricAnalysis,
      },
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <h2 className="text-lg font-semibold text-white">Handheld video</h2>
      <p className="mt-1 text-sm text-gray-500">
        Single MP4 or MOV. We&apos;ll sample frames at your chosen interval — no GPS needed.
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
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          onChange={(e) => setSingleVideo(e.target.files?.[0] ?? null)}
        />
        <svg
          className="h-10 w-10 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M22 8l-6 4 6 4V8z" />
        </svg>
        <p className="mt-3 text-sm font-medium text-white">
          {video ? video.name : "Drop video here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-gray-600">
          {video
            ? `${formatBytes(video.size)} · click to replace`
            : "MP4 or MOV"}
        </p>
      </label>

      {videoError && (
        <div className="mt-4 flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
          <span className="truncate text-xs text-red-300">{videoError}</span>
          <button
            type="button"
            onClick={() => setVideoError(null)}
            className="ml-2 text-xs text-gray-600 hover:text-gray-400"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-6">
        <label className="text-xs font-medium text-gray-400">Frame interval</label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {INTERVALS.map((opt) => {
            const isActive = interval === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                  isActive
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"
                }`}
              >
                <input
                  type="radio"
                  name="frame-interval"
                  value={opt.value}
                  checked={isActive}
                  onChange={() => setInterval(opt.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isActive ? "border-amber-500" : "border-[#3a3a3a]"
                    }`}
                  >
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </span>
                  <span className="text-sm font-medium text-white">{opt.label}</span>
                </div>
                <span className="ml-6 mt-0.5 text-xs text-gray-500">{opt.hint}</span>
              </label>
            );
          })}
        </div>
      </div>

      <label className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-[#242424] bg-[#0a0a0a] px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-white">Metric Analysis</span>
          <span className="mt-0.5 block text-xs text-gray-600">
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

      {(isUploading || (phase === "error" && failedFiles.size > 0)) &&
        progress.size > 0 && (
          <ProgressList
            progress={progress}
            failedFiles={failedFiles}
            onRetry={retryFile}
          />
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
          disabled={isUploading || !video || !!videoError}
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
                <span
                  className={`text-xs ${failed ? "text-red-400" : "text-gray-500"}`}
                >
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
