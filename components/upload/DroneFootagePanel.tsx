"use client";

import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";

type GpsState =
  | { kind: "unchecked" }
  | { kind: "checking" }
  | { kind: "found" }
  | { kind: "not_found" };

export function DroneFootagePanel() {
  const [video, setVideo] = useState<File | null>(null);
  const [srt, setSrt] = useState<File | null>(null);
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);
  const [gps, setGps] = useState<GpsState>({ kind: "unchecked" });
  const [videoDrag, setVideoDrag] = useState(false);
  const [srtDrag, setSrtDrag] = useState(false);
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
    setGps({ kind: "unchecked" });
    setSrt(null);
  }

  function setSingleSrt(file: File | null) {
    if (!file) return;
    if (!/\.srt$/i.test(file.name)) return;
    setSrt(file);
  }

  async function detectGps() {
    if (!video) return;
    setGps({ kind: "checking" });

    const sliceBytes = Math.min(video.size, 5 * 1024 * 1024);
    const buf = await video.slice(0, sliceBytes).arrayBuffer();
    const bytes = new Uint8Array(buf);

    const markers = ["djmd", "dbgi", "dji.gps", "GPMF", "GPS5", "©xyz", "gps_lat"];
    const haystack = bytesToAscii(bytes);
    const found = markers.some((m) => haystack.includes(m));
    setGps({ kind: found ? "found" : "not_found" });
  }

  function handleVideoDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setVideoDrag(false);
    setSingleVideo(event.dataTransfer.files?.[0] ?? null);
  }

  function handleSrtDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setSrtDrag(false);
    setSingleSrt(event.dataTransfer.files?.[0] ?? null);
  }

  const gpsAvailable = gps.kind === "found" || srt !== null;
  const canSubmit = !!video && gpsAvailable;
  const isUploading =
    phase === "uploading" || phase === "presigning" || phase === "creating_job";

  async function handleSubmit() {
    if (!video || !canSubmit) return;
    const files = [video, ...(srt ? [srt] : [])];
    await startUpload(files, {
      mode: "drone_footage",
      file_names: files.map((f) => f.name),
      total_bytes: files.reduce((sum, f) => sum + f.size, 0),
      options: {
        gps_source: gps.kind === "found" ? "embedded" : "srt",
        has_srt: srt !== null,
        srt_name: srt?.name ?? null,
        enable_metric_analysis: enableMetricAnalysis,
        enable_depthpro: enableMetricAnalysis,
      },
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <h2 className="text-lg font-semibold text-white">Drone footage</h2>
      <p className="mt-1 text-sm text-gray-500">
        Single MP4 or MOV. We&apos;ll use embedded GPS if present, otherwise pair it
        with a DJI .SRT log.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setVideoDrag(true);
        }}
        onDragLeave={() => setVideoDrag(false)}
        onDrop={handleVideoDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
          videoDrag
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
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="3" />
          <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
        </svg>
        <p className="mt-3 text-sm font-medium text-white">
          {video ? video.name : "Drop drone video, or click to browse"}
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

      {video && (
        <div className="mt-6 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          {gps.kind === "unchecked" && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">
                  Check for embedded GPS
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  We&apos;ll scan the video&apos;s metadata for embedded GPS tracks.
                </p>
              </div>
              <button
                type="button"
                onClick={detectGps}
                className="rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
              >
                Detect GPS
              </button>
            </div>
          )}

          {gps.kind === "checking" && (
            <p className="text-sm text-gray-400">Scanning video metadata…</p>
          )}

          {gps.kind === "found" && (
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M13.5 4.5L6 12l-3.5-3.5 1-1L6 10l6.5-6.5 1 1z" />
                </svg>
              </span>
              <span className="text-sm font-medium text-emerald-400">
                GPS detected in video
              </span>
            </div>
          )}

          {gps.kind === "not_found" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">
                  !
                </span>
                <span className="text-sm font-medium text-yellow-400">
                  No GPS found in video — upload the .SRT log
                </span>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setSrtDrag(true);
                }}
                onDragLeave={() => setSrtDrag(false)}
                onDrop={handleSrtDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  srtDrag
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
                  {srt ? srt.name : "Drop .SRT file, or click to browse"}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {srt
                    ? `${formatBytes(srt.size)} · click to replace`
                    : "DJI Mini / Air / Mavic"}
                </p>
              </label>
            </div>
          )}
        </div>
      )}

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
          disabled={isUploading || !canSubmit || !!videoError}
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

function bytesToAscii(bytes: Uint8Array): string {
  const out = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out[i] = b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
  }
  return out.join("");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
