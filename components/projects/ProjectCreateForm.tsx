"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProjectResponse {
  project?: { id: string };
  error?: string;
}

export function ProjectCreateForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as ProjectResponse;

      if (!response.ok || !data.project) {
        setError(data.error ?? "Failed to create project");
        return;
      }

      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError("Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Project name</span>
          <input
            name="name"
            required
            placeholder="NH-48 Package 03 pavement assessment"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Road stretch</span>
          <input
            name="road_name"
            placeholder="NH-48, LHS carriageway"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Package / contract</span>
          <input
            name="package_code"
            placeholder="EPC-III / PWD Zone 2"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Agency</span>
          <input
            name="agency"
            placeholder="NHAI / PWD / EPC contractor"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Corridor</span>
          <input
            name="corridor"
            placeholder="Km 42.0 to Km 58.5"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Start chainage (km)</span>
          <input
            name="start_chainage_km"
            type="number"
            step="0.001"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[#F5A623]/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">End chainage (km)</span>
          <input
            name="end_chainage_km"
            type="number"
            step="0.001"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[#F5A623]/70"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Location</span>
          <input
            name="location"
            placeholder="District, state, or asset zone"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-[#F0F0F4]">Notes</span>
          <textarea
            name="description"
            rows={4}
            placeholder="Scope, lane direction, package notes, or inspection context"
            className="w-full rounded-md border border-[rgba(255,255,255,0.10)] bg-[#101113] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]/70"
          />
        </label>
      </div>

      {error && <p className="text-sm text-[#EF4444]">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-[rgba(255,255,255,0.10)] px-4 py-2.5 text-sm font-semibold text-[#F0F0F4] transition-colors hover:border-white/20 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
          {saving ? "Creating..." : "Create project"}
        </button>
      </div>
    </form>
  );
}
