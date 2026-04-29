"use client";

import { useCallback, useEffect, useRef } from "react";

const CHUNK_SIZE = 50 * 1024 * 1024;
const PRESIGN_BATCH_SIZE = 10;

interface DropZoneProps {
  surveyId: string;
  uploadId: string;
  r2Key: string;
  file: File;
  onProgress: (pct: number, bytesUploaded: number, totalBytes: number, speedMbps: number) => void;
  onComplete: () => void;
  onError: (err: Error) => void;
}

interface CompletedPart {
  part_number: number;
  etag: string;
}

interface PresignedPart {
  part_number: number;
  url: string;
}

export function DropZone({
  surveyId,
  uploadId,
  r2Key,
  file,
  onProgress,
  onComplete,
  onError,
}: DropZoneProps) {
  const started = useRef(false);

  const runUpload = useCallback(async () => {
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadedParts: CompletedPart[] = [];
      let bytesUploaded = 0;
      let lastBytes = 0;
      let lastTime = Date.now();

      for (let firstPart = 1; firstPart <= totalChunks; firstPart += PRESIGN_BATCH_SIZE) {
        const partNumbers = Array.from(
          { length: Math.min(PRESIGN_BATCH_SIZE, totalChunks - firstPart + 1) },
          (_, index) => firstPart + index,
        );

        const presignResponse = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            survey_id: surveyId,
            upload_id: uploadId,
            r2_key: r2Key,
            part_numbers: partNumbers,
          }),
        });

        if (!presignResponse.ok) {
          throw new Error("Failed to get upload URLs");
        }

        const { parts } = (await presignResponse.json()) as { parts: PresignedPart[] };

        for (const part of parts) {
          const start = (part.part_number - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const uploadResponse = await fetch(part.url, {
            method: "PUT",
            body: chunk,
            headers: { "Content-Type": file.type || "video/mp4" },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload part ${part.part_number}`);
          }

          uploadedParts.push({
            part_number: part.part_number,
            etag: uploadResponse.headers.get("ETag") ?? "",
          });

          bytesUploaded += chunk.size;
          const now = Date.now();
          const elapsedSeconds = (now - lastTime) / 1000;
          const speedMbps =
            elapsedSeconds > 0 ? (bytesUploaded - lastBytes) / elapsedSeconds / (1024 * 1024) : 0;
          lastBytes = bytesUploaded;
          lastTime = now;
          onProgress(Math.round((bytesUploaded / file.size) * 100), bytesUploaded, file.size, speedMbps);
        }
      }

      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survey_id: surveyId,
          upload_id: uploadId,
          r2_key: r2Key,
          parts: uploadedParts.sort((a, b) => a.part_number - b.part_number),
        }),
      });

      if (!completeResponse.ok) {
        throw new Error("Failed to complete upload");
      }

      onComplete();
    } catch (err) {
      await fetch("/api/upload/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey_id: surveyId, upload_id: uploadId, r2_key: r2Key }),
      }).catch(() => {});
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [file, onComplete, onError, onProgress, r2Key, surveyId, uploadId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runUpload();
  }, [runUpload]);

  return null;
}
