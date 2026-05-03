"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DrisoraLogo } from "@/components/branding/DrisoraLogo";

type Step = 0 | 1 | 2;
type ResultTab = "image_batch" | "handheld_video" | "drone_footage";

const STEP_META = [
  { title: "Choose your survey type", subtitle: "Three modes, each built for a different scenario" },
  { title: "What you'll get", subtitle: "Interactive AI-powered results for every mode" },
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
      desc: "Best for: aerial coverage with embedded GPS mapping",
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
          className="flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4"
          style={{ animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms both` }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            {m.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{m.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{m.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const PCI_SAMPLES = [
  { pci: 92, color: "#22c55e" }, { pci: 74, color: "#eab308" },
  { pci: 58, color: "#f97316" }, { pci: 41, color: "#ef4444" },
  { pci: 86, color: "#22c55e" }, { pci: 63, color: "#f97316" },
  { pci: 28, color: "#7f1d1d" }, { pci: 79, color: "#eab308" },
];

function ImageBatchMockup() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PCI_SAMPLES.map((s, i) => (
        <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-[#111]">
          <div className="absolute inset-0" style={{ background: `${s.color}10` }} />
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-700">🛣</div>
          <div
            className="absolute right-1 top-1 rounded px-1 py-0.5 font-mono text-[9px] font-bold"
            style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44` }}
          >
            {s.pci}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoMockup() {
  const points = [85, 78, 72, 68, 75, 80, 65, 59, 70, 76, 82];
  const W = 260;
  const H = 80;
  const stepW = W / (points.length - 1);
  const pts = points.map((p, i) => `${i * stepW},${H - (p / 100) * H}`).join(" ");
  const fill = `M0,${H - (points[0] / 100) * H} ${points.map((p, i) => `L${i * stepW},${H - (p / 100) * H}`).join(" ")} L${(points.length - 1) * stepW},${H} L0,${H} Z`;
  return (
    <div>
      <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-gray-600">PCI over time</p>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full">
        {[25, 50, 75].map((v) => (
          <line key={v} x1="0" y1={H - (v / 100) * H} x2={W} y2={H - (v / 100) * H} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        <path d={fill} fill="#f59e0b1a" />
        <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={i * stepW} cy={H - (p / 100) * H} r="2.5" fill="#f59e0b" />)}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-gray-700">
        <span>Frame 0</span><span>Frame {points.length - 1}</span>
      </div>
    </div>
  );
}

function DroneMockup() {
  const gps = [
    { x: 30, y: 60, color: "#22c55e" }, { x: 65, y: 48, color: "#eab308" },
    { x: 100, y: 38, color: "#f97316" }, { x: 140, y: 32, color: "#ef4444" },
    { x: 180, y: 42, color: "#ef4444" }, { x: 215, y: 54, color: "#22c55e" },
    { x: 245, y: 64, color: "#eab308" },
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
            <circle cx={p.x} cy={p.y} r="8" fill={`${p.color}22`} stroke={p.color} strokeWidth="1.5" />
            <circle cx={p.x} cy={p.y} r="2.5" fill={p.color} />
          </g>
        ))}
      </svg>
      <p className="mt-1 text-center font-mono text-[9px] text-gray-600">GPS route with PCI scoring</p>
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
      <div className="flex gap-1 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.id ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
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
    { n: "②", label: "AI analyses pavement", desc: "Crack detection + PCI scoring" },
    { n: "③", label: "Download IRC report", desc: "IRC:82-2023 compliant PDF" },
  ];
  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {steps.map((s, i) => (
          <div key={s.n} className="relative flex flex-1 flex-col items-center text-center">
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-5 hidden h-px w-8 bg-[#2a2a2a] sm:block" />
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-lg text-amber-500">
              {s.n}
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{s.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onDashboard}
          className="text-xs text-gray-600 underline hover:text-gray-400"
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <DrisoraLogo size="lg" showSubtext />
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-8">
          <div className="mb-6 flex items-center justify-center gap-2">
            {([0, 1, 2] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-amber-500" : "w-2 bg-[#2a2a2a]"
                }`}
              />
            ))}
          </div>

          <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-amber-500">
            Step {step + 1} of 3
          </p>
          <h1 className="text-center text-xl font-semibold text-white">{STEP_META[step].title}</h1>
          <p className="mt-1 text-center text-sm text-gray-500">{STEP_META[step].subtitle}</p>

          <div className="mt-6">
            {step === 0 && <StepOne />}
            {step === 1 && <StepTwo activeTab={activeTab} setActiveTab={setActiveTab} />}
            {step === 2 && <StepThree onDashboard={() => router.push("/dashboard")} />}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-gray-400 transition-colors hover:border-[#3a3a3a] hover:text-white"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
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
