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
        className="rounded-md border border-red-500/20 bg-[#111] px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.6)]">
            <h2 className="text-lg font-semibold text-white">Delete survey upload?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              This removes the survey from Dashboard, Surveys, and report lists while preserving historical storage objects.
            </p>
            <p className="mt-3 font-mono text-xs text-gray-600">{job.id.slice(0, 8)}...</p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
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
