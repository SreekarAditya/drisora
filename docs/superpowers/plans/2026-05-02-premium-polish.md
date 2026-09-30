# Premium Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add onboarding tour, enhanced empty/error states, loading skeletons, per-file upload validation errors, and a full mobile audit — page-by-page per the approved spec.

**Architecture:** Five pages tackled in order: `/onboarding/tour` (new route), `/dashboard`, `/jobs/[id]`, `/jobs/[id]/results`, then a global mobile pass. Each task ends with a TypeScript check. The Python worker polls Redis every 5s for `status === "queued"` jobs — retry just resets Redis + Supabase; no RunPod call needed from Next.js.

**Tech Stack:** Next.js App Router (server + client components), Supabase, Redis (`@upstash/redis`), Tailwind CSS v4, TypeScript. No test framework — use `npx tsc --noEmit` for verification after each task.

---

## Task 1: Create `/onboarding/tour` page

**Files:**
- Create: `app/onboarding/tour/page.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
// app/onboarding/tour/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Step = 0 | 1 | 2;
type ResultTab = "image_batch" | "handheld_video" | "drone_footage";

const STEP_META = [
  { title: "Choose your survey type", subtitle: "Three modes, each built for a different scenario" },
  { title: "What you'll get", subtitle: "Interactive AI-powered results for every mode" },
  { title: "Here's how it works", subtitle: "From upload to report in three steps" },
] as const;

// ─── Step 1 ───────────────────────────────────────────────────────────────────

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

// ─── Step 2 ───────────────────────────────────────────────────────────────────

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

// ─── Step 3 ───────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-white">Drisora</span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-amber-500" />
            <span className="text-[11px] uppercase tracking-widest text-gray-600">Pavement Intelligence</span>
            <span className="h-1 w-1 rounded-full bg-amber-500" />
          </div>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-8">
          {/* Pill dots */}
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

          {/* Step label */}
          <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-amber-500">
            Step {step + 1} of 3
          </p>
          <h1 className="text-center text-xl font-semibold text-white">{STEP_META[step].title}</h1>
          <p className="mt-1 text-center text-sm text-gray-500">{STEP_META[step].subtitle}</p>

          {/* Body */}
          <div className="mt-6">
            {step === 0 && <StepOne />}
            {step === 1 && <StepTwo activeTab={activeTab} setActiveTab={setActiveTab} />}
            {step === 2 && <StepThree onDashboard={() => router.push("/dashboard")} />}
          </div>

          {/* Footer */}
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/tour/page.tsx
git commit -m "feat: add 3-step onboarding tour at /onboarding/tour"
```

---

## Task 2: Wire onboarding redirect to tour

**Files:**
- Modify: `app/onboarding/page.tsx` — change `router.push("/dashboard")` to `router.push("/onboarding/tour")` after successful profile save

- [ ] **Step 1: Update the redirect**

In `app/onboarding/page.tsx`, find the `handleSubmit` function. Replace the final `router.push("/dashboard")` with `router.push("/onboarding/tour")`:

```tsx
// Before (line ~81):
router.push("/dashboard");
router.refresh();

// After:
router.push("/onboarding/tour");
```

