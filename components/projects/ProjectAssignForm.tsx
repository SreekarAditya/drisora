"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface AssignItem {
  id: string;
  label: string;
  meta: string;
  source: "job" | "survey";
}

interface Props {
  projectId: string;
  jobs: AssignItem[];
  surveys: AssignItem[];
}

export function ProjectAssignForm({ projectId, jobs, surveys }: Props) {
  const router = useRouter();
  const [source, setSource] = useState<"job" | "survey">("job");
  const [itemId, setItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => (source === "job" ? jobs : surveys), [jobs, source, surveys]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemId) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, id: itemId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to assign survey");
        return;
      }
      setMessage("Linked successfully");
      setItemId("");
      router.refresh();
    } catch {
      setError("Failed to assign survey");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-[#101113] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="md:w-40">
          <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-gray-600">Source</span>
          <select
            value={source}
            onChange={(event) => {
              setSource(event.target.value as "job" | "survey");
              setItemId("");
            }}
            className="w-full rounded-md border border-white/10 bg-[#0b0c0d] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          >
            <option value="job">New uploads</option>
            <option value="survey">Legacy surveys</option>
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-gray-600">
            Existing survey/report
          </span>
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#0b0c0d] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          >
            <option value="">Select one</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} - {item.meta}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving || !itemId}
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Linking..." : "Link"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {items.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">
          No unassigned {source === "job" ? "uploads" : "legacy surveys"} available.
        </p>
      )}
    </form>
  );
}
