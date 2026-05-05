"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { type User } from "@supabase/supabase-js";
import { DrisoraLogo } from "@/components/branding/DrisoraLogo";
import { createClient } from "@/lib/supabase/client";

interface NavbarProfile {
  full_name: string | null;
  org_name: string | null;
  role?: string | null;
  avatar_url?: string | null;
}

interface NavbarProps {
  user: User;
  profile: NavbarProfile | null;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/surveys", label: "Surveys" },
  { href: "/reports", label: "Reports" },
  { href: "/team", label: "Team" },
  { href: "/about", label: "About" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({ user, profile }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    setMenuOpen(false);
    setAvatarOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const metadataAvatar = user.user_metadata?.avatar_url as string | undefined;
  const avatarUrl = profile?.avatar_url ?? metadataAvatar;
  const displayName = profile?.full_name ?? user.email ?? "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07080a]/90 backdrop-blur-xl backdrop-saturate-150">
      {/* Subtle top shimmer line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-7">
          <DrisoraLogo href="/dashboard" size="sm" />

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ${
                    active
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-200"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-md bg-white/[0.07] ring-1 ring-inset ring-white/[0.08]" />
                  )}
                  <span className="relative">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile?.org_name && (
            <span className="hidden max-w-[160px] truncate text-xs text-gray-600 md:block">
              {profile.org_name}
            </span>
          )}

          <Link
            href="/upload"
            className="hidden items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_2px_8px_rgba(245,158,11,0.25)] transition-all duration-150 hover:bg-amber-400 hover:shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-[0.98] md:inline-flex"
          >
            New Survey
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#111] text-xs font-bold text-white transition-all duration-150 hover:border-white/20 hover:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
              aria-label="Open user menu"
              aria-expanded={avatarOpen}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </button>

            {avatarOpen && (
              <div className="animate-fade-scale absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0f1012] shadow-[0_8px_40px_rgba(0,0,0,0.55),inset_0_0.5px_0_rgba(255,255,255,0.06)]">
                <div className="border-b border-white/[0.07] px-4 py-3.5">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">{displayName}</p>
                  <p className="truncate text-xs text-gray-600">{user.email}</p>
                  {profile?.role && <p className="mt-1 text-xs font-medium text-amber-400/80">{profile.role}</p>}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-gray-400 transition-colors duration-100 hover:bg-white/[0.04] hover:text-white"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/about"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-gray-400 transition-colors duration-100 hover:bg-white/[0.04] hover:text-white"
                >
                  About Drisora
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center border-t border-white/[0.07] px-4 py-3 text-left text-sm text-red-400/90 transition-colors duration-100 hover:bg-red-500/[0.08] hover:text-red-300"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-gray-500 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.04] hover:text-white lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M1.5 1.5l12 12M13.5 1.5l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <line x1="1.5" y1="4" x2="13.5" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="1.5" y1="7.5" x2="13.5" y2="7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="1.5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="animate-slide-down w-full border-t border-white/[0.07] bg-[#0b0c0e] px-6 py-3 lg:hidden">
          <nav className="space-y-0.5" aria-label="Mobile primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-100 ${
                  isActive(pathname, link.href)
                    ? "bg-white/[0.07] text-white ring-1 ring-inset ring-white/[0.08]"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/upload"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-semibold text-amber-400 transition-colors duration-100 hover:bg-amber-500/10"
            >
              + New Survey
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
