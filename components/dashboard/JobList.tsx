import Link from "next/link";
import { DeleteJobButton } from "@/components/dashboard/DeleteJobButton";
import type { JobRecord, JobStatus, JobMode } from "@/types";
import { getPciBand, JOB_MODE_LABELS } from "@/types";

interface Props {
  jobs: JobRecord[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<JobStatus, { bg: string; text: string; dot: string }> = {
  uploading:         { bg: "bg-sky-500/10",     text: "text-sky-400",    dot: "bg-sky-400" },
  queued:            { bg: "bg-[#1a1a1a]",      text: "text-gray-500",   dot: "bg-gray-600" },
  extracting_frames: { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  detecting:         { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  segmenting:        { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  scoring:           { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  complete:          { bg: "bg-emerald-500/10", text: "text-emerald-400",dot: "bg-emerald-400" },
  failed:            { bg: "bg-red-500/10",     text: "text-red-400",    dot: "bg-red-400" },
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

function StatusBadge({ status }: { status: JobStatus }) {
  const c = STATUS_COLORS[status];
  const isProcessing = !["complete", "failed"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${isProcessing ? "animate-pulse" : ""}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Mode badge ───────────────────────────────────────────────────────────────

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

function ModeBadge({ mode }: { mode: JobMode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#222] bg-[#111] px-2 py-0.5 font-mono text-[10px] text-gray-500">
      {MODE_ICONS[mode]}
      {JOB_MODE_LABELS[mode]}
    </span>
  );
}

// ─── Stats cards ──────────────────────────────────────────────────────────────

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
      color: active.length + uploading.length > 0 ? "#38bdf8" : undefined,
    },
    {
      label: "Ready reports",
      value: String(completed.length),
      sub: `${totalFrames >= 1000 ? `${(totalFrames / 1000).toFixed(1)}k` : totalFrames} frames analyzed`,
      color: completed.length > 0 ? "#34d399" : undefined,
    },
    {
      label: "Average PCI",
      value: avgPci != null ? avgPci.toFixed(1) : "—",
      sub: avgPci != null ? getPciBand(avgPci).label : "no data yet",
      color: avgPci != null ? getPciBand(avgPci).color : undefined,
    },
    {
      label: "Needs review",
      value: String(failed.length + poorSurveys),
      sub: failed.length > 0 ? `${failed.length} failed job${failed.length === 1 ? "" : "s"}` : `${poorSurveys} below PCI 70`,
      color: failed.length + poorSurveys > 0 ? "#f87171" : "#94a3b8",
    },
  ];

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="group rounded-xl border border-white/[0.07] bg-[#0f1012] px-5 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all duration-200 hover:border-white/[0.12] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">{s.label}</p>
          <p
            className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight"
            style={{ color: s.color ?? "#ffffff" }}
          >
            {s.value}
          </p>
          <p className="mt-1.5 text-[11px] text-gray-600">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-white/10 bg-[#101113] px-6 py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#222] bg-[#111]"
        style={{ boxShadow: "0 0 24px rgba(245,158,11,0.15)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-amber-500">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white">No surveys yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-gray-500">
        Upload drone footage, a handheld video, or an image batch to get your first PCI report.
      </p>
      <Link
        href="/upload"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
      >
        Start your first survey
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: JobRecord }) {
  const date = new Date(job.created_at).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const pciColor = job.average_pci != null ? getPciBand(job.average_pci).color : "#555";
  const isActive = !["complete", "failed", "uploading"].includes(job.status);

  return (
    <tr className="group border-b border-[#141516] transition-colors duration-100 hover:bg-[#0e0f11]">
      <td className="py-3.5 pl-6 pr-4">
        <p className="text-sm text-gray-300">{date}</p>
        <p className="font-mono text-[10px] text-gray-700">{job.id.slice(0, 8)}…</p>
      </td>
      <td className="px-4 py-3.5">
        <ModeBadge mode={job.mode} />
      </td>
      <td className="hidden px-4 py-3.5 font-mono text-sm text-gray-400 sm:table-cell">
        {job.frame_count ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        {job.average_pci != null ? (
          <span className="font-mono text-sm font-semibold" style={{ color: pciColor }}>
            {job.average_pci.toFixed(1)}
          </span>
        ) : (
          <span className="text-sm text-gray-700">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={job.status} />
      </td>
      <td className="py-3.5 pl-4 pr-6">
        <div className="flex items-center justify-end gap-2">
          {job.status === "complete" ? (
            <>
              <Link
                href={`/jobs/${job.id}/results`}
                className="rounded-md border border-[#222] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-400 transition-all duration-100 hover:border-amber-500/30 hover:bg-amber-500/[0.06] hover:text-amber-400"
              >
                View
              </Link>
              <a
                href={`/api/jobs/${job.id}/report`}
                className="rounded-md border border-[#222] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-400 transition-all duration-100 hover:border-amber-500/30 hover:bg-amber-500/[0.06] hover:text-amber-400"
              >
                PDF
              </a>
              <DeleteJobButton job={job} />
            </>
          ) : isActive ? (
            <>
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1.5 text-xs font-medium text-amber-400 transition-all duration-100 hover:border-amber-500/40 hover:bg-amber-500/[0.12]"
              >
                Track
              </Link>
              <DeleteJobButton job={job} />
            </>
          ) : job.status === "uploading" ? (
            <>
              <span className="text-xs text-sky-500">Uploading</span>
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

// ─── Job list ─────────────────────────────────────────────────────────────────

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
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/[0.07] pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-gray-600">
            Pavement intelligence
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">Survey operations</h1>
          <p className="mt-2 text-sm text-gray-600">
            {jobs.length} total surveys · latest activity {latestDate}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-gray-400 transition-all duration-150 hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white"
          >
            Refresh
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black shadow-[0_2px_8px_rgba(245,158,11,0.25)] transition-all duration-150 hover:bg-amber-400 hover:shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-[0.98]"
          >
            New Survey
          </Link>
        </div>
      </div>

      <StatsCards jobs={jobs} />

      <div className="mt-8">
        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b0c0d] shadow-[0_4px_32px_rgba(0,0,0,0.32)]">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0f1012]">
                  <th className="py-3 pl-6 pr-4 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
                    Mode
                  </th>
                  <th className="hidden px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600 sm:table-cell">
                    Frames
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
                    Avg PCI
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
                    Status
                  </th>
                  <th className="py-3 pl-4 pr-6 text-right font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
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
