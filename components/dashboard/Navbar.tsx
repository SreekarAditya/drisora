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

          {/* Mobile hamburger */}
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
