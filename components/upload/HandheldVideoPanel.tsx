"use client";

import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";

const FRAME_PROFILES = [
  { value: "all_frames", label: "All frames", hint: "60 fps x 2 min ~= 7,200 frames" },
  { value: "0.25s", label: "Every 0.25s", hint: "Dense review" },
  { value: "0.5s", label: "Every 0.5s", hint: "Detailed survey" },
  { value: "1s", label: "Every 1s", hint: "Fast preview" },
] as const;

type FrameProfile = (typeof FRAME_PROFILES)[number]["value"];

function frameProfileOptions(profile: FrameProfile) {
  if (profile === "all_frames") {
    return {
      frame_extraction_mode: "all_frames",
      frame_interval_seconds: null,
    };
  }
  return {
    frame_extraction_mode: "interval",
    frame_interval_seconds: Number(profile.replace("s", "")),
  };
}

export function HandheldVideoPanel({ projectId }: { projectId?: string | null }) {
  const [video, setVideo] = useState<File | null>(null);
  const [srt, setSrt] = useState<File | null>(null);
  const [frameProfile, setFrameProfile] = useState<FrameProfile>("all_frames");
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [srtDragOver, setSrtDragOver] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [srtError, setSrtError] = useState<string | null>(null);
  const { phase, progress, failedFiles, fileLabels, uploadError, startUpload, retryFile } =
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

  function setSingleSrt(file: File | null) {
    if (!file) return;
    setSrtError(null);
    if (!/\.srt$/i.test(file.name)) {
      setSrtError(`${file.name} — Upload an .SRT GPS log`);
      return;
    }
    setSrt(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    setSingleVideo(event.dataTransfer.files?.[0] ?? null);
  }

  function handleSrtDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setSrtDragOver(false);
    setSingleSrt(event.dataTransfer.files?.[0] ?? null);
  }

  const isUploading =
    phase === "uploading" || phase === "presigning" || phase === "creating_job";

  async function handleSubmit() {
    if (!video) return;
    const files = [video, ...(srt ? [srt] : [])];
    await startUpload(files, {
      mode: "handheld_video",
      project_id: projectId ?? null,
      file_names: files.map((file) => file.name),
      total_bytes: files.reduce((sum, file) => sum + file.size, 0),
      options: {
        ...frameProfileOptions(frameProfile),
        gps_source: srt ? "srt" : "none",
        has_srt: srt !== null,
        srt_name: srt?.name ?? null,
        enable_metric_analysis: enableMetricAnalysis,
        enable_depthpro: enableMetricAnalysis,
      },
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <h2 className="text-lg font-semibold text-white">Handheld video</h2>
      <p className="mt-1 text-sm text-gray-500">
        Single MP4 or MOV. Add an optional .SRT GPS log when you want the handheld survey mapped.
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

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setSrtDragOver(true);
        }}
        onDragLeave={() => setSrtDragOver(false)}
        onDrop={handleSrtDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-5 transition-colors ${
          srtDragOver
            ? "border-amber-500 bg-amber-500/5"
            : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"
        }`}
      >
        <input
          type="file"
          accept=".srt,application/x-subrip"
          className="sr-only"
          onChange={(e) => setSingleSrt(e.target.files?.[0] ?? null)}
        />
        <p className="text-sm font-medium text-white">
          {srt ? srt.name : "Optional .SRT GPS log"}
        </p>
        <p className="mt-1 text-xs text-gray-600">
          {srt ? `${formatBytes(srt.size)} · click to replace` : "Use when your phone or camera captured a GPS subtitle track"}
        </p>
      </label>

      {srtError && (
        <div className="mt-4 flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
          <span className="truncate text-xs text-red-300">{srtError}</span>
          <button
            type="button"
            onClick={() => setSrtError(null)}
            className="ml-2 text-xs text-gray-600 hover:text-gray-400"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-6">
        <label className="text-xs font-medium text-gray-400">Frame extraction</label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FRAME_PROFILES.map((opt) => {
            const isActive = frameProfile === opt.value;
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
                  name="frame-extraction"
                  value={opt.value}
                  checked={isActive}
                  onChange={() => setFrameProfile(opt.value)}
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
            fileLabels={fileLabels}
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
          disabled={isUploading || !video || !!videoError || !!srtError}
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
              <span className="max-w-[70%] truncate text-xs text-gray-400">
                {fileLabels.get(filename) ?? filename}
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
