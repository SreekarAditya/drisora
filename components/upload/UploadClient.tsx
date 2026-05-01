"use client";

import { useState } from "react";
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

const MODES: ModeCard[] = [
  {
    id: "image_batch",
    title: "Image Batch",
    description: "1 to 1,000 images · JPEG/PNG · GPS auto-detected from EXIF",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: "handheld_video",
    title: "Handheld Video",
    description: "Single MP4/MOV · No GPS needed · Frame interval picker",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="3" />
        <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
      </svg>
    ),
  },
];

export function UploadClient() {
  const [activeMode, setActiveMode] = useState<UploadMode | null>(null);

  return (
    <div className="space-y-10">
      {/* Mode cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <div
              key={mode.id}
              className={`flex flex-col rounded-xl border p-6 transition-colors ${
                isActive
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-[#1a1a1a] bg-[#0f0f0f] hover:border-[#2a2a2a]"
              }`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${
                  isActive ? "bg-amber-500 text-black" : "bg-[#1a1a1a] text-amber-500"
                }`}
              >
                {mode.icon}
              </div>
              <h3 className="text-base font-semibold text-white">{mode.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500">{mode.description}</p>
              <button
                type="button"
                onClick={() => setActiveMode(mode.id)}
                className={`mt-6 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "border border-[#2a2a2a] bg-[#141414] text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
                }`}
              >
                {isActive ? "Selected" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Mode panel */}
      {activeMode === "image_batch" && <ImageBatchPanel />}
      {activeMode === "handheld_video" && <HandheldVideoPanel />}
      {activeMode === "drone_footage" && <DroneFootagePanel />}
    </div>
  );
}
