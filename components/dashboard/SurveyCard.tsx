import Link from "next/link";
import type { Survey, SurveyStatus } from "@/types";
import { getPciBand } from "@/types";

interface SurveyCardProps {
  survey: Survey;
}

const STATUS_STYLES: Record<SurveyStatus, string> = {
  uploading: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  queued: "border-[#F5A623]/20 bg-[#F5A623]/10 text-[#FFBE4D]",
  processing: "border-[#F5A623]/20 bg-[#F5A623]/10 text-[#FFBE4D]",
  complete: "border-green-500/20 bg-green-500/10 text-green-300",
  failed: "border-red-500/20 bg-[rgba(239,68,68,0.10)] text-red-300",
};

const STATUS_LABELS: Record<SurveyStatus, string> = {
  uploading: "Uploading",
  queued: "Queued",
  processing: "Processing",
  complete: "Complete",
  failed: "Failed",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SurveyCard({ survey }: SurveyCardProps) {
  const pciBand = survey.average_pci == null ? null : getPciBand(survey.average_pci);

  return (
    <Link
      href={`/survey/${survey.id}`}
      className="group flex min-h-48 flex-col rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5 transition-colors hover:border-[rgba(255,255,255,0.10)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-[#F0F0F4] transition-colors group-hover:text-[#F5A623]">
          {survey.name}
        </h2>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[survey.status]}`}
        >
          {STATUS_LABELS[survey.status]}
        </span>
      </div>

      <div className="mt-4 space-y-1 text-sm text-[#8A8A9A]">
        <p className="line-clamp-1">{survey.location ?? "Location not recorded"}</p>
        <p>{formatDate(survey.surveyed_at ?? survey.created_at)}</p>
      </div>

      <div className="mt-auto pt-5">
        {survey.status === "complete" && survey.average_pci != null && pciBand ? (
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: pciBand.color, color: pciBand.textColor }}
          >
            PCI {Math.round(survey.average_pci)} · {pciBand.label}
          </span>
        ) : survey.status === "uploading" || survey.status === "processing" ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
            <div className="h-full w-2/5 rounded-full bg-[#F5A623]" />
          </div>
        ) : (
          <span className="text-xs text-[#8A8A9A]">Open details</span>
        )}
      </div>
    </Link>
  );
}
