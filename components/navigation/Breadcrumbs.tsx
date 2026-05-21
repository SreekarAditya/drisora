"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  new: "New",
  surveys: "Surveys",
  survey: "Survey",
  reports: "Reports",
  report: "Report",
  team: "Team",
  profile: "Edit Profile",
  upload: "New Survey",
  jobs: "Surveys",
  results: "Results",
  about: "About",
};

function labelFor(segment: string) {
  return LABELS[segment] ?? (segment.length > 10 ? `${segment.slice(0, 8)}...` : segment);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || pathname === "/dashboard") {
    return (
      <div className="border-b border-[rgba(255,255,255,0.07)] bg-[#09090C]">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <span className="font-mono text-[13px] text-[#F0F0F4]">
            Dashboard
          </span>
        </div>
      </div>
    );
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return { segment, href, label: labelFor(segment) };
  });

  return (
    <div className="border-b border-[rgba(255,255,255,0.07)] bg-[#09090C]">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-6 py-3 text-[13px]"
      >
        <Link href="/dashboard" className="shrink-0 text-[#8A8A9A] transition-colors hover:text-[#F0F0F4]">
          Dashboard
        </Link>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const isDashboard = crumb.segment === "dashboard";
          if (isDashboard) return null;

          return (
            <span key={crumb.href} className="flex shrink-0 items-center gap-2">
              <span className="text-[#4A4A5A]">/</span>
              {isLast ? (
                <span className="font-medium text-[#F0F0F4]">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-[#8A8A9A] transition-colors hover:text-[#F0F0F4]">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
