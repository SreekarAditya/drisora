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
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#101113] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${SIZE_CLASSES[size].mark}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="h-full w-full" fill="none">
        <rect x="1" y="1" width="34" height="34" rx="8" fill="#111214" />
        <path
          d="M10.5 7.5h7.4c6 0 10 4.2 10 10.5s-4 10.5-10 10.5h-7.4V7.5Z"
          stroke="#F8FAFC"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M18.4 9.4c1.4 4.6 1.4 12.4 0 17.2"
          stroke="#F59E0B"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M18.4 13.6v2.4M18.4 20v2.4"
          stroke="#111214"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
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
        <span className={`block font-semibold tracking-tight text-white ${SIZE_CLASSES[size].text}`}>
          Drisora
        </span>
        {showSubtext && (
          <span className={`block font-mono uppercase tracking-[0.18em] text-amber-400 ${SIZE_CLASSES[size].subtext}`}>
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