Also update the already-onboarded guard (the check that redirects if profile is already complete). That one correctly goes to `/dashboard` — leave it unchanged.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: redirect to /onboarding/tour after profile save"
```

---

## Task 3: Enhance dashboard EmptyState + mobile table scroll

**Files:**
- Modify: `components/dashboard/JobList.tsx`

- [ ] **Step 1: Update EmptyState component**

Replace the existing `EmptyState` function (lines 140–163) with:

```tsx
function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-6 py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#222] bg-[#111]"
        style={{ boxShadow: "0 0 24px rgba(245,158,11,0.15)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-amber-500">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white">No surveys yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-gray-500">
        Upload drone footage, a handheld video, or an image batch to get your first PCI report.
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
```

- [ ] **Step 2: Wrap table in overflow-x-auto and hide Frames column on mobile**

In the `JobList` function, wrap the table div:

```tsx
// Before:
<div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
  <table className="w-full">

// After:
<div className="overflow-x-auto overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
  <table className="w-full min-w-[640px]">
```

In the `<thead>`, add `hidden sm:table-cell` to the "Frames" `<th>`:

```tsx
<th className="hidden px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600 sm:table-cell">
  Frames
</th>
```

In `JobRow`, add `hidden sm:table-cell` to the Frames `<td>`:

```tsx
<td className="hidden px-4 py-3.5 font-mono text-sm text-gray-400 sm:table-cell">
  {job.frame_count ?? "—"}
</td>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/JobList.tsx
git commit -m "feat: enhance dashboard empty state and add mobile table scroll"
```

---

## Task 4: Create DashboardSkeleton

**Files:**
- Create: `components/dashboard/DashboardSkeleton.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/dashboard/DashboardSkeleton.tsx

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`rounded bg-[#1a1a1a] ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-x 1.6s infinite",
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Header row */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-4">
            <Skeleton className="mb-2 h-2.5 w-24" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-2 w-28" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] bg-[#0f0f0f] px-6 py-3">
          <Skeleton className="h-2.5 w-72" />
        </div>
        <div className="divide-y divide-[#141414]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3.5">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="ml-4 h-5 w-28 rounded-full" />
              <Skeleton className="ml-4 h-3 w-10" />
              <Skeleton className="ml-4 h-3 w-10" />
              <Skeleton className="ml-4 h-6 w-20 rounded-full" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-7 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardSkeleton.tsx
git commit -m "feat: add DashboardSkeleton shimmer component"
```

---

## Task 5: Add Suspense to dashboard page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace the page with Suspense-wrapped version**

```tsx
// app/(dashboard)/dashboard/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobList } from "@/components/dashboard/JobList";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { JobRecord } from "@/types";

async function JobListFetcher({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return <JobList jobs={(jobs ?? []) as JobRecord[]} />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <JobListFetcher userId={user.id} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: add Suspense skeleton to dashboard page"
```

---

## Task 6: Create retry API endpoint

**Files:**
- Create: `app/api/jobs/[id]/retry/route.ts`

- [ ] **Step 1: Create the endpoint**

```ts
// app/api/jobs/[id]/retry/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import type { JobRecord } from "@/app/api/jobs/create/route";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "failed") {
    return NextResponse.json({ error: "Job is not in failed state" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "queued", error_message: null, processed_count: 0, completed_at: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to reset job" }, { status: 500 });
  }

  // Reset Redis so the Python worker picks it up on its next poll
  const redis = getRedisClient();
  const raw = await redis.get<string>(`job:${id}`);
  if (raw) {
    const redisJob = (typeof raw === "string" ? JSON.parse(raw) : raw) as JobRecord;
    redisJob.status = "queued";
    redisJob.error_message = null;
    redisJob.processed_count = 0;
    redisJob.last_updated = new Date().toISOString();
    await redis.set(`job:${id}`, JSON.stringify(redisJob));
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/jobs/[id]/retry/route.ts
git commit -m "feat: add POST /api/jobs/[id]/retry endpoint to re-queue failed jobs"
```

---

## Task 7: Update job status page — retry button + timeout message

**Files:**
- Modify: `app/jobs/[id]/page.tsx`

- [ ] **Step 1: Add `pollKey` state and `retrying`/`retryError` states; update useEffect dependency**

At the top of the `JobPage` component, add these states:

```tsx
const [pollKey, setPollKey] = useState(0);
const [retrying, setRetrying] = useState(false);
const [retryError, setRetryError] = useState<string | null>(null);
```

Update the `useEffect` dependency array to include `pollKey`:

```tsx
// Before:
}, [id, router]);

// After:
}, [id, router, pollKey]);
```

- [ ] **Step 2: Add `handleRetry` function inside `JobPage` (before the return)**

```tsx
async function handleRetry() {
  setRetrying(true);
  setRetryError(null);
  try {
    const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    if (!res.ok) {
      setRetryError("Retry failed — please try again.");
      return;
    }
    setJob(null);
    setPollKey((k) => k + 1);
  } catch {
    setRetryError("Retry failed — please try again.");
  } finally {
    setRetrying(false);
  }
}
```

- [ ] **Step 3: Replace the failed-state JSX**

Compute `isTimeout` just before the `return` statement (outside JSX):

```tsx
const isTimeout = job.status === "failed" &&
  (job.error_message?.toLowerCase().includes("timeout") ?? false);
```

Find the `job.status === "failed"` branch (currently renders an icon + "Processing failed" + error + "Try again" link). Replace the entire failed `<div>` content:

```tsx
{job.status === "failed" ? (
  <div className="text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5v-4h2v4H9zm0 2h2v-2H9v2z" clipRule="evenodd" />
      </svg>
    </div>
    <h2 className="text-lg font-semibold text-white">
      {isTimeout ? "Processing timed out" : "Processing failed"}
    </h2>
    {isTimeout ? (
      <p className="mt-2 text-sm text-gray-500">
        The pipeline took too long and was stopped automatically.
      </p>
    ) : job.error_message ? (
      <p className="mt-2 text-sm text-gray-500">{job.error_message}</p>
    ) : null}
    <button
      type="button"
      onClick={handleRetry}
      disabled={retrying}
      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {retrying && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
      )}
      {retrying ? "Retrying…" : "Retry"}
    </button>
    {retryError && (
      <p className="mt-2 text-sm text-red-400">{retryError}</p>
    )}
    {isTimeout && (
      <a
        href="mailto:support@drisora.com"
        className="mt-3 block text-sm text-gray-400 underline hover:text-gray-300"
      >
        Contact support
      </a>
    )}
    <Link
      href="/upload"
      className="mt-3 block text-sm text-gray-500 hover:text-gray-400"
    >
      New survey
    </Link>
  </div>
) : job.status === "complete" ? (
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/jobs/[id]/page.tsx
git commit -m "feat: retry button with re-queue, timeout-specific error state"
```

---

## Task 8: Add pre-upload validation errors to upload panels

**Files:**
- Modify: `components/upload/ImageBatchPanel.tsx`
- Modify: `components/upload/HandheldVideoPanel.tsx`
- Modify: `components/upload/DroneFootagePanel.tsx`

### ImageBatchPanel

- [ ] **Step 1: Add `fileErrors` state and update `addFiles`**

Add state at the top of `ImageBatchPanel`:

```tsx
const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
```

Replace the `addFiles` function:

```tsx
function addFiles(incoming: FileList | File[]) {
  const accepted: FilePreview[] = [];
  const newErrors: Record<string, string> = {};

  Array.from(incoming).forEach((file) => {
    if (!file.type.startsWith("image/")) {
      newErrors[file.name] = "Unsupported format";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      newErrors[file.name] = "File too large (max 50 MB)";
      return;
    }
    accepted.push({ file, url: URL.createObjectURL(file) });
  });

  if (Object.keys(newErrors).length > 0) {
    setFileErrors((prev) => ({ ...prev, ...newErrors }));
  }
  if (accepted.length === 0 && Object.keys(newErrors).length === 0) return;
  if (accepted.length > 0) {
    setFiles((prev) => [...prev, ...accepted].slice(0, 1000));
  }
}
```

- [ ] **Step 2: Render per-file errors and disable submit when errors exist**

After the dropzone `<label>` block and before the files grid, add:

```tsx
{Object.keys(fileErrors).length > 0 && (
  <div className="mt-4 space-y-1.5">
    {Object.entries(fileErrors).map(([name, reason]) => (
      <div key={name} className="flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
        <span className="max-w-[70%] truncate text-xs text-red-300">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400">{reason}</span>
          <button
            type="button"
            onClick={() => setFileErrors((prev) => {
              const next = { ...prev };
              delete next[name];
              return next;
            })}
            className="text-xs text-gray-600 hover:text-gray-400"
            aria-label={`Dismiss error for ${name}`}
          >
            ✕
          </button>
        </div>
      </div>
    ))}
  </div>
)}
```

Update the submit button to also disable when there are file errors:

```tsx
// Before:
disabled={isUploading || files.length === 0}

// After:
disabled={isUploading || files.length === 0 || Object.keys(fileErrors).length > 0}
```

Also clear errors when clearing all files. In the "Clear all" button handler:

```tsx
onClick={() => {
  files.forEach((f) => URL.revokeObjectURL(f.url));
  setFiles([]);
  setFileErrors({});
}}
```

### HandheldVideoPanel

- [ ] **Step 3: Add `videoError` state and update `setSingleVideo`**

Add state:

```tsx
const [videoError, setVideoError] = useState<string | null>(null);
```

Replace `setSingleVideo`:

```tsx
function setSingleVideo(file: File | null) {
  if (!file) return;
  setVideoError(null);
  if (!file.type.startsWith("video/") && !/\.(mp4|mov)$/i.test(file.name)) {
    setVideoError(`${file.name} — Unsupported format (MP4 or MOV required)`);
    return;
  }
  setVideo(file);
}
```

After the dropzone label, add error display:

```tsx
{videoError && (
  <div className="mt-4 flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
    <span className="truncate text-xs text-red-300">{videoError}</span>
    <button
      type="button"
      onClick={() => setVideoError(null)}
      className="ml-2 text-xs text-gray-600 hover:text-gray-400"
    >
      ✕
    </button>
  </div>
)}
```

Update submit button:

```tsx
disabled={isUploading || !video || !!videoError}
```

### DroneFootagePanel

- [ ] **Step 4: Same pattern for DroneFootagePanel**

Add state:

```tsx
const [videoError, setVideoError] = useState<string | null>(null);
```

Replace `setSingleVideo`:

```tsx
function setSingleVideo(file: File | null) {
  if (!file) return;
  setVideoError(null);
  if (!file.type.startsWith("video/") && !/\.(mp4|mov)$/i.test(file.name)) {
    setVideoError(`${file.name} — Unsupported format (MP4 or MOV required)`);
    return;
  }
  setVideo(file);
  setGps({ kind: "unchecked" });
  setSrt(null);
}
```

After the video dropzone label, add:

```tsx
{videoError && (
  <div className="mt-4 flex items-center justify-between rounded-md bg-red-500/10 px-3 py-2">
    <span className="truncate text-xs text-red-300">{videoError}</span>
    <button
      type="button"
      onClick={() => setVideoError(null)}
      className="ml-2 text-xs text-gray-600 hover:text-gray-400"
    >
      ✕
    </button>
  </div>
)}
```

Update submit button:

```tsx
disabled={isUploading || !canSubmit || !!videoError}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/upload/ImageBatchPanel.tsx components/upload/HandheldVideoPanel.tsx components/upload/DroneFootagePanel.tsx
git commit -m "feat: per-file validation errors on upload panels"
```

---

## Task 9: Add NoDetectionsState + no-GPS state to results

**Files:**
- Modify: `components/results/jobs/shared.tsx`
- Modify: `components/results/jobs/ImageBatchResults.tsx`
- Modify: `components/results/jobs/HandheldVideoResults.tsx`
- Modify: `components/results/jobs/DroneJobResults.tsx`

- [ ] **Step 1: Add `NoDetectionsState` to `shared.tsx`**

At the end of `components/results/jobs/shared.tsx`, add:

```tsx
export function NoDetectionsState({ jobId }: { jobId: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-emerald-400">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">No defects detected</h2>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        This road section scored PCI 100 — no cracks or damage were found.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <a
          href={`/api/jobs/${jobId}/report`}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          Download report
        </a>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-300">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
```

Add `import Link from "next/link";` at the top of `shared.tsx` if not already present.

- [ ] **Step 2: Guard `ImageBatchResults` — add no-detections check**

In `components/results/jobs/ImageBatchResults.tsx`, add import:

```tsx
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
```

At the top of the `ImageBatchResults` function body, before any other logic, add:

```tsx
if (results.frames.length === 0) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      <NoDetectionsState jobId={jobId} />
    </div>
  );
}
```

Also change the image grid class to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (mobile fix per spec):

```tsx
// Find the results grid and update its className
className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
```

- [ ] **Step 3: Guard `HandheldVideoResults`**

In `components/results/jobs/HandheldVideoResults.tsx`, add the same guard after imports:

```tsx
import { SummaryBar, NoDetectionsState } from "./shared";
```

At the top of `HandheldVideoResults` function body:

```tsx
if (results.frames.length === 0) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      <NoDetectionsState jobId={jobId} />
    </div>
  );
}
```

- [ ] **Step 4: Guard `DroneJobResults` — no-detections check only**

In `components/results/jobs/DroneJobResults.tsx`, update import:

```tsx
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
```

At the top of `DroneJobResults` function body, after the destructure of `results`, add:

```tsx
if (results.frames.length === 0) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      <NoDetectionsState jobId={jobId} />
    </div>
  );
}
```

**Note:** The no-GPS empty state and mobile bottom sheet are handled together in Task 12, which replaces the full map section. Do not touch the map section in this task.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/results/jobs/shared.tsx components/results/jobs/ImageBatchResults.tsx components/results/jobs/HandheldVideoResults.tsx components/results/jobs/DroneJobResults.tsx
git commit -m "feat: no-detections state, no-GPS map empty state, mobile grid fix"
```

---

## Task 10: ResultsSkeleton + Suspense on results page

**Files:**
- Create: `components/results/jobs/ResultsSkeleton.tsx`
- Modify: `app/jobs/[id]/results/page.tsx`

- [ ] **Step 1: Create ResultsSkeleton**

```tsx
// components/results/jobs/ResultsSkeleton.tsx

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`rounded bg-[#1a1a1a] ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-x 1.6s infinite",
      }}
    />
  );
}

export function ResultsSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* SummaryBar shimmer */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content area shimmer */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update results page to use Suspense**

```tsx
// app/jobs/[id]/results/page.tsx
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobResults } from "@/lib/jobs/results";
import { ImageBatchResults } from "@/components/results/jobs/ImageBatchResults";
import { HandheldVideoResults } from "@/components/results/jobs/HandheldVideoResults";
import { DroneJobResults } from "@/components/results/jobs/DroneJobResults";
import { ResultsSkeleton } from "@/components/results/jobs/ResultsSkeleton";
import type { JobMode } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function ResultsContent({ id, userId }: { id: string; userId: string }) {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, gps_available, created_at, average_pci, r2_prefix")
    .eq("id", id)
    .single();

  if (!job || job.user_id !== userId) notFound();
  if (job.status !== "complete") redirect(`/jobs/${id}`);

  const results = await loadJobResults(id, userId, job.mode as JobMode);

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization, full_name")
    .eq("id", userId)
    .single();

  const orgName = profile?.organization ?? profile?.full_name ?? "Unknown";
  const surveyDate = new Date(job.created_at).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const sharedProps = { results, jobId: id, surveyDate, orgName };

  if (job.mode === "image_batch") return <ImageBatchResults {...sharedProps} />;
  if (job.mode === "handheld_video") return <HandheldVideoResults {...sharedProps} />;
  if (job.mode === "drone_footage") return <DroneJobResults {...sharedProps} />;

  notFound();
}

export default async function JobResultsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsContent id={id} userId={user.id} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/results/jobs/ResultsSkeleton.tsx app/jobs/[id]/results/page.tsx
git commit -m "feat: ResultsSkeleton and Suspense boundary on results page"
```

---

## Task 11: Mobile navbar — hamburger dropdown

**Files:**
- Modify: `components/dashboard/Navbar.tsx`

- [ ] **Step 1: Replace the Navbar component**

```tsx
// components/dashboard/Navbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface NavbarProfile {
  full_name: string | null;
  org_name: string | null;
}

