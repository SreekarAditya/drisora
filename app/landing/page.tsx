import Link from "next/link"
import { PCI_BANDS } from "@/types"

// ─── Static data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    tag: "Detection",
    name: "YOLOv12s Crack Detection",
    desc: "Trained on RDD2022 across four crack classes: longitudinal, transverse, alligator, and pothole. Runs section-by-section at scale.",
    stat: "4 crack classes",
  },
  {
    tag: "Segmentation",
    name: "SAM2 Pixel Masks",
    desc: "Each detected crack receives a pixel-level segmentation mask, enabling precise area measurement and severity quantification beyond bounding boxes.",
    stat: "Pixel-level accuracy",
  },
  {
    tag: "Scoring",
    name: "IRC:82-2023 PCI Scorer",
    desc: "Pavement Condition Index computed per 10 m section using the Indian Roads Congress standard. Outputs an intervention priority matrix alongside scores.",
    stat: "Per-10 m scoring",
  },
  {
    tag: "Geospatial",
    name: "Color-coded Map",
    desc: "Every section plotted on an interactive Leaflet map, colored by condition band. Full GeoJSON export for GIS integration.",
    stat: "GeoJSON export",
  },
  {
    tag: "Report",
    name: "IRC-compliant PDF",
    desc: "Cover page, executive summary, per-section PCI table, priority intervention matrix, and crack type appendix in IRC layout.",
    stat: "Shareable link",
  },
  {
    tag: "Infrastructure",
    name: "Resumable Upload",
    desc: "Multipart upload in 50 MB chunks with background processing. Survives network drops and resumes across devices via BullMQ queue.",
    stat: "50 MB chunks",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Upload your flight",
    desc: "Drop the MP4 drone footage and paired SRT telemetry file. Upload runs in the background using resumable multipart transfer — no browser lock-in.",
    lines: [
      { dim: false, text: "$ drisora upload flight.mp4 survey.srt" },
      { dim: true,  text: "▸ NH-48 Surat–Baroda Corridor  ·  2.1 GB" },
      { dim: true,  text: "▸ Chunked 50 MB  ·  resumable  ·  background" },
      { dim: false, text: "✓ Queued — processing starts automatically" },
    ],
  },
  {
    n: "02",
    title: "Automated CV pipeline",
    desc: "YOLOv12s detects cracks, SAM2 creates pixel masks, DepthPro estimates structure depth, then the IRC scorer computes PCI per 10 m section.",
    lines: [
      { dim: true,  text: "[YOLOv12s]  847 detections  /  32 sections" },
      { dim: true,  text: "[SAM2]      pixel masks  ·  crack area mapped" },
      { dim: true,  text: "[DepthPro]  structural depth estimated" },
      { dim: false, text: "[IRC-PCI]   avg 67.3  ·  32 sections scored" },
    ],
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
  { abbr: "PWD",   full: "Public Works Depts." },
  { abbr: "NHAI",  full: "National Highways" },
  { abbr: "ULBs",  full: "Municipal Corporations" },
  { abbr: "EPC",   full: "Contractors" },
  { abbr: "R&D",   full: "Research Institutions" },
]

