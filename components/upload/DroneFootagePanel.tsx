"use client";

import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";

type SurveyMode = "single" | "multi";
type FrameProfile = "all_frames" | "0.25s" | "0.5s" | "1s";

const FRAME_PROFILES: Array<{ value: FrameProfile; label: string; hint: string }> = [
  { value: "all_frames", label: "All frames", hint: "Auto-detects FPS and duration" },
  { value: "0.25s", label: "Every 0.25s", hint: "Dense review" },
  { value: "0.5s", label: "Every 0.5s", hint: "Detailed survey" },
  { value: "1s", label: "Every 1s", hint: "Fast preview" },
];

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

interface VideoPair {
  id: string;
  video: File | null;
  srt: File | null;
  videoError: string | null;
}

// ── Single-video mode ────────────────────────────────────────────────────────

function SingleVideoPanel({
  projectId,
  phase,
  progress,
  failedFiles,
  fileLabels,
  uploadError,
  startUpload,
  retryFile,
}: {
  projectId?: string | null;
  phase: ReturnType<typeof useUpload>["phase"];
  progress: ReturnType<typeof useUpload>["progress"];
  failedFiles: ReturnType<typeof useUpload>["failedFiles"];
  fileLabels: ReturnType<typeof useUpload>["fileLabels"];
  uploadError: ReturnType<typeof useUpload>["uploadError"];
  startUpload: ReturnType<typeof useUpload>["startUpload"];
  retryFile: ReturnType<typeof useUpload>["retryFile"];
}) {
  const [video, setVideo] = useState<File | null>(null);
  const [srt, setSrt] = useState<File | null>(null);
  const [frameProfile, setFrameProfile] = useState<FrameProfile>("all_frames");
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);
  const [videoDrag, setVideoDrag] = useState(false);
  const [srtDrag, setSrtDrag] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

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
    if (!/\.srt$/i.test(file.name)) return;
    setSrt(file);
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

  const canSubmit = !!video;
  const isUploading =
    phase === "uploading" || phase === "presigning" || phase === "creating_job";

  async function handleSubmit() {
    if (!video || !canSubmit) return;
    const files = [video, ...(srt ? [srt] : [])];
    await startUpload(files, {
      mode: "drone_footage",
      project_id: projectId ?? null,
      file_names: files.map((f) => f.name),
      total_bytes: files.reduce((sum, f) => sum + f.size, 0),
      options: {
        gps_source: srt ? "srt" : "embedded",
        has_srt: srt !== null,
        srt_name: srt?.name ?? null,
        ...frameProfileOptions(frameProfile),
        enable_metric_analysis: enableMetricAnalysis,
        enable_depthpro: enableMetricAnalysis,
      },
    });
  }

  return (
    <>
      <p className="mt-1 text-sm text-[#8A8A9A]">
        Single MP4 or MOV with embedded telemetry or a matching DJI .SRT log.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setVideoDrag(true);
        }}
        onDragLeave={() => setVideoDrag(false)}
        onDrop={handleVideoDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-10 transition-colors ${
          videoDrag
            ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]"
            : "border-[rgba(255,255,255,0.10)] bg-[#0D0D11] hover:border-[rgba(255,255,255,0.20)]"
        }`}
      >
        <input
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          onChange={(e) => setSingleVideo(e.target.files?.[0] ?? null)}
        />
        <svg
          className="h-10 w-10 text-[#4A4A5A]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="3" />
          <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
        </svg>
        <p className="mt-3 text-sm font-medium text-[#F0F0F4]">
          {video ? video.name : "Drop drone video, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-[#4A4A5A]">
          {video
            ? `${formatBytes(video.size)} · click to replace`
            : "MP4 or MOV"}
        </p>
      </label>

      {videoError && (
        <div className="mt-4 flex items-center justify-between rounded-[8px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.10)] px-3 py-2">
          <span className="truncate text-xs text-[#EF4444]">{videoError}</span>
          <button
            type="button"
            onClick={() => setVideoError(null)}
            className="ml-2 text-xs text-[#4A4A5A] hover:text-[#F0F0F4]"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-6 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#F0F0F4]">GPS telemetry</p>
            <p className="mt-0.5 text-xs text-[#8A8A9A]">
              Drisora reads embedded telemetry when present. Add the matching DJI .SRT when your video stores GPS separately.
            </p>
          </div>
          {srt && (
            <span className="rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-xs font-medium text-[#22C55E]">
              SRT paired
            </span>
          )}
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setSrtDrag(true);
          }}
          onDragLeave={() => setSrtDrag(false)}
          onDrop={handleSrtDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-6 transition-colors ${
            srtDrag
              ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]"
              : "border-[rgba(255,255,255,0.10)] bg-[#0D0D11] hover:border-[rgba(255,255,255,0.20)]"
          }`}
        >
          <input
            type="file"
            accept=".srt,application/x-subrip"
            className="sr-only"
            onChange={(e) => setSingleSrt(e.target.files?.[0] ?? null)}
          />
          <p className="text-sm font-medium text-[#F0F0F4]">
            {srt ? srt.name : "Drop .SRT file, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-[#4A4A5A]">
            {srt
              ? `${formatBytes(srt.size)} · click to replace`
              : "Optional when telemetry is embedded in the video"}
          </p>
        </label>
      </div>

      <div className="mt-5 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] p-4">
        <p className="text-sm font-medium text-[#F0F0F4]">Frame extraction</p>
        <p className="mt-0.5 text-xs text-[#4A4A5A]">
          Use all frames when PCI reproducibility matters. Drisora probes the source video metadata and extracts every decoded frame.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FRAME_PROFILES.map((profile) => (
            <button
              key={profile.value}
              type="button"
              onClick={() => setFrameProfile(profile.value)}
              className={`rounded-[8px] border px-3 py-2 text-left transition-colors ${
                frameProfile === profile.value
                  ? "border-[rgba(245,166,35,0.40)] bg-[rgba(245,166,35,0.08)] text-[#F5A623]"
                  : "border-[rgba(255,255,255,0.07)] bg-[#111116] text-[#8A8A9A] hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F4]"
              }`}
            >
              <span className="block text-xs font-semibold">{profile.label}</span>
              <span className="mt-0.5 block text-[11px]">{profile.hint}</span>
            </button>
          ))}
        </div>
      </div>

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
        <p className="mt-4 rounded-md bg-[rgba(239,68,68,0.10)] px-3 py-2 text-sm text-[#EF4444]">
          {uploadError}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading || !canSubmit || !!videoError}
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
    </>
  );
}

