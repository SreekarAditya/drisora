import Link from "next/link"
import { DrisoraLogo } from "@/components/branding/DrisoraLogo"
import { PCI_BANDS } from "@/types"

// ─── Static data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    tag: "Detection",
    name: "AI Crack Detection",
    desc: "Trained on RDD2022 across four crack classes: longitudinal, transverse, alligator, and pothole. Runs section-by-section at scale.",
    stat: "4 crack classes",
    wide: true,
  },
  {
    tag: "Segmentation",
    name: "Pixel-Level Segmentation",
    desc: "Each detected crack receives a pixel-level segmentation mask, enabling precise area measurement and severity quantification.",
    stat: "Pixel-level accuracy",
    wide: false,
  },
  {
    tag: "Scoring",
    name: "IRC:82-2023 PCI Scorer",
    desc: "Pavement Condition Index computed per 10 m section using the Indian Roads Congress standard.",
    stat: "Per-10 m scoring",
    wide: false,
  },
  {
    tag: "Geospatial",
    name: "Color-coded Map",
    desc: "Every section plotted on an interactive map, colored by condition band. Full GeoJSON export for GIS integration.",
    stat: "GeoJSON export",
    wide: false,
  },
  {
    tag: "Report",
    name: "IRC-compliant PDF",
    desc: "Cover page, executive summary, per-section PCI table, priority intervention matrix, and crack type appendix.",
    stat: "Shareable link",
    wide: false,
  },
  {
    tag: "Infrastructure",
    name: "Direct R2 Upload",
    desc: "Browser uploads directly to object storage with presigned PUT URLs, then RunPod processing starts automatically.",
    stat: "Presigned PUT",
    wide: true,
  },
]

const STEPS = [
  {
    n: "01",
    title: "Upload your flight",
    desc: "Drop the MP4 drone footage and paired SRT telemetry file. The browser uploads directly to R2, then processing starts after the manifest is complete.",
    lines: [
      { dim: false, text: "$ drisora upload flight.mp4 survey.srt" },
      { dim: true,  text: "▸ NH-48 Surat–Baroda Corridor  ·  2.1 GB" },
      { dim: true,  text: "▸ Direct R2 PUT  ·  signed URLs  ·  manifest lock" },
      { dim: false, text: "✓ RunPod queued — processing starts automatically" },
    ],
  },
  {
    n: "02",
    title: "Automated CV pipeline",
    desc: "Drisora AI detects cracks, the segmentation engine creates pixel masks, depth estimation measures crack width, then the IRC scorer computes PCI per 10 m section.",
    lines: [
      { dim: true,  text: "[Detect]    847 detections  /  32 sections" },
      { dim: true,  text: "[Segment]   pixel masks  ·  crack area mapped" },
      { dim: true,  text: "[Metric]    camera distance  ·  crack width" },
      { dim: false, text: "[IRC-PCI]   avg 67.3  ·  32 sections scored" },
    ],
    processing: true,
  },
  {
    n: "03",
    title: "Full report delivered",
    desc: "Geospatial map, PCI table, priority intervention matrix, and PDF — ready in minutes. A shareable link is generated for team access.",
    lines: [
      { dim: true,  text: "✓ GeoJSON map  ·  color-coded  ·  32 sections" },
      { dim: true,  text: "✓ PCI table  ·  intervention matrix" },
      { dim: true,  text: "✓ PDF report  ·  IRC:82-2023 layout" },
      { dim: false, text: "✓ Share link  →  drisora.io/r/abc123" },
    ],
  },
]

const ORG_TYPES = [
  { abbr: "PWD",  full: "Public Works Departments",   desc: "State & national agencies responsible for road condition assessment and maintenance cycles." },
  { abbr: "NHAI", full: "National Highways Authority", desc: "Highway planning, monitoring, and development across India's national road network." },
  { abbr: "ULBs", full: "Municipal Corporations",     desc: "Urban local bodies managing city road networks and pavement maintenance schedules." },
  { abbr: "EPC",  full: "EPC Contractors",             desc: "Engineering, procurement, and construction firms handling road project delivery and QA." },
  { abbr: "R&D",  full: "Research Institutions",       desc: "Academic and government technical bodies studying pavement behaviour and IRC standards." },
]

const SPECS = [
  { value: "10 m",   label: "Section resolution" },
  { value: "±2 m",   label: "GPS accuracy" },
  { value: "4",      label: "Crack classes" },
  { value: "IRC:82", label: "Standard" },
]

