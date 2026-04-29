"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/upload/DropZone";
import { UploadProgressCard } from "@/components/upload/UploadProgressCard";

type Step = "metadata" | "files" | "uploading";

interface MetadataForm {
  name: string;
  location: string;
  engineer_name: string;
  surveyed_at: string;
}

interface UploadState {
  surveyId: string;
  uploadId: string;
  r2Key: string;
  file: File;
}

interface ProgressState {
  pct: number;
  bytesUploaded: number;
  totalBytes: number;
  speedMbps: number;
}

const initialProgress: ProgressState = {
  pct: 0,
  bytesUploaded: 0,
  totalBytes: 0,
  speedMbps: 0,
};

export function NewSurveyForm() {
  const router = useRouter();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("metadata");
  const [metadata, setMetadata] = useState<MetadataForm>({
    name: "",
    location: "",
    engineer_name: "",
    surveyed_at: "",
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [srtDragOver, setSrtDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
  const [error, setError] = useState<string | null>(null);

  function updateMetadata(event: React.ChangeEvent<HTMLInputElement>) {
    setMetadata((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function goToFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStep("files");
  }

  function setDroppedFile(event: React.DragEvent<HTMLDivElement>, kind: "video" | "srt") {
    event.preventDefault();
    setVideoDragOver(false);
    setSrtDragOver(false);

    const file = event.dataTransfer.files[0];
    if (!file) return;

    if (kind === "video") {
      if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
        setError("Video must be an MP4 file.");
        return;
      }
      setVideoFile(file);
    } else {
      if (!file.name.toLowerCase().endsWith(".srt")) {
        setError("GPS metadata must be an SRT file.");
        return;
      }
      setSrtFile(file);
    }
  }

  async function submitSurvey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile || !srtFile) {
      setError("Both MP4 and SRT files are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const createResponse = await fetch("/api/survey/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      if (!createResponse.ok) throw new Error("Failed to create survey");
      const { survey_id } = (await createResponse.json()) as { survey_id: string };

      const formData = new FormData();
      formData.append("survey_id", survey_id);
      formData.append("file", srtFile);
      const metadataResponse = await fetch("/api/upload/metadata", {
        method: "POST",
        body: formData,
      });
      if (!metadataResponse.ok) throw new Error("Failed to upload SRT metadata");

      const initiateResponse = await fetch("/api/upload/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survey_id,
          filename: videoFile.name,
          content_type: videoFile.type || "video/mp4",
        }),
      });
      if (!initiateResponse.ok) throw new Error("Failed to initiate video upload");
      const { upload_id, r2_key } = (await initiateResponse.json()) as {
        upload_id: string;
        r2_key: string;
      };

      setProgress({ ...initialProgress, totalBytes: videoFile.size });
      setUploadState({ surveyId: survey_id, uploadId: upload_id, r2Key: r2_key, file: videoFile });
      setStep("uploading");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#1a1a1a] bg-[#111111] p-6">
      <div className="mb-6 flex items-center gap-3">
        {["metadata", "files", "uploading"].map((item, index) => (
          <div key={item} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                step === item
                  ? "border-amber-500 bg-amber-500 text-black"
                  : "border-[#2a2a2a] text-gray-500"
              }`}
            >
              {index + 1}
            </span>
            {index < 2 && <span className="h-px w-8 bg-[#2a2a2a]" />}
          </div>
        ))}
      </div>

      {step === "metadata" && (
        <form onSubmit={goToFiles} className="space-y-5">
          <TextField label="Survey Name" name="name" value={metadata.name} onChange={updateMetadata} />
          <TextField label="Location" name="location" value={metadata.location} onChange={updateMetadata} />
          <TextField
            label="Engineer Name"
            name="engineer_name"
            value={metadata.engineer_name}
            onChange={updateMetadata}
          />
          <TextField
            label="Survey Date"
            name="surveyed_at"
            type="date"
            value={metadata.surveyed_at}
            onChange={updateMetadata}
          />
          <button
            type="submit"
            className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Continue
          </button>
        </form>
      )}

      {step === "files" && (
        <form onSubmit={submitSurvey} className="space-y-5">
          <FileDrop
            label="Video File"
            hint="Drop MP4 here or click to browse"
            selectedFile={videoFile}
            dragOver={videoDragOver}
            onDragOver={(event) => {
              event.preventDefault();
              setVideoDragOver(true);
            }}
            onDragLeave={() => setVideoDragOver(false)}
            onDrop={(event) => setDroppedFile(event, "video")}
            onClick={() => videoInputRef.current?.click()}
          >
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,.mp4"
              className="hidden"
              onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            />
          </FileDrop>

          <FileDrop
            label="GPS Metadata"
            hint="Drop SRT here or click to browse"
            selectedFile={srtFile}
            dragOver={srtDragOver}
            onDragOver={(event) => {
              event.preventDefault();
              setSrtDragOver(true);
            }}
            onDragLeave={() => setSrtDragOver(false)}
            onDrop={(event) => setDroppedFile(event, "srt")}
            onClick={() => srtInputRef.current?.click()}
          >
            <input
              ref={srtInputRef}
              type="file"
              accept=".srt"
              className="hidden"
              onChange={(event) => setSrtFile(event.target.files?.[0] ?? null)}
            />
          </FileDrop>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("metadata")}
              className="rounded-md border border-[#2a2a2a] px-4 py-2.5 font-semibold text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !videoFile || !srtFile}
              className="rounded-md bg-amber-500 px-4 py-2.5 font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Preparing..." : "Start upload"}
            </button>
          </div>
        </form>
      )}

      {step === "uploading" && uploadState && (
        <>
          <UploadProgressCard {...progress} />
          <DropZone
            surveyId={uploadState.surveyId}
            uploadId={uploadState.uploadId}
            r2Key={uploadState.r2Key}
            file={uploadState.file}
            onProgress={(pct, bytesUploaded, totalBytes, speedMbps) =>
              setProgress({ pct, bytesUploaded, totalBytes, speedMbps })
            }
            onComplete={() => router.push(`/survey/${uploadState.surveyId}`)}
            onError={(err) => {
              setError(err.message);
              setSubmitting(false);
              setStep("files");
            }}
          />
        </>
      )}
    </section>
  );
}

function TextField({
  label,
  name,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  name: keyof MetadataForm;
  type?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required
        className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-white outline-none transition-colors placeholder:text-gray-600 focus:border-amber-500"
      />
    </label>
  );
}

function FileDrop({
  label,
  hint,
  selectedFile,
  dragOver,
  children,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  label: string;
  hint: string;
  selectedFile: File | null;
  dragOver: boolean;
  children: React.ReactNode;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-300">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onClick();
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-8 text-center transition-colors ${
          dragOver
            ? "border-amber-500 bg-amber-500/10"
            : selectedFile
              ? "border-green-500/40 bg-green-500/10"
              : "border-[#2a2a2a] hover:border-white/20"
        }`}
      >
        {children}
        <p className={selectedFile ? "text-sm text-green-300" : "text-sm text-gray-400"}>
          {selectedFile?.name ?? hint}
        </p>
      </div>
    </div>
  );
}