const SPECS = [
  { value: "10 m",     label: "Section resolution" },
  { value: "±2 m",     label: "GPS accuracy" },
  { value: "4",        label: "Crack classes" },
  { value: "IRC:82",   label: "Standard" },
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

// Quadratic bezier: M 10 230 Q 245 30 470 65
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
      className="relative w-full overflow-hidden rounded-xl border border-[#242424]"
      style={{
        background: "#0a0a0a",
        boxShadow:
          "0 0 0 1px rgba(245,158,11,0.07), 0 40px 100px -24px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-[#1c1c1c] bg-[#0d0d0d] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span
          className="font-mono text-[11px] tracking-widest text-[#3a3a3a]"
          style={{ letterSpacing: "0.1em" }}
        >
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
          <svg
            viewBox="0 0 480 264"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {MAP_SEGS.map((s, i) => (
                <clipPath key={i} id={`ms-${i}`}>
                  <rect x={s.x1 - 2} y="0" width={s.x2 - s.x1 + 4} height="264" />
                </clipPath>
              ))}
              <pattern
                id="mapgrid"
                x="0" y="0" width="24" height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.022)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>

            {/* Terrain base */}
            <rect width="480" height="264" fill="#0b150b" />
            <rect x="0"   y="0"   width="165" height="115" fill="#0d1a0d" opacity="0.9" />
            <rect x="0"   y="165" width="210" height="99"  fill="#0c180c" opacity="0.8" />
            <rect x="220" y="90"  width="260" height="174" fill="#101b10" opacity="0.6" />
            <rect x="310" y="0"   width="170" height="105" fill="#0f1c0f" opacity="0.7" />
            {/* Water body */}
            <ellipse cx="400" cy="200" rx="72" ry="46" fill="#091825" opacity="0.95" />
            {/* Grid */}
            <rect width="480" height="264" fill="url(#mapgrid)" />
            {/* Cross-street */}
            <line x1="198" y1="0" x2="166" y2="264" stroke="#161616" strokeWidth="6" />

            {/* Road: shadow */}
            <path
              d="M 10 230 Q 245 30 470 65"
              stroke="#000"
              strokeWidth="28"
              fill="none"
              strokeLinecap="round"
            />
            {/* Road: surface */}
            <path
              d="M 10 230 Q 245 30 470 65"
              stroke="#1a1a1a"
              strokeWidth="20"
              fill="none"
              strokeLinecap="round"
            />
            {/* Road: center dashes */}
            <path
              d="M 10 230 Q 245 30 470 65"
              stroke="#2c2c2c"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="14 20"
            />

            {/* PCI color overlays */}
            {MAP_SEGS.map((s, i) => (
              <path
                key={i}
                d="M 10 230 Q 245 30 470 65"
                stroke={s.color}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                clipPath={`url(#ms-${i})`}
                opacity="0.92"
              />
            ))}

            {/* Section markers */}
            {markers.map(({ x, y, label }) => (
              <g key={label}>
                <circle cx={x} cy={y} r="3.5" fill="white" opacity="0.65" />
                <rect
                  x={x + 6}
                  y={y - 9}
                  width="24"
                  height="14"
                  rx="2"
                  fill="rgba(0,0,0,0.8)"
                />
                <text
                  x={x + 18}
                  y={y + 1.5}
                  textAnchor="middle"
                  fill="#888"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              </g>
            ))}

            {/* Compass rose */}
            <g transform="translate(458,22)">
              <circle
                cx="0" cy="0" r="11"
                fill="rgba(0,0,0,0.72)"
                stroke="#252525"
                strokeWidth="1"
              />
              <text
                x="0" y="4"
                textAnchor="middle"
                fill="#555"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                N
              </text>
              <line x1="0" y1="-6" x2="0" y2="-2" stroke="#f59e0b" strokeWidth="1.5" />
            </g>

            {/* Scale bar */}
            <g transform="translate(12,252)">
              <line x1="0" y1="0" x2="38" y2="0" stroke="#3a3a3a" strokeWidth="1" />
              <line x1="0" y1="-3" x2="0"  y2="3" stroke="#3a3a3a" strokeWidth="1" />
              <line x1="38" y1="-3" x2="38" y2="3" stroke="#3a3a3a" strokeWidth="1" />
              <text
                x="19" y="-5"
                textAnchor="middle"
                fill="#3a3a3a"
                fontSize="7"
                fontFamily="monospace"
              >
                500 m
              </text>
            </g>
          </svg>

          {/* Scan-line animation */}
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: 0,
              height: 1,
              background:
                "linear-gradient(to right, transparent, rgba(245,158,11,0.25) 20%, rgba(245,158,11,0.65) 50%, rgba(245,158,11,0.25) 80%, transparent)",
              animation: "scan-down 5.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Data panel */}
        <div
          className="flex w-40 flex-shrink-0 flex-col gap-4 border-l border-[#1c1c1c] p-4"
          style={{ background: "#0c0c0c" }}
        >
          {/* PCI Score */}
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a]">
              PCI Score
            </p>
            <span
              className="font-heading text-[52px] font-bold leading-none"
              style={{ color: "#f97316" }}
            >
              67
            </span>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5"
              style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.18)",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              <span className="font-mono text-[9px] text-orange-400">FAIR</span>
            </div>
          </div>

          {/* Survey stats */}
          <div className="space-y-2 border-t border-[#1c1c1c] pt-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a]">
              Survey
            </p>
            {[
              ["Length",   "3.2 km"],
              ["Sections", "32"],
              ["Cracks",   "847"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-[#4a4a4a]">{k}</span>
                <span className="font-mono text-[10px] text-[#aaa]">{v}</span>
              </div>
            ))}
          </div>

          {/* Condition breakdown */}
          <div className="flex-1 border-t border-[#1c1c1c] pt-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a]">
              Breakdown
            </p>
            {[
              { label: "Good", color: "#22c55e", pct: 37 },
              { label: "Sat.",  color: "#eab308", pct: 22 },
              { label: "Fair",  color: "#f97316", pct: 25 },
              { label: "Poor",  color: "#ef4444", pct: 16 },
            ].map(({ label, color, pct }) => (
              <div key={label} className="mb-2 flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div
                  className="flex-1 overflow-hidden rounded-full"
                  style={{ height: 3, background: "#1c1c1c" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[9px] text-[#444]">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-5 border-t border-[#1c1c1c] bg-[#0a0a0a] px-5 py-2.5">
        {["32 sections scored", "IRC:82-2023 compliant", "PDF report ready"].map(
          (label) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] text-[#484848]">{label}</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-[#161616]"
        style={{ background: "rgba(8,8,8,0.85)", backdropFilter: "blur(16px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 10L4 5.5L6.5 7.5L8.5 4L11 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">Drisora</span>
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            <a
              href="#how-it-works"
              className="px-3 py-1.5 text-[13px] text-[#666] transition-colors hover:text-white"
            >
              How it works
            </a>
            <a
              href="#features"
              className="px-3 py-1.5 text-[13px] text-[#666] transition-colors hover:text-white"
            >
              Features
            </a>
            <Link
              href="/login"
              className="ml-1 px-3 py-1.5 text-[13px] text-[#888] transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="ml-1 rounded-md px-4 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-amber-400"
              style={{ background: "#f59e0b" }}
            >
              Get Started
            </Link>
          </nav>

          {/* Mobile CTA */}
          <Link
            href="/signup"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-black sm:hidden"
            style={{ background: "#f59e0b" }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-16 bg-dot-grid">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 animate-glow-breathe"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% 65%, rgba(245,158,11,0.09) 0%, transparent 65%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          {/* Badge */}
          <div
            className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1 hero-anim"
            style={{
              border: "1px solid rgba(245,158,11,0.22)",
              background: "rgba(245,158,11,0.07)",
              animationDelay: "0ms",
            }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="font-mono text-[11px] tracking-widest text-amber-400">
              IRC:82-2023 COMPLIANT
            </span>
          </div>

          {/* Headline */}
          <h1
            className="hero-anim font-heading text-[64px] font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-[80px] md:text-[96px] lg:text-[108px]"
            style={{ animationDelay: "60ms" }}
          >
            Automated
            <br />
            Road Condition
            <br />
            <span style={{ color: "#f59e0b" }}>Assessment</span>
          </h1>

          {/* Sub + CTA row */}
          <div
            className="hero-anim mt-8 flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between"
            style={{ animationDelay: "140ms" }}
          >
            <p className="max-w-md text-[15px] leading-relaxed text-[#666]">
              Upload drone footage. Get a PCI-scored geospatial report in minutes.
              No manual inspection. No spreadsheets.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-md px-6 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-amber-400"
                style={{ background: "#f59e0b" }}
              >
                Get Started
              </Link>
              <a
                href="#how-it-works"
                className="rounded-md border px-6 py-2.5 text-[14px] font-medium text-[#888] transition-colors hover:border-[#3a3a3a] hover:text-white"
                style={{ borderColor: "#242424" }}
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Product preview */}
          <div
            className="hero-anim mt-12"
            style={{ animationDelay: "240ms" }}
          >
            <ProductPreview />
          </div>
        </div>

        {/* Bottom rule */}
        <div
          className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, #1c1c1c 30%, #1c1c1c 70%, transparent)" }}
        />
      </section>

      {/* ── Specs strip ─────────────────────────────────────────────────── */}
      <section className="border-b border-[#161616] py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-px bg-[#161616] sm:grid-cols-4 rounded-xl overflow-hidden">
            {SPECS.map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1.5 bg-[#080808] py-8 text-center"
              >
                <span className="font-heading text-3xl font-bold text-amber-400">
                  {value}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#555]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for ───────────────────────────────────────────────────── */}
      <section className="border-b border-[#161616] py-20 bg-cross-grid">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-8 text-center font-mono text-[11px] uppercase tracking-widest text-[#444]">
            Built for infrastructure teams across India
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {ORG_TYPES.map(({ abbr, full }) => (
              <div
                key={abbr}
                className="flex items-center gap-2.5 rounded-lg border px-4 py-2.5 transition-colors hover:border-[#2a2a2a] hover:bg-[#0e0e0e]"
                style={{ borderColor: "#1c1c1c", background: "#0c0c0c" }}
              >
                <span className="font-heading text-sm font-bold text-white">
                  {abbr}
                </span>
                <span className="text-[12px] text-[#555]">{full}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-[#161616] py-32">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <div className="mb-20">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-amber-500">
              Process
            </p>
            <h2 className="font-heading text-5xl font-bold uppercase leading-none tracking-tight text-white md:text-6xl">
              From flight to report
              <br />
              <span className="text-[#444]">in three steps.</span>
            </h2>
          </div>

          {/* Steps */}
          <div className="grid gap-12 md:gap-8 lg:grid-cols-3">
            {STEPS.map((step, idx) => (
              <div
                key={step.n}
                className="relative"
              >
                {/* Connector line (desktop only) */}
                {idx < STEPS.length - 1 && (
                  <div
                    className="absolute top-8 left-full hidden w-8 lg:block"
                    style={{
                      height: 1,
                      background: "linear-gradient(to right, #1c1c1c, transparent)",
                    }}
                  />
                )}

                {/* Step number */}
                <div className="mb-6 flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: "#1c1c1c", background: "#0e0e0e" }}
                  >
                    <span className="font-heading text-xl font-bold text-amber-500">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-semibold text-white">{step.title}</h3>
                </div>

                {/* Description */}
                <p className="mb-6 text-[14px] leading-relaxed text-[#666]">
                  {step.desc}
                </p>

                {/* Terminal output */}
                <div
                  className="overflow-hidden rounded-lg border"
                  style={{ borderColor: "#1c1c1c", background: "#0c0c0c" }}
                >
                  <div
                    className="flex items-center gap-1.5 border-b px-4 py-2.5"
                    style={{ borderColor: "#161616" }}
                  >
                    <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
                    <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
                    <div className="h-2 w-2 rounded-full bg-[#2a2a2a]" />
                  </div>
                  <div className="space-y-1 px-4 py-4">
                    {step.lines.map((line, li) => (
                      <p
                        key={li}
                        className="font-mono text-[11px] leading-relaxed"
                        style={{ color: line.dim ? "#3a3a3a" : "#a3a3a3" }}
                      >
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

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="border-b border-[#161616] py-32 bg-dot-grid">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <div className="mb-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-amber-500">
                Platform
              </p>
              <h2 className="font-heading text-5xl font-bold uppercase leading-none tracking-tight text-white md:text-6xl">
                Everything the
                <br />
                <span className="text-[#444]">field team needs.</span>
              </h2>
            </div>
            <p className="max-w-xs text-[14px] leading-relaxed text-[#555]">
              A complete pipeline — from raw footage to IRC-compliant deliverables.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid gap-px bg-[#161616] rounded-xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="group relative bg-[#080808] p-7 transition-colors hover:bg-[#0e0e0e]"
              >
                {/* Tag */}
                <span className="mb-5 inline-block font-mono text-[10px] uppercase tracking-widest text-amber-500">
                  {f.tag}
                </span>

                {/* Name */}
                <h3 className="mb-3 text-[15px] font-semibold leading-snug text-white">
                  {f.name}
                </h3>

                {/* Desc */}
                <p className="text-[13px] leading-relaxed text-[#555]">{f.desc}</p>

                {/* Stat chip */}
                <div
                  className="mt-6 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1"
                  style={{ background: "#111", border: "1px solid #1e1e1e" }}
                >
                  <div className="h-1 w-1 rounded-full bg-amber-500" />
                  <span className="font-mono text-[10px] text-[#666]">{f.stat}</span>
                </div>

                {/* Hover accent line */}
                <div
                  className="absolute bottom-0 inset-x-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, rgba(245,158,11,0.3) 40%, rgba(245,158,11,0.3) 60%, transparent)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PCI Bands ───────────────────────────────────────────────────── */}
      <section className="border-b border-[#161616] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
            {/* Left: copy */}
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-amber-500">
                Standard
              </p>
              <h2 className="font-heading text-5xl font-bold uppercase leading-none tracking-tight text-white md:text-6xl">
                Five condition
                <br />
                <span className="text-[#444]">bands. One standard.</span>
              </h2>
              <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-[#555]">
                IRC:82-2023 defines road condition in five categories. Drisora
                scores every 10 m section and classifies it automatically.
              </p>

              {/* Color bar */}
              <div className="mt-10 flex h-3 overflow-hidden rounded-full">
                {PCI_BANDS.map((b) => (
                  <div
                    key={b.label}
                    className="flex-1 transition-transform hover:scale-y-150"
                    style={{ backgroundColor: b.color }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between">
                <span className="font-mono text-[10px] text-[#444]">Very Poor</span>
                <span className="font-mono text-[10px] text-[#444]">Good</span>
              </div>
            </div>

            {/* Right: band table */}
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "#1c1c1c" }}
            >
              {PCI_BANDS.map((b, idx) => (
                <div
                  key={b.label}
                  className="group flex items-center justify-between px-6 py-4 transition-colors hover:bg-[#0e0e0e]"
                  style={{
                    background: "#0c0c0c",
                    borderTop: idx > 0 ? "1px solid #161616" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="text-[14px] font-medium text-white">{b.label}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-[12px] text-[#555]">
                      PCI {b.range}
                    </span>
                    {/* Mini color bar */}
                    <div
                      className="hidden h-1.5 w-24 overflow-hidden rounded-full sm:block"
                      style={{ background: "#1c1c1c" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((b.max - b.min) / 100) * 100}%`,
                          backgroundColor: b.color,
                          marginLeft: `${(b.min / 100) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div
            className="relative overflow-hidden rounded-2xl border px-8 py-20 text-center"
            style={{
              borderColor: "#1c1c1c",
              background: "#0c0c0c",
              boxShadow: "inset 0 1px 0 rgba(245,158,11,0.12)",
            }}
          >
            {/* Top amber gradient line */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(245,158,11,0.55) 35%, rgba(245,158,11,0.55) 65%, transparent)",
              }}
            />

            {/* Ambient glow */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(245,158,11,0.06) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-amber-500">
                Ready to start?
              </p>
              <h2 className="font-heading text-5xl font-bold uppercase leading-none tracking-tight text-white md:text-6xl">
                Start your first survey.
              </h2>
              <p className="mx-auto mt-5 max-w-sm text-[14px] leading-relaxed text-[#555]">
                Upload a drone flight and receive a full IRC:82-2023 compliant
                geospatial report in minutes.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-md px-8 py-3 text-[14px] font-medium text-black transition-colors hover:bg-amber-400"
                  style={{ background: "#f59e0b" }}
                >
                  Get Started
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-md border px-8 py-3 text-[14px] font-medium text-[#888] transition-colors hover:border-[#3a3a3a] hover:text-white"
                  style={{ borderColor: "#242424" }}
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#161616] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-5 w-5 items-center justify-center rounded"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.15)" }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M1 10L4 5.5L6.5 7.5L8.5 4L11 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-white">Drisora</span>
          </div>
          <span className="font-mono text-[11px] text-[#333]">
            IRC:82-2023 · YOLOv12s · SAM2 · DepthPro
          </span>
        </div>
      </footer>

    </div>
  )
}
