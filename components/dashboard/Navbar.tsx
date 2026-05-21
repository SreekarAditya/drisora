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
    <header className="sticky top-0 z-40 border-b border-[rgba(255,255,255,0.07)] bg-[#09090C]/90 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-7">
          <DrisoraLogo href="/dashboard" size="sm" />

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "text-white"
                      : "text-[#8A8A9A] hover:text-[#F0F0F4]"
                  }`}
                >
                  <span className="relative">{link.label}</span>
                  {active && (
                    <span className="absolute inset-x-3 -bottom-[15px] h-[2px] bg-[#F5A623]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile?.org_name && (
            <span className="hidden max-w-[160px] truncate rounded-md bg-[rgba(255,255,255,0.06)] px-2.5 py-1 font-mono text-[11px] text-[#4A4A5A] md:block">
              {profile.org_name}
            </span>
          )}

          <Link
            href="/upload"
            className="hidden items-center gap-1.5 rounded-[10px] bg-[#F5A623] px-4 py-[7px] text-sm font-semibold text-[#09090C] shadow-[0_2px_8px_rgba(245,166,35,0.25)] transition-all duration-150 hover:bg-[#FFBE4D] hover:shadow-[0_4px_16px_rgba(245,166,35,0.35)] active:scale-[0.98] md:inline-flex"
          >
            + New Survey
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,255,255,0.10)] bg-[#111116] text-xs font-bold text-white transition-all duration-150 hover:border-[rgba(255,255,255,0.20)]"
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
              <div className="animate-fade-scale absolute right-0 mt-2 w-64 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.09)] bg-[#111116] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
                <div className="border-b border-[rgba(255,255,255,0.07)] px-4 py-3.5">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">{displayName}</p>
                  <p className="truncate font-mono text-[11px] text-[#4A4A5A]">{user.email}</p>
                  {profile?.role && <p className="mt-1 font-mono text-[11px] font-medium text-[#F5A623]/80">{profile.role}</p>}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-[#8A8A9A] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/about"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-[#8A8A9A] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                >
                  About Drisora
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center border-t border-[rgba(255,255,255,0.07)] px-4 py-3 text-left text-sm text-red-400/90 transition-colors duration-100 hover:bg-red-500/[0.08] hover:text-red-300"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.10)] text-[#8A8A9A] transition-colors duration-150 hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white lg:hidden"
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
        <div className="animate-slide-down w-full border-t border-[rgba(255,255,255,0.07)] bg-[#09090C] px-6 py-3 lg:hidden">
          <nav className="space-y-0.5" aria-label="Mobile primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors duration-100 ${
                  isActive(pathname, link.href)
                    ? "bg-[rgba(255,255,255,0.06)] text-white"
                    : "text-[#8A8A9A] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/upload"
              onClick={() => setMenuOpen(false)}
              className="block rounded-[10px] px-3 py-2.5 text-sm font-semibold text-[#F5A623] transition-colors duration-100 hover:bg-[rgba(245,166,35,0.08)]"
            >
              + New Survey
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
