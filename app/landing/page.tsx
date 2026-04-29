import Link from "next/link"
import { PCI_BANDS } from "@/types"

const FEATURES = [
  {
    name: "Resumable Upload",
    desc: "50 MB chunks, resume across devices",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "YOLOv12s Detection",
    desc: "Trained on RDD2022, 4 crack classes",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="#f59e0b" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "IRC:82-2023 PCI",
    desc: "Per-section scoring, intervention matrix",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 12L5 7l3 3 3-4 4 4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Geospatial Map",
    desc: "Road sections colour coded by severity",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 1l6 2v12l-6-2V1zM5 1L1 3v12l4-2M11 3l4-2v12l-4 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "PDF Report",
    desc: "Cover page, PCI table, priority matrix, appendix",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6M9 1l4 5M9 1v5h4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10h6M5 12h4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "SAM2 Segmentation",
    desc: "Pixel-level crack masks per detection",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#f59e0b" strokeWidth="1.5" />
        <path d="M5 8c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="8" r="1" fill="#f59e0b" />
      </svg>
    ),
  },
]

const STEPS = [
  {
    n: "01",
    title: "Upload",
    desc: "Drop MP4 + SRT telemetry. Upload runs in background.",
  },
  {
    n: "02",
    title: "Pipeline",
    desc: "YOLOv12s → SAM2 → DepthPro → IRC-PCI scorer.",
  },
  {
    n: "03",
    title: "Report",
    desc: "Geospatial map, PCI table, PDF. Share link included.",
  },
]

const ORG_LABELS = [
  "PWD",
  "NHAI",
  "Municipal Corporations",
  "EPC Contractors",
  "Research Institutions",
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Nav ──────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Drisora
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        {/* Amber radial glow — very faint */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(245,158,11,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Label pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-1 text-xs font-medium tracking-wide text-amber-400">
            IRC:82-2023 Compliant
          </div>

          {/* Headline */}
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight text-white md:text-7xl">
            Road condition assessment,{" "}
            <span className="text-gray-400">built for engineers.</span>
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-lg text-base leading-relaxed text-gray-500">
            Upload drone footage. Get a PCI-scored geospatial report in
            minutes. No manual inspection required.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
            >
              Get Started
            </Link>
            <a
              href="#how-it-works"
              className="rounded-md border border-[#2a2a2a] px-6 py-2.5 text-sm font-medium text-gray-400 hover:border-[#3a3a3a] hover:text-white transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Bottom fade rule */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1a1a1a] to-transparent" />
      </section>

      {/* ── Social proof bar ─────────────────────────────── */}
      <section className="border-b border-[#1a1a1a] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-gray-600">
            Built for infrastructure teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {ORG_LABELS.map((label) => (
              <span key={label} className="text-sm font-medium text-gray-700">
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────── */}
      <section className="border-b border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">
              Platform
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Everything the field team needs.
            </h2>
          </div>

          <div className="grid gap-px bg-[#1a1a1a] sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="group bg-[#0a0a0a] p-7 hover:bg-[#111111] transition-colors"
              >
                <div className="mb-4">{f.icon}</div>
                <p className="mb-1 text-sm font-semibold text-white">{f.name}</p>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">
              Process
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              From flight to report in three steps.
            </h2>
          </div>

          <div className="relative grid gap-10 sm:grid-cols-3">
            {/* Connecting line — desktop only */}
            <div
              className="absolute top-7 left-0 right-0 hidden h-px sm:block"
              style={{
                background:
                  "linear-gradient(to right, transparent, #1a1a1a 15%, #1a1a1a 85%, transparent)",
              }}
            />

            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#1a1a1a] bg-[#111111]">
                  <span className="text-xl font-light text-amber-500">{s.n}</span>
                </div>
                <p className="mb-2 text-base font-semibold text-white">{s.title}</p>
                <p className="text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PCI bands ────────────────────────────────────── */}
      <section className="border-b border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Five condition bands. One standard.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
              IRC:82-2023 defines road condition in five categories. Drisora
              scores every 10 m section automatically.
            </p>
          </div>

          {/* Horizontal swatch bar */}
          <div className="mb-8 flex h-3 overflow-hidden rounded-full">
            {PCI_BANDS.map((b) => (
              <div
                key={b.label}
                className="flex-1"
                style={{ backgroundColor: b.color }}
              />
            ))}
          </div>

          {/* Band rows */}
          <div className="divide-y divide-[#1a1a1a] overflow-hidden rounded-xl border border-[#1a1a1a]">
            {PCI_BANDS.map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-between bg-[#0d0d0d] px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-sm font-medium text-white">
                    {b.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-gray-500">
                  {b.range}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div
            className="relative overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] px-8 py-16 text-center"
            style={{ boxShadow: "inset 0 1px 0 0 rgba(245,158,11,0.15)" }}
          >
            {/* Top amber line */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(245,158,11,0.5) 40%, rgba(245,158,11,0.5) 60%, transparent)",
              }}
            />

            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Start your first survey.
            </h2>
            <p className="mt-3 text-sm text-gray-500">
              Upload a drone flight and get a full IRC report in minutes.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex rounded-md bg-amber-500 px-8 py-2.5 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a1a] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Drisora
          </span>
          <span className="text-xs text-gray-600">
            Built for infrastructure engineers
          </span>
        </div>
      </footer>

    </div>
  )
}
