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
      <div className="h-[3px] overflow-hidden rounded-full bg-[rgba(245,166,35,0.15)]">
        <div className="h-full rounded-full bg-[#F5A623] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#F0F0F4]">{status.stageLabel ?? "Waiting for processing updates"}</span>
        <span className="font-mono text-[#8A8A9A]">{progress}%</span>
      </div>
      {status.totalFrames > 0 && (
        <p className="font-mono text-xs text-[#4A4A5A]">
          Frame {status.currentFrame} of {status.totalFrames}
        </p>
      )}
    </div>
  );
}
