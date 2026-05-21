"use client";

import { useState } from "react";

interface ReportDownloadButtonProps {
  surveyId: string;
}

export function ReportDownloadButton({ surveyId }: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/survey/${surveyId}/report`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate report");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-[10px] bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating report..." : "Download PDF"}
      </button>
      {error && <p className="text-sm text-[#EF4444]">{error}</p>}
    </div>
  );
}
