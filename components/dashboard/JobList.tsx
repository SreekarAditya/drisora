import Link from "next/link";
import { DeleteJobButton } from "@/components/dashboard/DeleteJobButton";
import type { JobRecord, JobStatus, JobMode } from "@/types";
import { getPciBand, JOB_MODE_LABELS } from "@/types";

interface Props {
  jobs: JobRecord[];
}

const STATUS_STYLES: Record<JobStatus, { bg: string; border: string; text: string; dot: string }> = {
  uploading:         { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", text: "#3B82F6", dot: "#3B82F6" },
  queued:            { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#8A8A9A", dot: "#4A4A5A" },
  extracting_frames: { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  detecting:         { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  segmenting:        { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  scoring:           { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  complete:          { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)",   text: "#22C55E", dot: "#22C55E" },
  failed:            { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",   text: "#EF4444", dot: "#EF4444" },
};

const STATUS_LABELS: Record<JobStatus, string> = {
  uploading:         "Uploading",
  queued:            "Queued",
  extracting_frames: "Processing",
  detecting:         "Processing",
  segmenting:        "Processing",
  scoring:           "Processing",
  complete:          "Complete",
  failed:            "Failed",
};

function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS_STYLES[status];
  const isProcessing = !["complete", "failed", "queued"].includes(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-medium"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span
        className={`h-[6px] w-[6px] rounded-full ${isProcessing ? "animate-pulse-dot" : ""}`}
        style={{ backgroundColor: s.dot }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

const MODE_ICONS: Record<JobMode, React.ReactNode> = {
  image_batch: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="0.5" y="0.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      <rect x="6.5" y="0.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      <rect x="0.5" y="6.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      <rect x="6.5" y="6.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  handheld_video: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="0.5" y="2.5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M8 4.5l2.5-1.5v5L8 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  drone_footage: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
      <line x1="1" y1="1" x2="3" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="10" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="1" y1="10" x2="3" y2="8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="10" y1="10" x2="8" y2="8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
};

function ModeChip({ mode }: { mode: JobMode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)] px-2 py-0.5 font-mono text-[10px] text-[#F5A623]">
      {MODE_ICONS[mode]}
      {JOB_MODE_LABELS[mode]}
    </span>
  );
}

function StatsCards({ jobs }: { jobs: JobRecord[] }) {
  const completed = jobs.filter((j) => j.status === "complete");
  const active = jobs.filter((j) => !["complete", "failed", "uploading"].includes(j.status));
  const uploading = jobs.filter((j) => j.status === "uploading");
  const failed = jobs.filter((j) => j.status === "failed");
  const pciValues = completed
    .map((j) => j.average_pci)
    .filter((v): v is number => v != null);
  const avgPci =
    pciValues.length > 0
      ? pciValues.reduce((a, b) => a + b, 0) / pciValues.length
      : null;
  const totalFrames = completed.reduce((a, j) => a + (j.frame_count ?? 0), 0);
  const poorSurveys = completed.filter((j) => (j.average_pci ?? 100) < 70).length;

  const stats = [
    {
      label: "Active queue",
      value: String(active.length + uploading.length),
      sub: uploading.length > 0 ? `${uploading.length} uploading` : `${active.length} processing`,
      color: active.length + uploading.length > 0 ? "#3B82F6" : undefined,
      pciColor: undefined as string | undefined,
    },
    {
      label: "Ready reports",
      value: String(completed.length),
      sub: `${totalFrames >= 1000 ? `${(totalFrames / 1000).toFixed(1)}k` : totalFrames} frames analyzed`,
      color: completed.length > 0 ? "#F5A623" : undefined,
      pciColor: undefined as string | undefined,
    },
    {
      label: "Average PCI",
      value: avgPci != null ? avgPci.toFixed(1) : "—",
      sub: avgPci != null ? getPciBand(avgPci).label : "no data yet",
      color: avgPci != null ? getPciBand(avgPci).color : undefined,
      pciColor: avgPci != null ? getPciBand(avgPci).color : undefined,
    },
    {
      label: "Needs review",
      value: String(failed.length + poorSurveys),
      sub: failed.length > 0 ? `${failed.length} failed job${failed.length === 1 ? "" : "s"}` : `${poorSurveys} below PCI 70`,
      color: failed.length + poorSurveys > 0 ? "#EF4444" : undefined,
      pciColor: undefined as string | undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => {
        const isZero = s.value === "0" || s.value === "—";
        return (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-5 transition-all duration-200 hover:border-[rgba(255,255,255,0.12)]"
          >
            {s.pciColor && (
              <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: s.pciColor }} />
            )}
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">{s.label}</p>
            <p
              className="mt-2 font-mono text-[28px] font-semibold leading-none tracking-tight"
              style={{ color: isZero ? "#4A4A5A" : (s.color ?? "#F0F0F4") }}
            >
              {s.value}
            </p>
            <p className="mt-2 text-[12px] text-[#4A4A5A]">{s.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[#111116] px-6 py-20 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-[18px] font-medium text-white">No surveys yet</h3>
      <p className="mt-2 max-w-xs text-sm text-[#8A8A9A]">
        Upload drone footage, a handheld video, or an image batch to get your first PCI report.
      </p>
      <Link
        href="/upload"
        className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
      >
        Start your first survey
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

function JobRow({ job }: { job: JobRecord }) {
  const date = new Date(job.created_at).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const pciColor = job.average_pci != null ? getPciBand(job.average_pci).color : "#4A4A5A";
  const isActive = !["complete", "failed", "uploading"].includes(job.status);

  return (
    <tr className="group border-b border-[rgba(255,255,255,0.05)] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]">
      <td className="py-4 pl-6 pr-4">
        <p className="text-sm font-medium text-[#F0F0F4]">{date}</p>
        <p className="font-mono text-[10px] text-[#4A4A5A]">{job.id.slice(0, 8)}&hellip;</p>
      </td>
      <td className="px-4 py-4">
        <ModeChip mode={job.mode} />
      </td>
      <td className="hidden px-4 py-4 text-right font-mono text-sm text-[#8A8A9A] sm:table-cell">
        {job.frame_count ?? "—"}
      </td>
      <td className="px-4 py-4">
        {job.average_pci != null ? (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pciColor }} />
            <span className="font-mono text-[18px] font-medium" style={{ color: pciColor }}>
              {job.average_pci.toFixed(1)}
            </span>
          </div>
        ) : (
          <span className="font-mono text-sm text-[#4A4A5A]">—</span>
        )}
      </td>
      <td className="px-4 py-4">
        <StatusPill status={job.status} />
      </td>
      <td className="py-4 pl-4 pr-6">
        <div className="flex items-center justify-end gap-2">
          {job.status === "complete" ? (
            <>
              <Link
                href={`/jobs/${job.id}/results`}
                className="rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-transparent px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(245,166,35,0.30)] hover:bg-[rgba(245,166,35,0.06)] hover:text-[#F5A623]"
              >
                View
              </Link>
              <a
                href={`/api/jobs/${job.id}/report`}
                className="rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-transparent px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(245,166,35,0.30)] hover:bg-[rgba(245,166,35,0.06)] hover:text-[#F5A623]"
              >
                PDF
              </a>
              <DeleteJobButton job={job} />
            </>
          ) : isActive ? (
            <>
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-[8px] border border-[rgba(245,166,35,0.25)] bg-[rgba(245,166,35,0.07)] px-3 py-1.5 text-xs font-medium text-[#F5A623] transition-all duration-100 hover:border-[rgba(245,166,35,0.40)] hover:bg-[rgba(245,166,35,0.12)]"
              >
                Track
              </Link>
              <DeleteJobButton job={job} />
            </>
          ) : job.status === "uploading" ? (
            <>
              <span className="font-mono text-xs text-[#3B82F6]">Uploading</span>
              <DeleteJobButton job={job} />
            </>
          ) : (
            <DeleteJobButton job={job} />
          )}
        </div>
      </td>
    </tr>
  );
}

export function JobList({ jobs }: Props) {
  const latestJob = jobs[0];
  const latestDate = latestJob
    ? new Date(latestJob.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No activity";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(255,255,255,0.07)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
            <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
            Pavement intelligence
          </p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">Survey operations</h1>
          <p className="mt-2 text-[14px] text-[#8A8A9A]">
            {jobs.length} total surveys &middot; latest activity {latestDate}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2.5 text-sm font-medium text-[#8A8A9A] transition-all duration-150 hover:border-[rgba(255,255,255,0.20)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
          >
            Refresh
          </Link>
          <Link
            href="/upload"
            className="rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] shadow-[0_2px_8px_rgba(245,166,35,0.25)] transition-all duration-150 hover:bg-[#FFBE4D] hover:shadow-[0_4px_16px_rgba(245,166,35,0.35)] active:scale-[0.98]"
          >
            + New Survey
          </Link>
        </div>
      </div>

      <StatsCards jobs={jobs} />

      <div className="mt-8">
        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.07)] bg-[#111116]">
                  <th className="py-3 pl-6 pr-4 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    Mode
                  </th>
                  <th className="hidden px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A] sm:table-cell">
                    Frames
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    Avg PCI
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    Status
                  </th>
                  <th className="py-3 pl-4 pr-6 text-right font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