interface NavbarProps {
  user: User;
  profile: NavbarProfile | null;
}

export function Navbar({ user, profile }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const displayName = profile?.full_name ?? user.email ?? "U";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold tracking-tight text-white"
          >
            Drisora
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Surveys
            </Link>
            <Link
              href="/upload"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              New Survey
            </Link>
          </nav>
        </div>

        {/* Right: desktop controls + hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop: org name, avatar, sign out */}
          {profile?.org_name && (
            <span className="hidden max-w-[160px] truncate text-xs text-gray-500 md:block">
              {profile.org_name}
            </span>
          )}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black"
              aria-label={displayName}
            >
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white md:block"
          >
            Sign out
          </button>

          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="w-full border-b border-[#1a1a1a] bg-[#0f0f0f] px-6 py-2 md:hidden">
          <Link
            href="/dashboard"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Surveys
          </Link>
          <Link
            href="/upload"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            New Survey
          </Link>
          <div className="my-1 h-px bg-[#1a1a1a]" />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Navbar.tsx
git commit -m "feat: hamburger dropdown menu for mobile navbar"
```

---

## Task 12: Mobile — useMediaQuery hook + DroneJobResults bottom sheet

**Files:**
- Create: `hooks/useMediaQuery.ts`
- Modify: `components/results/jobs/DroneJobResults.tsx`

- [ ] **Step 1: Create `hooks/useMediaQuery.ts`**

```ts
// hooks/useMediaQuery.ts
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    function listener(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Import hook in `DroneJobResults.tsx` and add mobile bottom sheet logic**

Add import at the top:

```tsx
import { useMediaQuery } from "@/hooks/useMediaQuery";
```

Inside the `DroneJobResults` function, add:

```tsx
const isMobile = useMediaQuery("(max-width: 1023px)");
```

- [ ] **Step 3: Update the map + sidebar layout for mobile**

Replace the entire `{/* Map + sidebar */}` section:

```tsx
{/* Map + sidebar */}
<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
  <div className="h-[560px] overflow-hidden rounded-xl border border-[#1a1a1a]">
    {gpsFrames.length === 0 ? (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-3 text-gray-600">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-sm font-semibold text-white">No GPS data available</p>
        <p className="mt-1 text-xs text-gray-600">
          This survey has no location coordinates — the map view is unavailable.
        </p>
        <p className="mt-1 text-xs text-gray-700">
          Results are still available in the crack distribution section below.
        </p>
      </div>
    ) : (
      <DroneMapClient
        frames={frames}
        onSelect={handleSelect}
        selectedStem={selectedFrame?.stem ?? null}
      />
    )}
  </div>

  {/* Desktop sidebar (hidden on mobile — bottom sheet used instead) */}
  <div className="hidden h-[560px] lg:block">
    {selectedFrame ? (
      <SegmentSidebar frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
    ) : (
      <div className="flex h-full items-center justify-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="px-6 text-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-[#2a2a2a]">
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="16" y1="4" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="16" y1="24" x2="16" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="4" y1="16" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="24" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-gray-600">Click a segment on the map</p>
        </div>
      </div>
    )}
  </div>
</div>

{/* Mobile bottom sheet */}
{isMobile && selectedFrame && (
  <div className="fixed bottom-0 left-0 right-0 z-50 h-96 overflow-hidden rounded-t-xl border-t border-[#1a1a1a] bg-[#0f0f0f]">
    <div className="flex justify-center pt-3 pb-1">
      <div className="h-1 w-10 rounded-full bg-[#333]" />
    </div>
    <SegmentSidebar frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Full build check**

```bash
npm run build
```

Expected: Build succeeds with no type errors. Fix any errors before committing.

- [ ] **Step 6: Commit**

```bash
git add hooks/useMediaQuery.ts components/results/jobs/DroneJobResults.tsx
git commit -m "feat: mobile bottom sheet for drone map sidebar, useMediaQuery hook"
```

---

## Final check

- [ ] **Run full TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: 0 errors, build succeeds.

- [ ] **Verify each page at glance**
  - `/onboarding/tour` — 3 steps, pill dots, keyboard nav, skip button
  - `/dashboard` (empty) — amber glow icon, correct subtext
  - `/dashboard` (loading) — 4 shimmer stat cards + 4 skeleton rows
  - `/jobs/[id]` (failed) — Retry button with spinner, timeout message variant
  - `/upload` (ImageBatch) — drop wrong-type file → red error row + disabled submit
  - `/jobs/[id]/results` (no frames) — green checkmark state + download/back links
  - `/jobs/[id]/results` (drone, no GPS) — location pin state inside map container
  - Navbar on mobile — hamburger icon → full-width dropdown → closes on nav
  - Map page on mobile — bottom sheet slides when segment selected
