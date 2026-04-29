"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSurveyStatus } from "@/hooks/useSurveyStatus";
import type { SurveyStatus } from "@/types";

interface ProcessingStatusProps {
  surveyId: string;
  initialStatus: SurveyStatus;
}

export function ProcessingStatus({ surveyId, initialStatus }: ProcessingStatusProps) {
  const router = useRouter();
  const status = useSurveyStatus(surveyId, initialStatus);
  const progress = Math.max(0, Math.min(100, status.progress));

  useEffect(() => {
    if (status.status === "complete" || status.status === "failed") {
      router.refresh();
    }
  }, [router, status.status]);

  return (
    <div className="space-y-3">
      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-300">{status.stageLabel ?? "Waiting for processing updates"}</span>
        <span className="text-neutral-500">{progress}%</span>
      </div>
      {status.totalFrames > 0 && (
        <p className="text-xs text-neutral-500">
          Frame {status.currentFrame} of {status.totalFrames}
        </p>
      )}
    </div>
  );
}