// Map segments: PCI color overlays along road path
const MAP_SEGS = [
  { x1: 10,  x2: 68,  color: "#22c55e" },
  { x1: 68,  x2: 125, color: "#22c55e" },
  { x1: 125, x2: 182, color: "#eab308" },
  { x1: 182, x2: 240, color: "#f97316" },
  { x1: 240, x2: 297, color: "#ef4444" },
  { x1: 297, x2: 355, color: "#f97316" },
  { x1: 355, x2: 412, color: "#eab308" },
  { x1: 412, x2: 470, color: "#22c55e" },
]

function bezierPt(t: number): { x: number; y: number } {
  const x = (1-t)*(1-t)*10 + 2*t*(1-t)*245 + t*t*470
  const y = (1-t)*(1-t)*230 + 2*t*(1-t)*30  + t*t*65
  return { x, y }
}

// ─── Product preview mockup ──────────────────────────────────────────────────

function ProductPreview() {
  const markers = [
    { approxX: 68,  label: "S-04" },
    { approxX: 182, label: "S-11" },
    { approxX: 297, label: "S-19" },
    { approxX: 412, label: "S-26" },
  ].map(({ approxX, label }) => {
    const t = (approxX - 10) / 460
    const { x, y } = bezierPt(t)
    return { x, y, label }
  })

  return (
    <div
      className="relative w-full overflow-hidden rounded-[20px]"
      style={{
        border: "1px solid rgba(245,166,35,0.10)",
        background: "#09090C",
        boxShadow:
          "0 0 0 1px rgba(245,166,35,0.07), 0 40px 100px -24px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-[#1A1A22] bg-[#0D0D11] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#4A4A5A]">
          DRISORA — NH-48 SURAT–BARODA CORRIDOR
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-[10px] text-emerald-500">LIVE</span>
        </div>
      </div>

      {/* Content row */}
      <div className="flex" style={{ height: 264 }}>
        {/* Map panel */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <svg viewBox="0 0 480 264" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
              {MAP_SEGS.map((s, i) => (
                <clipPath key={i} id={`ms-${i}`}>
                  <rect x={s.x1 - 2} y="0" width={s.x2 - s.x1 + 4} height="264" />
                </clipPath>
              ))}
              <pattern id="mapgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.022)" strokeWidth="0.5" />
              </pattern>
            </defs>

            <rect width="480" height="264" fill="#0b150b" />
            <rect x="0" y="0" width="165" height="115" fill="#0d1a0d" opacity="0.9" />
            <rect x="0" y="165" width="210" height="99" fill="#0c180c" opacity="0.8" />
            <rect x="220" y="90" width="260" height="174" fill="#101b10" opacity="0.6" />
            <rect x="310" y="0" width="170" height="105" fill="#0f1c0f" opacity="0.7" />
            <ellipse cx="400" cy="200" rx="72" ry="46" fill="#091825" opacity="0.95" />
            <rect width="480" height="264" fill="url(#mapgrid)" />
            <line x1="198" y1="0" x2="166" y2="264" stroke="#161616" strokeWidth="6" />

            <path d="M 10 230 Q 245 30 470 65" stroke="#000" strokeWidth="28" fill="none" strokeLinecap="round" />
            <path d="M 10 230 Q 245 30 470 65" stroke="#1a1a1a" strokeWidth="20" fill="none" strokeLinecap="round" />
            <path d="M 10 230 Q 245 30 470 65" stroke="#2c2c2c" strokeWidth="1" fill="none" strokeLinecap="round" strokeDasharray="14 20" />

            {MAP_SEGS.map((s, i) => (
              <path key={i} d="M 10 230 Q 245 30 470 65" stroke={s.color} strokeWidth="8" fill="none" strokeLinecap="round" clipPath={`url(#ms-${i})`} opacity="0.92" />
            ))}

            {markers.map(({ x, y, label }) => (
              <g key={label}>
                <circle cx={x} cy={y} r="3.5" fill="white" opacity="0.65" />
                <rect x={x + 6} y={y - 9} width="24" height="14" rx="2" fill="rgba(0,0,0,0.8)" />
                <text x={x + 18} y={y + 1.5} textAnchor="middle" fill="#888" fontSize="7" fontFamily="monospace">{label}</text>
              </g>
            ))}

            <g transform="translate(458,22)">
              <circle cx="0" cy="0" r="11" fill="rgba(0,0,0,0.72)" stroke="#252525" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#555" fontSize="8" fontFamily="monospace" fontWeight="bold">N</text>
              <line x1="0" y1="-6" x2="0" y2="-2" stroke="#f59e0b" strokeWidth="1.5" />
            </g>

            <g transform="translate(12,252)">
              <line x1="0" y1="0" x2="38" y2="0" stroke="#3a3a3a" strokeWidth="1" />
              <line x1="0" y1="-3" x2="0" y2="3" stroke="#3a3a3a" strokeWidth="1" />
              <line x1="38" y1="-3" x2="38" y2="3" stroke="#3a3a3a" strokeWidth="1" />
              <text x="19" y="-5" textAnchor="middle" fill="#3a3a3a" fontSize="7" fontFamily="monospace">500 m</text>
            </g>
          </svg>

          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: 0,
              height: 1,
              background: "linear-gradient(to right, transparent, rgba(245,166,35,0.25) 20%, rgba(245,166,35,0.65) 50%, rgba(245,166,35,0.25) 80%, transparent)",
              animation: "scan-down 5.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Data panel */}
        <div className="flex w-40 flex-shrink-0 flex-col gap-4 border-l border-[#1A1A22] p-4" style={{ background: "#0D0D11" }}>
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#4A4A5A]">PCI Score</p>
            <span className="font-mono text-[52px] font-semibold leading-none" style={{ color: "#f97316" }}>67</span>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)" }}>
              <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              <span className="font-mono text-[9px] text-orange-400">FAIR</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#1A1A22] pt-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#4A4A5A]">Survey</p>
            {[["Length", "3.2 km"], ["Sections", "32"], ["Cracks", "847"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-[#4A4A5A]">{k}</span>
                <span className="font-mono text-[10px] text-[#8A8A9A]">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 border-t border-[#1A1A22] pt-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#4A4A5A]">Breakdown</p>
            {[
              { label: "Good", color: "#22c55e", pct: 37 },
              { label: "Sat.",  color: "#eab308", pct: 22 },
              { label: "Fair",  color: "#f97316", pct: 25 },
              { label: "Poor",  color: "#ef4444", pct: 16 },
            ].map(({ label, color, pct }) => (
              <div key={label} className="mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1 overflow-hidden rounded-full" style={{ height: 3, background: "#1A1A22" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="w-6 text-right font-mono text-[9px] text-[#4A4A5A]">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-5 border-t border-[#1A1A22] bg-[#09090C] px-5 py-2.5">
        {["32 sections scored", "IRC:82-2023 compliant", "PDF report ready"].map((label) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] text-[#4A4A5A]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090C] text-white">

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-50"
        style={{ background: "rgba(9,9,12,0.85)", backdropFilter: "blur(16px)" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-[rgba(255,255,255,0.07)] opacity-0 transition-opacity" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <DrisoraLogo href="/" size="sm" />

          <nav className="hidden items-center gap-1 sm:flex">
            <a href="#how-it-works" className="px-3 py-1.5 text-[13px] text-[#8A8A9A] transition-colors hover:text-white">
              How it works
            </a>
            <a href="#features" className="px-3 py-1.5 text-[13px] text-[#8A8A9A] transition-colors hover:text-white">
              Features
            </a>
            <Link href="/login" className="ml-1 px-3 py-1.5 text-[13px] text-[#8A8A9A] transition-colors hover:text-white">
              Log in
            </Link>
            <Link
              href="/login"
              className="ml-1 rounded-[10px] bg-[#F5A623] px-5 py-[7px] text-[13px] font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]"
            >
              Get Started →
            </Link>
          </nav>

          <Link href="/login" className="rounded-[10px] bg-[#F5A623] px-4 py-[7px] text-[13px] font-semibold text-[#09090C] sm:hidden">
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-16 bg-road-grid">
        <div
          className="pointer-events-none absolute inset-0 animate-glow-breathe"
          style={{ background: "radial-gradient(ellipse 80% 55% at 50% 65%, rgba(245,166,35,0.09) 0%, transparent 65%)" }}
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl">
          {/* Badge */}
          <div
            className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1 hero-anim"
            style={{
              border: "1px solid rgba(245,166,35,0.22)",
              background: "rgba(245,166,35,0.07)",
              animationDelay: "0ms",
            }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" />
            <span className="font-mono text-[11px] tracking-[0.15em] text-[#F5A623]">
              IRC:82-2023 COMPLIANT
            </span>
          </div>

          {/* Headline */}
          <h1
            className="hero-anim text-[clamp(3rem,8vw,6.75rem)] font-semibold uppercase leading-[0.92] tracking-tight text-white"
            style={{ animationDelay: "60ms" }}
          >
            Automated Road
            <br />
            Condition
            <br />
            <span className="text-[#F5A623]">Assessment</span>
          </h1>

          {/* Sub + CTA */}
          <div
            className="hero-anim mt-8 flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between"
            style={{ animationDelay: "140ms" }}
          >
            <p className="max-w-md text-[15px] leading-relaxed text-[#8A8A9A]">
              Upload drone footage. Get a PCI-scored geospatial report in minutes. No manual inspection. No spreadsheets.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-[10px] bg-[#F5A623] px-6 py-2.5 text-[14px] font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]"
              >
                Get Started →
              </Link>
              <a
                href="#how-it-works"
                className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-6 py-2.5 text-[14px] font-medium text-[#8A8A9A] transition-colors hover:border-[rgba(255,255,255,0.20)] hover:text-white"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Product preview */}
          <div className="hero-anim mt-12" style={{ animationDelay: "240ms" }}>
            <ProductPreview />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent)" }} />
      </section>

      {/* ── Specs strip ────────────────────────────────────────────── */}
      <section className="border-b border-[rgba(255,255,255,0.07)] py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-[rgba(255,255,255,0.07)] sm:grid-cols-4">
            {SPECS.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center justify-center gap-1.5 bg-[#09090C] py-8 text-center">
                <span className="font-mono text-3xl font-semibold text-[#F5A623]">{value}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#4A4A5A]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for ──────────────────────────────────────────────── */}
      <section className="border-b border-[rgba(255,255,255,0.07)] py-28 bg-cross-grid">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-14 lg:grid-cols-[5fr_7fr] lg:items-start">
            <div className="lg:pt-1">
              <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">
                <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
                Built for
              </p>
              <h2 className="text-[clamp(2.5rem,5vw,3.75rem)] font-semibold uppercase leading-[0.92] tracking-tight text-white">
                India&apos;s
                <br />
                Infrastructure
                <br />
                <span className="text-[#4A4A5A]">Sector</span>
              </h2>
              <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-[#8A8A9A]">
                Built for the teams responsible for assessing, maintaining, and developing India&apos;s road network — from national highways to municipal streets.
              </p>
              <div className="mt-8 h-px w-16" style={{ background: "linear-gradient(to right, #F5A623, transparent)" }} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ORG_TYPES.map(({ abbr, full, desc }, idx) => {
                const isLast = idx === ORG_TYPES.length - 1
                return (
                  <div
                    key={abbr}
                    className={`group relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-5 transition-all duration-200 hover:border-[rgba(255,255,255,0.13)]${isLast ? " sm:col-span-2" : ""}`}
                  >
                    <div className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" style={{ background: "linear-gradient(to right, transparent, rgba(245,166,35,0.5) 40%, rgba(245,166,35,0.5) 60%, transparent)" }} />
                    <div className={isLast ? "sm:flex sm:items-center sm:gap-8" : ""}>
                      <span className="font-mono text-[32px] font-semibold leading-none text-[#F5A623] sm:flex-shrink-0">
                        {abbr}
                      </span>
                      <div className={isLast ? "mt-2 sm:mt-0" : "mt-2"}>
                        <p className="text-[13px] font-semibold text-white">{full}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#8A8A9A]">{desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-[rgba(255,255,255,0.07)] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-20">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">
              <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
              Process
            </p>
            <h2 className="text-[clamp(2.5rem,5vw,3.75rem)] font-semibold uppercase leading-none tracking-tight text-white">
              From flight to report
              <br />
              <span className="text-[#4A4A5A]">in three steps.</span>
            </h2>
          </div>

          <div className="grid gap-12 md:gap-8 lg:grid-cols-3">
            {STEPS.map((step, idx) => (
              <div key={step.n} className="relative">
                {idx < STEPS.length - 1 && (
                  <div className="absolute top-8 left-full hidden w-8 lg:block" style={{ height: 1, borderTop: "1px dashed rgba(245,166,35,0.30)" }} />
                )}
                <div className="mb-6 flex items-center gap-4">
                  <span className="font-mono text-[14px] font-medium text-[#F5A623]">{step.n}</span>
                  <h3 className="text-[18px] font-medium text-white">{step.title}</h3>
                  {step.processing && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#F5A623]" />
                  )}
                </div>
                <p className="mb-6 text-[14px] leading-relaxed text-[#8A8A9A]">{step.desc}</p>
                <div className="overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#0D0D11]">
                  <div className="flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.07)] px-4 py-2.5">
                    <div className="h-2 w-2 rounded-full bg-[#1A1A22]" />
                    <div className="h-2 w-2 rounded-full bg-[#1A1A22]" />
                    <div className="h-2 w-2 rounded-full bg-[#1A1A22]" />
                  </div>
                  <div className="space-y-1 px-4 py-4">
                    {step.lines.map((line, li) => (
                      <p key={li} className="font-mono text-[11px] leading-relaxed" style={{ color: line.dim ? "#4A4A5A" : "#8A8A9A" }}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="border-b border-[rgba(255,255,255,0.07)] py-32 bg-dot-grid">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">
                <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
                Platform
              </p>
              <h2 className="text-[clamp(2.5rem,5vw,3.75rem)] font-semibold uppercase leading-none tracking-tight text-white">
                Everything the
                <br />
                <span className="text-[#4A4A5A]">field team needs.</span>
              </h2>
            </div>
            <p className="max-w-xs text-[14px] leading-relaxed text-[#8A8A9A]">
              A complete pipeline — from raw footage to IRC-compliant deliverables.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid gap-px overflow-hidden rounded-[14px] bg-[rgba(255,255,255,0.07)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className={`group relative bg-[#09090C] p-7 transition-colors duration-200 hover:bg-[#111116] ${f.wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
              >
                <span className="mb-5 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">{f.tag}</span>
                <h3 className="mb-3 text-[15px] font-semibold leading-snug text-white">{f.name}</h3>
                <p className="text-[13px] leading-relaxed text-[#8A8A9A]">{f.desc}</p>
                <div className="mt-6 inline-flex items-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-2.5 py-1">
                  <div className="h-1 w-1 rounded-full bg-[#F5A623]" />
                  <span className="font-mono text-[10px] text-[#8A8A9A]">{f.stat}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "linear-gradient(to right, transparent, rgba(245,166,35,0.3) 40%, rgba(245,166,35,0.3) 60%, transparent)" }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PCI Bands ──────────────────────────────────────────────── */}
      <section className="border-b border-[rgba(255,255,255,0.07)] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">
                <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
                Standard
              </p>
              <h2 className="text-[clamp(2.5rem,5vw,3.75rem)] font-semibold uppercase leading-none tracking-tight text-white">
                Five condition
                <br />
                <span className="text-[#4A4A5A]">bands. One standard.</span>
              </h2>
              <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-[#8A8A9A]">
                IRC:82-2023 defines road condition in five categories. Drisora scores every 10 m section and classifies it automatically.
              </p>

              <div className="mt-10 flex h-3 overflow-hidden rounded-full">
                {PCI_BANDS.map((b) => (
                  <div key={b.label} className="flex-1 transition-transform hover:scale-y-150" style={{ backgroundColor: b.color }} />
                ))}
              </div>
              <div className="mt-2 flex justify-between">
                <span className="font-mono text-[10px] text-[#4A4A5A]">Very Poor</span>
                <span className="font-mono text-[10px] text-[#4A4A5A]">Good</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)]">
              {PCI_BANDS.map((b, idx) => (
                <div
                  key={b.label}
                  className="group flex items-center justify-between px-6 py-4 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  style={{ background: "#111116", borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: b.color }} />
                    <span className="text-[14px] font-medium text-white">{b.label}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-[12px] text-[#8A8A9A]">PCI {b.range}</span>
                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full sm:block" style={{ background: "#1A1A22" }}>
                      <div className="h-full rounded-full" style={{ width: `${((b.max - b.min) / 100) * 100}%`, backgroundColor: b.color, marginLeft: `${(b.min / 100) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div
            className="relative overflow-hidden rounded-[20px] border border-[rgba(245,166,35,0.20)] px-8 py-20 text-center"
            style={{ background: "#111116" }}
          >
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(245,166,35,0.55) 35%, rgba(245,166,35,0.55) 65%, transparent)" }} />
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(245,166,35,0.06) 0%, transparent 70%)" }} />

            <div className="relative z-10">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5A623]">Ready to start?</p>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-white">
                Start your first survey.
              </h2>
              <p className="mx-auto mt-5 max-w-sm text-[14px] leading-relaxed text-[#8A8A9A]">
                Upload a drone flight and receive a full IRC:82-2023 compliant geospatial report in minutes.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login" className="rounded-[10px] bg-[#F5A623] px-8 py-3 text-[14px] font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]">
                  Get Started →
                </Link>
                <a href="#how-it-works" className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-8 py-3 text-[14px] font-medium text-[#8A8A9A] transition-colors hover:border-[rgba(255,255,255,0.20)] hover:text-white">
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(255,255,255,0.07)] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <DrisoraLogo size="sm" />
          <span className="font-mono text-[11px] text-[#4A4A5A]">
            IRC:82-2023 · AI-Powered · Drone-Native
          </span>
        </div>
      </footer>
    </div>
  )
}
