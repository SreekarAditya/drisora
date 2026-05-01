import Link from "next/link";
import type { Survey } from "@/types";
import { SurveyCard } from "@/components/dashboard/SurveyCard";

interface SurveyListProps {
  surveys: Survey[];
}

// ─── Bezier helper: M 10 175 Q 180 50 350 75 ─────────────────────────────────
function roadPt(approxX: number): { x: number; y: number } {
  const t = (approxX - 10) / 340;
  return {
    x: (1 - t) * (1 - t) * 10  + 2 * t * (1 - t) * 180 + t * t * 350,
    y: (1 - t) * (1 - t) * 175 + 2 * t * (1 - t) * 50  + t * t * 75,
  };
}

// ─── Drone-over-road illustration ────────────────────────────────────────────
function DroneMapIllustration() {
  const segs = [
    { x1: 10,  x2: 67,  color: "#22c55e" },
    { x1: 67,  x2: 124, color: "#22c55e" },
    { x1: 124, x2: 181, color: "#eab308" },
    { x1: 181, x2: 238, color: "#f97316" },
    { x1: 238, x2: 295, color: "#ef4444" },
    { x1: 295, x2: 350, color: "#22c55e" },
  ];

  const markers = [
    { approxX: 67,  label: "S-04" },
    { approxX: 181, label: "S-12" },
    { approxX: 295, label: "S-20" },
  ].map(({ approxX, label }) => ({ ...roadPt(approxX), label }));

  return (
    <div
      className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#1e1e1e]"
      style={{
        background: "#0b150b",
        boxShadow:
          "0 0 0 1px rgba(245,158,11,0.05), 0 0 80px rgba(245,158,11,0.06)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center justify-between border-b border-[#1c1c1c] px-4 py-2.5"
        style={{ background: "#0d0d0d" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <div className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <div className="h-2 w-2 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[10px] tracking-widest text-[#333]">
          DRISORA SURVEY PREVIEW
        </span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          <span className="font-mono text-[10px] text-amber-500">READY</span>
        </div>
      </div>

      {/* SVG map */}
      <svg
        viewBox="0 0 360 200"
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          {segs.map((s, i) => (
            <clipPath key={i} id={`es-s-${i}`}>
              <rect x={s.x1 - 2} y="0" width={s.x2 - s.x1 + 4} height="200" />
            </clipPath>
          ))}
          <pattern
            id="es-grid"
            x="0" y="0" width="20" height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(255,255,255,0.022)"
              strokeWidth="0.5"
            />
          </pattern>
          <radialGradient id="es-glow" cx="50%" cy="45%" r="50%">
            <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Terrain */}
        <rect width="360" height="200" fill="#0b150b" />
        <rect x="0"   y="0"   width="145" height="95"  fill="#0d1a0d" opacity="0.85" />
        <rect x="0"   y="145" width="175" height="55"  fill="#0c180c" opacity="0.75" />
        <rect x="195" y="70"  width="165" height="130" fill="#101b10" opacity="0.65" />
        <rect x="240" y="0"   width="120" height="80"  fill="#0f1c0f" opacity="0.70" />
        {/* Water */}
        <ellipse cx="312" cy="162" rx="52" ry="32" fill="#091825" opacity="0.92" />
        {/* Grid */}
        <rect width="360" height="200" fill="url(#es-grid)" />
        {/* Ambient glow behind drone scan */}
        <ellipse cx="180" cy="88" rx="100" ry="60" fill="url(#es-glow)" />
        {/* Cross road */}
        <line x1="148" y1="0" x2="118" y2="200" stroke="#161616" strokeWidth="5" />

        {/* Road: shadow */}
        <path
          d="M 10 175 Q 180 50 350 75"
          stroke="#000"
          strokeWidth="22"
          fill="none"
          strokeLinecap="round"
        />
        {/* Road: surface */}
        <path
          d="M 10 175 Q 180 50 350 75"
          stroke="#1a1a1a"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        {/* Road: center dashes */}
        <path
          d="M 10 175 Q 180 50 350 75"
          stroke="#2a2a2a"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="12 18"
        />

        {/* PCI color overlays */}
        {segs.map((s, i) => (
          <path
            key={i}
            d="M 10 175 Q 180 50 350 75"
            stroke={s.color}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            clipPath={`url(#es-s-${i})`}
            opacity="0.9"
          />
        ))}

        {/* Section markers */}
        {markers.map(({ x, y, label }) => (
          <g key={label}>
            <circle cx={x} cy={y} r="3" fill="white" opacity="0.55" />
            <rect
              x={x + 5}
              y={y - 8}
              width="22"
              height="13"
              rx="2"
              fill="rgba(0,0,0,0.82)"
            />
            <text
              x={x + 16}
              y={y + 1.5}
              textAnchor="middle"
              fill="#888"
              fontSize="6.5"
              fontFamily="monospace"
            >
              {label}
            </text>
          </g>
        ))}

        {/* ── Drone ── */}
        <g transform="translate(180, 22)">
          {/* Halo glow */}
          <ellipse cx="0" cy="0" rx="26" ry="14" fill="rgba(245,158,11,0.08)" />
          {/* Arms */}
          <line x1="-13" y1="-5" x2="-25" y2="-11" stroke="#484848" strokeWidth="2" strokeLinecap="round" />
          <line x1="13"  y1="-5" x2="25"  y2="-11" stroke="#484848" strokeWidth="2" strokeLinecap="round" />
          <line x1="-13" y1="5"  x2="-25" y2="11"  stroke="#484848" strokeWidth="2" strokeLinecap="round" />
          <line x1="13"  y1="5"  x2="25"  y2="11"  stroke="#484848" strokeWidth="2" strokeLinecap="round" />
          {/* Body */}
          <rect
            x="-13" y="-6" width="26" height="12"
            rx="3"
            fill="#1c1c1c"
            stroke="#303030"
            strokeWidth="1"
          />
          {/* Amber LED */}
          <circle cx="7" cy="-1" r="2" fill="#f59e0b" opacity="0.7" />
          {/* Camera lens */}
          <circle cx="0" cy="3" r="3" fill="#111" stroke="#2a2a2a" strokeWidth="1" />
          <circle cx="0" cy="3" r="1.2" fill="#f59e0b" opacity="0.6" />
          {/* Propeller discs */}
          <ellipse cx="-25" cy="-11" rx="7" ry="2" fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
          <ellipse cx="25"  cy="-11" rx="7" ry="2" fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
          <ellipse cx="-25" cy="11"  rx="7" ry="2" fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
          <ellipse cx="25"  cy="11"  rx="7" ry="2" fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
          {/* Scan beam to road */}
          <line
            x1="0" y1="12"
            x2="0" y2="62"
            stroke="rgba(245,158,11,0.18)"
            strokeWidth="0.8"
            strokeDasharray="3 5"
          />
        </g>

        {/* PCI readout label near road center */}
        <g transform="translate(234, 92)">
          <rect
            x="0" y="0" width="65" height="18"
            rx="3"
            fill="rgba(0,0,0,0.85)"
            stroke="#262626"
            strokeWidth="1"
          />
          <text
            x="8" y="12.5"
            fill="#f97316"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="500"
          >
            PCI 67 · FAIR
          </text>
        </g>

        {/* Compass */}
        <g transform="translate(342, 17)">
          <circle
            cx="0" cy="0" r="9"
            fill="rgba(0,0,0,0.75)"
            stroke="#222"
            strokeWidth="1"
          />
          <text
            x="0" y="3.5"
            textAnchor="middle"
            fill="#555"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
          >
            N
          </text>
          <line x1="0" y1="-5" x2="0" y2="-2" stroke="#f59e0b" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: 0,
          height: 1,
          background:
            "linear-gradient(to right, transparent, rgba(245,158,11,0.22) 20%, rgba(245,158,11,0.55) 50%, rgba(245,158,11,0.22) 80%, transparent)",
          animation: "scan-down 5.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

const DELIVERABLES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M6 2L1 4v12l5-2 6 2 5-2V4l-5 2-6-2z"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 2v12M12 4v12"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Geospatial Map",
    desc: "Every section color-coded by PCI condition. GeoJSON export included for GIS integration.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 14L5.5 9l3 2.5 3-5L16 10"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 16h14"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "PCI Scores",
    desc: "IRC:82-2023 score per 10 m section with intervention priority matrix.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M11 2H4a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6M11 2l4 4M11 2v4h4"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 10h6M6 13h4"
          stroke="#f59e0b"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "PDF Report",
    desc: "IRC-compliant layout with cover page, appendix, and shareable link.",
  },
];

function EmptyState() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 text-center">
      {/* Illustration */}
      <div
        className="hero-anim w-full"
        style={{ animationDelay: "0ms" }}
      >
        <DroneMapIllustration />
      </div>

      {/* Badge */}
      <div
        className="hero-anim mt-8 inline-flex items-center gap-2 rounded-full px-3.5 py-1"
        style={{
          animationDelay: "80ms",
          border: "1px solid rgba(245,158,11,0.2)",
          background: "rgba(245,158,11,0.07)",
        }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="font-mono text-[11px] tracking-widest text-amber-400">
          IRC:82-2023 COMPLIANT
        </span>
      </div>

      {/* Headline */}
      <h1
        className="hero-anim font-heading mt-6 text-5xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl"
        style={{ animationDelay: "140ms" }}
      >
        Your first survey
        <br />
        <span style={{ color: "#f59e0b" }}>is minutes away.</span>
      </h1>

      {/* Sub */}
      <p
        className="hero-anim mt-5 max-w-md text-[15px] leading-relaxed"
        style={{ animationDelay: "200ms", color: "#666" }}
      >
        Upload your drone footage and SRT telemetry file. Drisora runs the full
        CV pipeline automatically and delivers an IRC-compliant report — no manual
        inspection, no spreadsheets.
      </p>

      {/* CTA */}
      <div
        className="hero-anim mt-8"
        style={{ animationDelay: "260ms" }}
      >
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-md px-8 py-3 text-[14px] font-semibold text-black transition-colors hover:bg-amber-400"
          style={{ background: "#f59e0b" }}
        >
          Start your first survey
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 7h10M8 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {/* What you'll get */}
      <div
        className="hero-anim mt-16 w-full"
        style={{ animationDelay: "340ms" }}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: "#1c1c1c" }} />
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#444" }}>
            What you&apos;ll get in minutes
          </span>
          <div className="h-px flex-1" style={{ background: "#1c1c1c" }} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <div
              key={d.title}
              className="rounded-xl border border-[#1c1c1c] p-5 text-left transition-colors hover:border-[#2a2a2a]"
              style={{ background: "#0d0d0d" }}
            >
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg border border-[#222] bg-[#111]">
                {d.icon}
              </div>
              <h3 className="mb-1.5 text-[14px] font-semibold text-white">
                {d.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "#555" }}>
                {d.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Survey list ─────────────────────────────────────────────────────────────

export function SurveyList({ surveys }: SurveyListProps) {
  if (surveys.length === 0) {
    return <EmptyState />;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Surveys
        </h1>
        <Link
          href="/upload"
          className="rounded-md px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          style={{ background: "#f59e0b" }}
        >
          New Survey
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {surveys.map((survey) => (
          <SurveyCard key={survey.id} survey={survey} />
        ))}
      </section>
    </main>
  );
}
