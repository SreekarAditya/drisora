import Link from "next/link";
import type { JobRecord, JobStatus, JobMode } from "@/types";
import { getPciBand, JOB_MODE_LABELS } from "@/types";

interface Props {
  jobs: JobRecord[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<JobStatus, { bg: string; text: string; dot: string }> = {
  queued:            { bg: "bg-[#1a1a1a]",      text: "text-gray-500",   dot: "bg-gray-600" },
  extracting_frames: { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  detecting:         { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  segmenting:        { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  scoring:           { bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
  complete:          { bg: "bg-emerald-500/10", text: "text-emerald-400",dot: "bg-emerald-400" },
  failed:            { bg: "bg-red-500/10",     text: "text-red-400",    dot: "bg-red-400" },
};

const STATUS_LABELS: Record<JobStatus, string> = {
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
  const isProcessing = !["queued", "complete", "failed"].includes(status);
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
  const pciValues = completed
    .map((j) => j.average_pci)
    .filter((v): v is number => v != null);
  const avgPci =
    pciValues.length > 0
      ? pciValues.reduce((a, b) => a + b, 0) / pciValues.length
      : null;
  const totalFrames = completed.reduce((a, j) => a + (j.frame_count ?? 0), 0);

  const stats = [
    {
      label: "Total surveys",
      value: String(jobs.length),
      sub: `${completed.length} complete`,
    },
    {
      label: "Frames analysed",
      value: totalFrames >= 1000 ? `${(totalFrames / 1000).toFixed(1)}k` : String(totalFrames),
      sub: "across all jobs",
    },
    {
      label: "Average PCI",
      value: avgPci != null ? avgPci.toFixed(1) : "—",
      sub: avgPci != null ? getPciBand(avgPci).label : "no data yet",
      color: avgPci != null ? getPciBand(avgPci).color : undefined,
    },
    {
      label: "IRC:82-2023",
      value: avgPci != null ? (avgPci >= 70 ? "Compliant" : "Non-compliant") : "—",
      sub: avgPci != null ? `Avg PCI ${avgPci.toFixed(1)}` : "no completed surveys",
      color: avgPci != null ? (avgPci >= 70 ? "#22c55e" : "#ef4444") : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{s.label}</p>
          <p
            className="mt-1 text-2xl font-semibold"
            style={{ color: s.color ?? "#ffffff" }}
          >
            {s.value}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#222] bg-[#111]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-amber-500">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white">No surveys yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-gray-600">
        Start your first survey — upload drone footage, a handheld video, or an image batch.
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
  const isActive = !["complete", "failed", "queued"].includes(job.status);

  return (
    <tr className="group border-b border-[#141414] transition-colors hover:bg-[#0d0d0d]">
      <td className="py-3.5 pl-6 pr-4">
        <p className="text-sm text-gray-300">{date}</p>
        <p className="font-mono text-[10px] text-gray-700">{job.id.slice(0, 8)}…</p>
      </td>
      <td className="px-4 py-3.5">
        <ModeBadge mode={job.mode} />
      </td>
      <td className="px-4 py-3.5 font-mono text-sm text-gray-400">
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
                className="rounded-md border border-[#222] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
              >
                View
              </Link>
              <a
                href={`/api/jobs/${job.id}/report`}
                className="rounded-md border border-[#222] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
              >
                PDF
              </a>
            </>
          ) : isActive ? (
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/10"
            >
              Track
            </Link>
          ) : (
            <span className="text-xs text-gray-700">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Job list ─────────────────────────────────────────────────────────────────

export function JobList({ jobs }: Props) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Surveys</h1>
        <Link
          href="/upload"
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          New Survey
        </Link>
      </div>

      <StatsCards jobs={jobs} />

      <div className="mt-8">
        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a] bg-[#0f0f0f]">
                  <th className="py-3 pl-6 pr-4 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Frames
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Avg PCI
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Status
                  </th>
                  <th className="py-3 pl-4 pr-6 text-right font-mono text-[10px] uppercase tracking-widest text-gray-600">
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
