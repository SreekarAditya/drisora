"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobRecord } from "@/types";

export function DeleteJobButton({ job }: { job: JobRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to delete survey");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Failed to delete survey");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-transparent px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(239,68,68,0.40)] hover:text-[#EF4444]"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[#1A1A22] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <h2 className="text-lg font-semibold text-white">Delete survey upload?</h2>
            <p className="mt-2 text-sm leading-6 text-[#8A8A9A]">
              This removes the survey from Dashboard, Surveys, and report lists while preserving historical storage objects.
            </p>
            <p className="mt-3 font-mono text-[11px] text-[#4A4A5A]">{job.id.slice(0, 8)}&hellip;</p>
            {error && <p className="mt-3 rounded-[8px] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.25)] px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2 text-sm font-semibold text-[#8A8A9A] transition-colors hover:border-[rgba(255,255,255,0.20)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-[10px] bg-[#EF4444] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
