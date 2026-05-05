import Link from "next/link";

type LogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<LogoSize, { mark: string; text: string; subtext: string }> = {
  sm: { mark: "h-8 w-8", text: "text-[15px]", subtext: "text-[9px]" },
  md: { mark: "h-9 w-9", text: "text-lg", subtext: "text-[10px]" },
  lg: { mark: "h-12 w-12", text: "text-2xl", subtext: "text-[11px]" },
};

export function DrisoraMark({ size = "md" }: { size?: LogoSize }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${SIZE_CLASSES[size].mark}`}
      style={{
        background: "linear-gradient(160deg,#181a1e 0%,#0d0e10 100%)",
        boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.10), 0 0 0 0.75px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.5)",
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="h-full w-full" fill="none">
        {/* D letterform — clean bold stroke */}
        <path
          d="M10 7.5h7.2C22.7 7.5 27 11.6 27 18s-4.3 10.5-9.8 10.5H10V7.5Z"
          stroke="rgba(248,250,252,0.90)"
          strokeWidth="2.15"
          strokeLinejoin="round"
        />
        {/* Amber spine — single clean line, no ticks */}
        <line
          x1="18.6" y1="8.3"
          x2="18.6" y2="27.7"
          stroke="#F59E0B"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Subtle amber glow dot at equator */}
        <circle cx="18.6" cy="18" r="1.5" fill="#F59E0B" opacity="0.18" />
      </svg>
    </span>
  );
}

export function DrisoraLogo({
  href,
  size = "md",
  showSubtext = false,
  className = "",
}: {
  href?: string;
  size?: LogoSize;
  showSubtext?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <DrisoraMark size={size} />
      <span className="min-w-0">
        <span className={`block font-semibold tracking-[-0.01em] text-white ${SIZE_CLASSES[size].text}`}>
          Drisora
        </span>
        {showSubtext && (
          <span className={`block font-mono uppercase tracking-[0.16em] text-amber-400/80 ${SIZE_CLASSES[size].subtext}`}>
            Pavement AI
          </span>
        )}
      </span>
    </>
  );

  const baseClass = `inline-flex min-w-0 items-center gap-2.5 ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <span className={baseClass}>{content}</span>;
}
