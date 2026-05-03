"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { type User } from "@supabase/supabase-js";
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-7">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-sm font-black text-black">
              D
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Drisora</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile?.org_name && (
            <span className="hidden max-w-[180px] truncate text-xs text-gray-500 md:block">
              {profile.org_name}
            </span>
          )}

          <Link
            href="/upload"
            className="hidden rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 md:inline-flex"
          >
            New Survey
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#111] text-xs font-bold text-white transition-colors hover:border-white/20"
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
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-white/10 bg-[#101113] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                  {profile?.role && <p className="mt-1 text-xs text-amber-400">{profile.role}</p>}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="block px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/about"
                  onClick={() => setAvatarOpen(false)}
                  className="block px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  About Drisora
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full border-t border-white/10 px-4 py-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
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

      {menuOpen && (
        <div className="w-full border-t border-white/10 bg-[#0f0f0f] px-6 py-3 lg:hidden">
          <nav className="space-y-1" aria-label="Mobile primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(pathname, link.href)
                    ? "bg-white/10 text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/upload"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
            >
              New Survey
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