// ── Multi-video mode ─────────────────────────────────────────────────────────

function stemOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

function SrtStatusBadge({
  hasSrt,
  matched,
}: {
  hasSrt: boolean;
  matched: boolean;
}) {
  if (hasSrt && matched) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-xs font-medium text-[#22C55E]">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path d="M13.5 4.5L6 12l-3.5-3.5 1-1L6 10l6.5-6.5 1 1z" />
        </svg>
        SRT paired
      </span>
    );
  }
  if (hasSrt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(245,166,35,0.10)] px-2 py-0.5 text-xs font-medium text-[#F5A623]">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path d="M8 3v5M8 11v1" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
        </svg>
        Name mismatch
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
        <path d="M8 3v5M8 11v1" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      </svg>
      Auto GPS
    </span>
  );
}

function VideoPairCard({
  pair,
  index,
  onVideoChange,
  onSrtChange,
  onRemove,
}: {
  pair: VideoPair;
  index: number;
  onVideoChange: (id: string, file: File | null) => void;
  onSrtChange: (id: string, file: File | null) => void;
  onRemove: (id: string) => void;
}) {
  const [videoDrag, setVideoDrag] = useState(false);
  const [srtDrag, setSrtDrag] = useState(false);

  function handleVideoDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setVideoDrag(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && (file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name))) {
      onVideoChange(pair.id, file);
    }
  }

  function handleSrtDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setSrtDrag(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && /\.srt$/i.test(file.name)) {
      onSrtChange(pair.id, file);
    }
  }

  const hasSrt = pair.srt !== null;
  const srtMatched = pair.video !== null && pair.srt !== null &&
    stemOf(pair.video.name) === stemOf(pair.srt.name);

  return (
    <div className="rounded-[10px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#8A8A9A]">Video {index + 1}</span>
        <div className="flex items-center gap-2">
          {pair.video && <SrtStatusBadge hasSrt={hasSrt} matched={srtMatched} />}
          <button
            type="button"
            onClick={() => onRemove(pair.id)}
            className="rounded p-0.5 text-[#4A4A5A] transition-colors hover:text-[#EF4444]"
            title="Remove this pair"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setVideoDrag(true); }}
        onDragLeave={() => setVideoDrag(false)}
        onDrop={handleVideoDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-6 transition-colors ${
          videoDrag
            ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]"
            : "border-[rgba(255,255,255,0.10)] bg-[#0D0D11] hover:border-[rgba(255,255,255,0.20)]"
        }`}
      >
        <input
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) onVideoChange(pair.id, file);
          }}
        />
        <p className="text-sm font-medium text-[#F0F0F4]">
          {pair.video ? pair.video.name : "Drop video (MP4/MOV), or click"}
        </p>
        {pair.video && (
          <p className="mt-1 text-xs text-[#4A4A5A]">{formatBytes(pair.video.size)} · click to replace</p>
        )}
        {!pair.video && (
          <p className="mt-1 text-xs text-[#4A4A5A]">MP4 or MOV</p>
        )}
      </label>

      {pair.videoError && (
        <p className="mt-2 text-xs text-[#EF4444]">{pair.videoError}</p>
      )}

      {/* SRT drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setSrtDrag(true); }}
        onDragLeave={() => setSrtDrag(false)}
        onDrop={handleSrtDrop}
        className={`mt-3 flex cursor-pointer items-center justify-center rounded-[10px] border border-dashed px-4 py-3 transition-colors ${
          srtDrag
            ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]"
            : "border-[rgba(255,255,255,0.10)] bg-[#0D0D11] hover:border-[rgba(255,255,255,0.20)]"
        }`}
      >
        <input
          type="file"
          accept=".srt,application/x-subrip"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && /\.srt$/i.test(file.name)) onSrtChange(pair.id, file);
          }}
        />
        <p className="text-xs text-[#8A8A9A]">
          {pair.srt
            ? `${pair.srt.name} (${formatBytes(pair.srt.size)}) · click to replace`
            : "Optional: drop .SRT log, or click to browse"}
        </p>
      </label>
    </div>
  );
}

function MultiVideoPanel({
  projectId,
  phase,
  progress,
  failedFiles,
  fileLabels,
  uploadError,
  startUpload,
  retryFile,
}: {
  projectId?: string | null;
  phase: ReturnType<typeof useUpload>["phase"];
  progress: ReturnType<typeof useUpload>["progress"];
  failedFiles: ReturnType<typeof useUpload>["failedFiles"];
  fileLabels: ReturnType<typeof useUpload>["fileLabels"];
  uploadError: ReturnType<typeof useUpload>["uploadError"];
  startUpload: ReturnType<typeof useUpload>["startUpload"];
  retryFile: ReturnType<typeof useUpload>["retryFile"];
}) {
  const [pairs, setPairs] = useState<VideoPair[]>([
    { id: crypto.randomUUID(), video: null, srt: null, videoError: null },
  ]);
  const [frameProfile, setFrameProfile] = useState<FrameProfile>("all_frames");
  const [enableMetricAnalysis, setEnableMetricAnalysis] = useState(false);

  function addPair() {
    setPairs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), video: null, srt: null, videoError: null },
    ]);
  }

  function removePair(id: string) {
    setPairs((prev) => prev.length === 1 ? prev : prev.filter((p) => p.id !== id));
  }

  function handleVideoChange(id: string, file: File | null) {
    if (!file) return;
    setPairs((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (!file.type.startsWith("video/") && !/\.(mp4|mov)$/i.test(file.name)) {
          return { ...p, videoError: `${file.name} — Unsupported format (MP4 or MOV required)` };
        }
        return { ...p, video: file, videoError: null };
      }),
    );
  }

  function handleSrtChange(id: string, file: File | null) {
    if (!file) return;
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, srt: file } : p)),
    );
  }

  const videoCount = pairs.filter((p) => p.video !== null).length;
  const srtCount = pairs.filter((p) => p.srt !== null).length;
  const isUploading =
    phase === "uploading" || phase === "presigning" || phase === "creating_job";
  const allHaveVideo = pairs.length > 0 && pairs.every((p) => p.video !== null);
  const hasVideoErrors = pairs.some((p) => p.videoError !== null);

  async function handleSubmit() {
    if (!allHaveVideo || hasVideoErrors) return;
    const videos = pairs.map((p) => p.video!);
    const srts = pairs.flatMap((p) => (p.srt ? [p.srt] : []));
    const allFiles = [...videos, ...srts];
    const allHaveSrt = pairs.every((p) => p.srt !== null);

    await startUpload(allFiles, {
      mode: "drone_footage",
      project_id: projectId ?? null,
      file_names: allFiles.map((f) => f.name),
      total_bytes: allFiles.reduce((sum, f) => sum + f.size, 0),
      options: {
        is_multi_video: true,
        gps_source: allHaveSrt ? "srt" : srtCount > 0 ? "mixed" : "embedded",
        has_srt: srtCount > 0,
        video_count: pairs.length,
        video_filenames: pairs.map((p) => p.video!.name),
        srt_filenames: pairs.map((p) => p.srt?.name ?? null),
        ...frameProfileOptions(frameProfile),
        enable_metric_analysis: enableMetricAnalysis,
        enable_depthpro: enableMetricAnalysis,
      },
    });
  }

  return (
    <>
      <p className="mt-1 text-sm text-[#8A8A9A]">
        Multiple drone videos for a single survey run. Use embedded telemetry or add matching .SRT logs where needed.
      </p>

      <div className="mt-6 space-y-4">
        {pairs.map((pair, index) => (
          <VideoPairCard
            key={pair.id}
            pair={pair}
            index={index}
            onVideoChange={handleVideoChange}
            onSrtChange={handleSrtChange}
            onRemove={removePair}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addPair}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#2a2a2a] bg-[#0D0D11] py-3 text-sm font-medium text-[#8A8A9A] transition-colors hover:border-[rgba(245,166,35,0.40)] hover:text-[#F5A623]"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
        </svg>
        Add another video
      </button>

      <div className="mt-5 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] p-4">
        <p className="text-sm font-medium text-[#F0F0F4]">Frame extraction</p>
        <p className="mt-0.5 text-xs text-[#4A4A5A]">
          All frames is the reproducible mode for dense PCI review. Interval modes are previews.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FRAME_PROFILES.map((profile) => (
            <button
              key={profile.value}
              type="button"
              onClick={() => setFrameProfile(profile.value)}
              className={`rounded-[8px] border px-3 py-2 text-left transition-colors ${
                frameProfile === profile.value
                  ? "border-[rgba(245,166,35,0.40)] bg-[rgba(245,166,35,0.08)] text-[#F5A623]"
                  : "border-[rgba(255,255,255,0.07)] bg-[#111116] text-[#8A8A9A] hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F4]"
              }`}
            >
              <span className="block text-xs font-semibold">{profile.label}</span>
              <span className="mt-0.5 block text-[11px]">{profile.hint}</span>
            </button>
          ))}
        </div>
      </div>

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
        <p className="mt-4 rounded-md bg-[rgba(239,68,68,0.10)] px-3 py-2 text-sm text-[#EF4444]">
          {uploadError}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-[#8A8A9A]">
          Total: {videoCount} video{videoCount !== 1 ? "s" : ""}, {srtCount} SRT{srtCount !== 1 ? "s" : ""} uploaded
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading || !allHaveVideo || hasVideoErrors || pairs.length === 0}
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
    </>
  );
}

// ── Root panel ───────────────────────────────────────────────────────────────

export function DroneFootagePanel({ projectId }: { projectId?: string | null }) {
  const [surveyMode, setSurveyMode] = useState<SurveyMode>("single");
  const { phase, progress, failedFiles, fileLabels, uploadError, startUpload, retryFile } =
    useUpload();

  return (
    <section className="rounded-[10px] border border-[rgba(255,255,255,0.10)] bg-[#111116] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#F0F0F4]">Drone footage</h2>

        {/* Mode toggle */}
        <div className="flex shrink-0 rounded-md border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] p-0.5">
          <button
            type="button"
            onClick={() => setSurveyMode("single")}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              surveyMode === "single"
                ? "bg-[#F5A623] text-[#09090C]"
                : "text-[#8A8A9A] hover:text-[#F0F0F4]"
            }`}
          >
            Single video
          </button>
          <button
            type="button"
            onClick={() => setSurveyMode("multi")}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              surveyMode === "multi"
                ? "bg-[#F5A623] text-[#09090C]"
                : "text-[#8A8A9A] hover:text-[#F0F0F4]"
            }`}
          >
            Multi-video
          </button>
        </div>
      </div>

      {surveyMode === "single" ? (
        <SingleVideoPanel
          projectId={projectId}
          phase={phase}
          progress={progress}
          failedFiles={failedFiles}
          fileLabels={fileLabels}
          uploadError={uploadError}
          startUpload={startUpload}
          retryFile={retryFile}
        />
      ) : (
        <MultiVideoPanel
          projectId={projectId}
          phase={phase}
          progress={progress}
          failedFiles={failedFiles}
          fileLabels={fileLabels}
          uploadError={uploadError}
          startUpload={startUpload}
          retryFile={retryFile}
        />
      )}
    </section>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

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
                <span
                  className={`text-xs ${failed ? "text-[#EF4444]" : "text-[#8A8A9A]"}`}
                >
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
