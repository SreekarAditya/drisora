"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DrisoraLogo } from "@/components/branding/DrisoraLogo";

type Step = 0 | 1 | 2;
type ResultTab = "image_batch" | "handheld_video" | "drone_footage";

const STEP_META = [
  { title: "Choose your survey type", subtitle: "Three modes, each built for a different scenario" },
  { title: "What you'll get", subtitle: "Detection evidence for every mode; bounds only for calibrated drone sections" },
  { title: "Here's how it works", subtitle: "From upload to report in three steps" },
] as const;

function StepOne() {
  const modes = [
    {
      title: "Image Batch",
      desc: "Best for: road inspections with DSLR or phone camera",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      ),
    },
    {
      title: "Handheld Video",
      desc: "Best for: continuous road surveys filmed from a moving vehicle",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M22 8l-6 4 6 4V8z" />
        </svg>
      ),
    },
    {
      title: "Drone Footage",
      desc: "Best for: aerial coverage with paired SRT GPS mapping",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="3" />
          <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
        </svg>
      ),
    },
  ];
  return (
    <div className="space-y-3">
      {modes.map((m, i) => (
        <div
          key={m.title}
          className="flex items-center gap-4 rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-4"
          style={{ animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms both` }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5A623]/10 text-[#F5A623]">
            {m.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F0F0F4]">{m.title}</p>
            <p className="mt-0.5 text-xs text-[#8A8A9A]">{m.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const DETECTION_SAMPLES = [
  { label: "D00", color: "#F5A623" }, { label: "D10", color: "#F5A623" },
  { label: "D20", color: "#F5A623" }, { label: "D40", color: "#F5A623" },
  { label: "MASK", color: "#38bdf8" }, { label: "MASK", color: "#38bdf8" },
  { label: "NONE", color: "#71717a" }, { label: "MASK", color: "#38bdf8" },
];

function ImageBatchMockup() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {DETECTION_SAMPLES.map((sample, i) => (
        <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-[#111116]">
          <div className="absolute inset-0" style={{ background: `${sample.color}10` }} />
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#4A4A5A]">🛣</div>
          <div
            className="absolute right-1 top-1 rounded px-1 py-0.5 font-mono text-[9px] font-bold"
            style={{ background: `${sample.color}22`, color: sample.color, border: `1px solid ${sample.color}44` }}
          >
            {sample.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoMockup() {
  const evidence = ["D00", "—", "D10", "D20", "—", "D40", "D00", "—"];
  return (
    <div>
      <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-[#4A4A5A]">Frame evidence timeline · no PCI inferred</p>
      <div className="grid grid-cols-8 gap-1.5">
        {evidence.map((label, index) => (
          <div key={index} className="rounded border border-white/5 bg-[#111116] py-3 text-center">
            <div className={`mx-auto h-2 w-2 rounded-full ${label === "—" ? "bg-zinc-700" : "bg-amber-400"}`} />
            <span className="mt-2 block font-mono text-[8px] text-[#6F6F7D]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DroneMockup() {
  const gps = [
    { x: 30, y: 60 }, { x: 65, y: 48 }, { x: 100, y: 38 }, { x: 140, y: 32 },
    { x: 180, y: 42 }, { x: 215, y: 54 }, { x: 245, y: 64 },
  ];
  const pathD = `M${gps.map((p) => `${p.x},${p.y}`).join(" L")}`;
  return (
    <div>
      <svg viewBox="0 0 270 96" className="w-full">
        <rect width="270" height="96" fill="#0a0a0a" rx="6" />
        <path d={pathD} fill="none" stroke="#2a2a2a" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathD} fill="none" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        {gps.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="8" fill="#f59e0b22" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="#f59e0b" />
          </g>
        ))}
      </svg>
      <p className="mt-1 text-center font-mono text-[9px] text-[#4A4A5A]">GPS route · 100 m sections · PCI lower–upper bounds</p>
    </div>
  );
}

const TABS: { id: ResultTab; label: string }[] = [
  { id: "image_batch", label: "Image Batch" },
  { id: "handheld_video", label: "Handheld" },
  { id: "drone_footage", label: "Drone" },
];

function StepTwo({ activeTab, setActiveTab }: { activeTab: ResultTab; setActiveTab: (t: ResultTab) => void }) {
  return (
    <div>
      <div className="flex gap-1 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.id ? "bg-[rgba(255,255,255,0.04)] text-[#F0F0F4]" : "text-[#8A8A9A] hover:text-[#F0F0F4]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-4">
        {activeTab === "image_batch" && <ImageBatchMockup />}
        {activeTab === "handheld_video" && <VideoMockup />}
        {activeTab === "drone_footage" && <DroneMockup />}
      </div>
    </div>
  );
}

function StepThree({ onDashboard }: { onDashboard: () => void }) {
  const steps = [
    { n: "①", label: "Upload your footage", desc: "Images, video, or drone file" },
    { n: "②", label: "AI analyses pavement", desc: "Detection + spatially deduplicated masks" },
    { n: "③", label: "Download evidence", desc: "Partial PCI bounds + provenance PDF" },
  ];
  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {steps.map((s, i) => (
          <div key={s.n} className="relative flex flex-1 flex-col items-center text-center">
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-5 hidden h-px w-8 bg-[#2a2a2a] sm:block" />
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-lg text-[#F5A623]">
              {s.n}
            </div>
            <p className="mt-2 text-sm font-semibold text-[#F0F0F4]">{s.label}</p>
            <p className="mt-0.5 text-xs text-[#8A8A9A]">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onDashboard}
          className="text-xs text-[#4A4A5A] underline hover:text-[#8A8A9A]"
        >
          Take me to the dashboard
        </button>
      </div>
    </div>
  );
}

export default function OnboardingTourPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [activeTab, setActiveTab] = useState<ResultTab>("image_batch");

  const goNext = useCallback(() => {
    if (step < 2) {
      setStep((s) => (s + 1) as Step);
    } else {
      router.push("/upload");
    }
  }, [step, router]);

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => (s - 1) as Step);
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#09090C] px-6 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <DrisoraLogo size="lg" showSubtext />
        </div>

        <div className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-8">
          <div className="mb-6 flex items-center justify-center gap-2">
            {([0, 1, 2] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-[#F5A623]" : "w-2 bg-[#2a2a2a]"
                }`}
              />
            ))}
          </div>

          <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-[#F5A623]">
            Step {step + 1} of 3
          </p>
          <h1 className="text-center text-xl font-semibold text-[#F0F0F4]">{STEP_META[step].title}</h1>
          <p className="mt-1 text-center text-sm text-[#8A8A9A]">{STEP_META[step].subtitle}</p>

          <div className="mt-6">
            {step === 0 && <StepOne />}
            {step === 1 && <StepTwo activeTab={activeTab} setActiveTab={setActiveTab} />}
            {step === 2 && <StepThree onDashboard={() => router.push("/dashboard")} />}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-[#4A4A5A] hover:text-[#8A8A9A]"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-lg border border-[rgba(255,255,255,0.12)] px-4 py-2 text-sm text-[#8A8A9A] transition-colors hover:border-[#3a3a3a] hover:text-[#F0F0F4]"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-[#F5A623] px-5 py-2 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]"
              >
                {step === 2 ? "Upload your first survey →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
