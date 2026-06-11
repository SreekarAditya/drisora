import Link from "next/link";
import { DrisoraLogo } from "@/components/branding/DrisoraLogo";

export function LegalLayout({
  title,
  version,
  effectiveDate,
  children,
}: {
  title: string;
  version: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#09090C] text-[#C9C9D4]">
      <header className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#09090C]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <DrisoraLogo size="md" />
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/legal/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-white">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-[32px] font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 font-mono text-[12px] text-[#6A6A7A]">
          Version {version} · Effective {effectiveDate}
        </p>
        <div className="legal-body mt-10 space-y-7 text-[14px] leading-7">{children}</div>

        <footer className="mt-16 border-t border-[rgba(255,255,255,0.08)] pt-6 text-[12px] text-[#6A6A7A]">
          <p>
            Questions? Contact{" "}
            <a href="mailto:sreekarp4@gmail.com" className="text-[#F5A623]">
              sreekarp4@gmail.com
            </a>
            .
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Drisora. All rights reserved.</p>
        </footer>
      </article>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[18px] font-semibold text-white">{heading}</h2>
      <div className="space-y-3 text-[#A8A8B6]">{children}</div>
    </section>
  );
}
