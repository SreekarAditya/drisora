"use client";

import { useEffect, useState } from "react";
import { ImageBatchPanel } from "./ImageBatchPanel";
import { HandheldVideoPanel } from "./HandheldVideoPanel";
import { DroneFootagePanel } from "./DroneFootagePanel";

export type UploadMode = "image_batch" | "handheld_video" | "drone_footage";

interface ModeCard {
  id: UploadMode;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface ProjectOption {
  id: string;
  name: string;
  road_name: string | null;
}

const MODES: ModeCard[] = [
  {
    id: "image_batch",
    title: "Image Batch",
    description: "Up to 1,000 JPEG/PNG images · maps geotags and EXIF GPS",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: "handheld_video",
    title: "Handheld Video",
    description: "Single MP4/MOV · optional .SRT GPS log · frame interval picker",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <rect x="2" y="6" width="14" height="12" rx="2" />
        <path d="M22 8l-6 4 6 4V8z" />
      </svg>
    ),
  },
  {
    id: "drone_footage",
    title: "Drone Footage",
    description: "Single MP4/MOV · GPS embedded or upload .SRT file",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="3" />
        <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
      </svg>
    ),
  },
];

export function UploadClient() {
  const [activeMode, setActiveMode] = useState<UploadMode>("drone_footage");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) return;
        const data = (await response.json()) as { projects?: ProjectOption[] };
        if (!cancelled) setProjects(data.projects ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">
              Project assignment
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">Assign this survey</h2>
            <p className="mt-1 text-[13px] text-[#8A8A9A]">
              Optional. You can also attach this upload from a project dashboard later.
            </p>
          </div>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)] md:max-w-sm"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}{project.road_name ? ` - ${project.road_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="Survey mode">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              type="button"
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              role="tab"
              aria-selected={isActive}
              className={`relative flex min-h-[148px] flex-col rounded-[14px] border p-5 text-left transition-all duration-200 ${
                isActive
                  ? "border-[rgba(245,166,35,0.50)] bg-[rgba(245,166,35,0.08)] shadow-[0_18px_50px_rgba(245,166,35,0.08)]"
                  : "border-[rgba(255,255,255,0.07)] bg-[#111116] hover:border-[rgba(255,255,255,0.13)] hover:bg-[#1A1A22]"
              }`}
            >
              {/* Checkmark indicator for selected */}
              {isActive && (
                <div className="absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#F5A623]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#09090C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}

              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${
                  isActive ? "bg-[#F5A623] text-[#09090C]" : "bg-[rgba(255,255,255,0.04)] text-[#F5A623]"
                }`}
              >
                {mode.icon}
              </div>
              <h3 className="text-base font-semibold text-white">{mode.title}</h3>
              <p className="mt-1.5 text-[13px] text-[#8A8A9A]">{mode.description}</p>
            </button>
          );
        })}
      </div>

      {activeMode === "image_batch" && <ImageBatchPanel projectId={projectId || null} />}
      {activeMode === "handheld_video" && <HandheldVideoPanel projectId={projectId || null} />}
      {activeMode === "drone_footage" && <DroneFootagePanel projectId={projectId || null} />}
    </div>
  );
}
