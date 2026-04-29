"use client";

import { useEffect, useState } from "react";
import type { SurveyStatus } from "@/types";

export type JobStage =
  | "queued"
  | "extracting_frames"
  | "running_detection"
  | "scoring"
  | "generating_report"
  | "complete"
  | "failed";

export interface SurveyStatusData {
  status: JobStage | null;
  stageLabel: string | null;
  progress: number;
  currentFrame: number;
  totalFrames: number;
}

export function useSurveyStatus(
  surveyId: string,
  initialStatus: SurveyStatus,
): SurveyStatusData {
  const [data, setData] = useState<SurveyStatusData>({
    status: null,
    stageLabel: null,
    progress: 0,
    currentFrame: 0,
    totalFrames: 0,
  });

  const active = initialStatus === "queued" || initialStatus === "processing";

  useEffect(() => {
    if (!active) return;

    const es = new EventSource(`/api/survey/${surveyId}/status`);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setData({
          status: parsed.status,
          stageLabel: parsed.stage_label,
          progress: parsed.progress ?? 0,
          currentFrame: parsed.current_frame ?? 0,
          totalFrames: parsed.total_frames ?? 0,
        });
      } catch {
        // Ignore malformed SSE frames.
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [surveyId, active]);

  return data;
}
