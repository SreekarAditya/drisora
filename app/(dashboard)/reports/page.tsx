import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyShareLinkButton } from "@/components/results/CopyShareLinkButton";
import { createClient } from "@/lib/supabase/server";
import { getPciBand, JOB_MODE_LABELS, type JobMode, type ProjectRecord } from "@/types";

type SearchParams = {
  from?: string;
  to?: string;
  min_pci?: string;
  max_pci?: string;
  project?: string;
  crack_type?: string;
};

type ReportRow = {
  id: string;
  label: string;
  source: "job" | "survey";
  project_id: string | null;
  mode: JobMode | null;
  average_pci: number | null;
  created_at: string;
  completed_at: string | null;
};

type DetectionRow = {
  survey_id: string;
  crack_type: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function withinDate(row: ReportRow, params: SearchParams) {
  const date = new Date(row.completed_at ?? row.created_at).getTime();
  if (params.from && date < new Date(params.from).getTime()) return false;
  if (params.to && date > new Date(params.to).getTime() + 86_399_999) return false;
  return true;
}

function withinPci(row: ReportRow, params: SearchParams) {
  if (row.average_pci == null) return true;
  const min = params.min_pci ? Number(params.min_pci) : null;
  const max = params.max_pci ? Number(params.max_pci) : null;
  if (min != null && Number.isFinite(min) && row.average_pci < min) return false;
  if (max != null && Number.isFinite(max) && row.average_pci > max) return false;
  return true;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const [{ data: jobs }, { data: surveys }, { data: projects }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, project_id, mode, status, average_pci, created_at, completed_at, deleted_at")
      .eq("user_id", user.id)
      .eq("status", "complete")
      .is("deleted_at", null)
      .order("completed_at", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, project_id, name, status, average_pci, created_at, report_path, deleted_at")
      .eq("user_id", user.id)
      .eq("status", "complete")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const surveyRows = (surveys ?? []) as Array<{
    id: string;
    project_id: string | null;
    name: string;
    average_pci: number | null;
    created_at: string;
  }>;
  const surveyIds = surveyRows.map((survey) => survey.id);
  const { data: detections } =
    params.crack_type && surveyIds.length > 0
      ? await supabase
          .from("detections")
          .select("survey_id, crack_type")
          .in("survey_id", surveyIds)
          .eq("crack_type", params.crack_type)
      : { data: [] };
  const matchingSurveyIds = new Set(((detections ?? []) as DetectionRow[]).map((detection) => detection.survey_id));

  const rows: ReportRow[] = [
    ...((jobs ?? []) as Array<{
      id: string;
      project_id: string | null;
      mode: JobMode;
      average_pci: number | null;
      created_at: string;
      completed_at: string | null;
    }>).map((job) => ({
      id: job.id,
      label: JOB_MODE_LABELS[job.mode],
      source: "job" as const,
      project_id: job.project_id,
      mode: job.mode,
      average_pci: job.average_pci,
      created_at: job.created_at,
      completed_at: job.completed_at,
    })),
    ...surveyRows.map((survey) => ({
      id: survey.id,
      label: survey.name,
      source: "survey" as const,
      project_id: survey.project_id,
      mode: null,
      average_pci: survey.average_pci,
      created_at: survey.created_at,
      completed_at: null,
    })),
  ].filter((row) => {
    if (params.project && params.project !== "all" && row.project_id !== params.project) return false;
    if (params.crack_type && row.source === "survey" && !matchingSurveyIds.has(row.id)) return false;
    if (params.crack_type && row.source === "job") return false;
    return withinDate(row, params) && withinPci(row, params);
  });

  const projectRows = (projects ?? []) as Pick<ProjectRecord, "id" | "name">[];
  const readyReports = rows.length;
  const avgPciValues = rows.map((row) => row.average_pci).filter((value): value is number => value != null);
  const avgPci = avgPciValues.length > 0 ? avgPciValues.reduce((sum, value) => sum + value, 0) / avgPciValues.length : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(255,255,255,0.07)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
            <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
            Completed outputs
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">Reports</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8A8A9A]">
            Completed reports only, with quick preview, PDF download, share link, and engineering filters.
          </p>
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Reports", value: readyReports, sub: "after filters", color: readyReports > 0 ? "#F5A623" : undefined },
          { label: "Average PCI", value: avgPci == null ? "N/A" : avgPci.toFixed(1), sub: avgPci == null ? "no PCI" : getPciBand(avgPci).label, color: avgPci != null ? getPciBand(avgPci).color : undefined },
          { label: "Projects", value: projectRows.length, sub: "available filters", color: undefined },
        ].map((s) => {
          const isZero = s.value === 0 || s.value === "N/A";
          return (
            <div key={s.label} className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">{s.label}</p>
              <p className="mt-2 font-mono text-[24px] font-semibold leading-none" style={{ color: isZero ? "#4A4A5A" : (s.color ?? "#F0F0F4") }}>
                {s.value}
              </p>
              <p className="mt-2 text-[12px] text-[#4A4A5A]">{s.sub}</p>
            </div>
          );
        })}
      </section>

      <form className="mb-6 rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-5" action="/reports">
        <div className="grid gap-4 md:grid-cols-6">
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">From</span>
            <input
              name="from"
              type="date"
              defaultValue={params.from}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            />
          </label>
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">To</span>
            <input
              name="to"
              type="date"
              defaultValue={params.to}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            />
          </label>
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">Min PCI</span>
            <input
              name="min_pci"
              type="number"
              min="0"
              max="100"
              defaultValue={params.min_pci}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 font-mono text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            />
          </label>
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">Max PCI</span>
            <input
              name="max_pci"
              type="number"
              min="0"
              max="100"
              defaultValue={params.max_pci}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 font-mono text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            />
          </label>
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">Project</span>
            <select
              name="project"
              defaultValue={params.project ?? "all"}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            >
              <option value="all">All projects</option>
              {projectRows.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A8A9A]">Crack type</span>
            <select
              name="crack_type"
              defaultValue={params.crack_type ?? ""}
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]"
            >
              <option value="">All types</option>
              <option value="Longitudinal Crack">Longitudinal</option>
              <option value="Transverse Crack">Transverse</option>
              <option value="Alligator Crack">Alligator</option>
              <option value="Pothole">Pothole</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Link href="/reports" className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2 text-sm font-medium text-[#8A8A9A] transition-colors hover:border-[rgba(255,255,255,0.20)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white">
            Reset
          </Link>
          <button type="submit" className="rounded-[10px] bg-[#F5A623] px-5 py-2 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]">
            Apply filters
          </button>
        </div>
      </form>

      <p className="mb-3 font-mono text-[13px] text-[#8A8A9A]">
        Showing {rows.length} reports{avgPci != null ? ` · Avg PCI ${avgPci.toFixed(1)}` : ""}
      </p>

      <section className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#111116]">
              <tr>
                {["Report", "Date", "Project", "PCI", "Source", "Actions"].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const band = row.average_pci == null ? null : getPciBand(row.average_pci);
                const project = projectRows.find((projectRow) => projectRow.id === row.project_id);
                const viewPath = row.source === "job" ? `/jobs/${row.id}/results` : `/survey/${row.id}/report`;
                const pdfPath = row.source === "job" ? `/api/jobs/${row.id}/report` : `/api/survey/${row.id}/report`;

                return (
                  <tr key={`${row.source}-${row.id}`} className="border-t border-[rgba(255,255,255,0.05)] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[#F0F0F4]">{row.label}</p>
                      <p className="font-mono text-[10px] text-[#4A4A5A]">{row.id.slice(0, 8)}&hellip;</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#8A8A9A]">{formatDate(row.completed_at ?? row.created_at)}</td>
                    <td className="px-5 py-4 text-sm text-[#8A8A9A]">{project?.name ?? <span className="italic text-[#4A4A5A]">Unassigned</span>}</td>
                    <td className="px-5 py-4">
                      {row.average_pci != null ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band?.color }} />
                          <span className="font-mono text-[16px] font-medium" style={{ color: band?.color }}>
                            {row.average_pci.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-[#4A4A5A]">N/A</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.mode ? (
                        <span className="inline-flex items-center rounded-md border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)] px-2 py-0.5 font-mono text-[10px] text-[#F5A623]">
                          {JOB_MODE_LABELS[row.mode]}
                        </span>
                      ) : (
                        <span className="text-sm text-[#8A8A9A]">Survey report</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={viewPath}
                          className="rounded-[8px] border border-[rgba(255,255,255,0.10)] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(245,166,35,0.30)] hover:text-[#F5A623]"
                        >
                          Quick view
                        </Link>
                        <a
                          href={pdfPath}
                          className="rounded-[8px] border border-[rgba(255,255,255,0.10)] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(245,166,35,0.30)] hover:text-[#F5A623]"
                        >
                          Download PDF
                        </a>
                        <CopyShareLinkButton path={viewPath} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <p className="text-sm text-[#4A4A5A]">No completed reports match these filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
