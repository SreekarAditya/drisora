"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DrisoraLogo } from "@/components/branding/DrisoraLogo";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  "PWD Engineer",
  "Municipal Corporation",
  "College Infrastructure Team",
  "Private Contractor",
  "Other",
] as const;

type Role = (typeof ROLES)[number];

export default function OnboardingPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-fill from Google metadata and skip if already onboarded
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      // Check if already onboarded
      supabase
        .from("profiles")
        .select("org_name, role")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.org_name && profile?.role) {
            router.replace("/dashboard");
            return;
          }

          // Pre-fill name from Google
          const googleName =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            "";
          setFullName(googleName);
          setChecking(false);
        });
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      user_id: user.id,
      full_name: fullName.trim(),
      org_name: orgName.trim(),
      organization: orgName.trim(),
      role,
      phone: phone.trim() || null,
    });

    if (upsertError) {
      setError(upsertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/onboarding/tour");
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090C]">
        <span className="text-sm text-[#4A4A5A]">Loading…</span>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090C] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <DrisoraLogo size="lg" showSubtext />
        </div>

        <div className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-[#F0F0F4]">
            Set up your account
          </h1>
          <p className="mt-1 text-sm text-[#8A8A9A]">
            Tell us a bit about yourself to personalise your workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A8A9A]">
                Full name
              </label>
              <input
                className="w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#09090C] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]"
                type="text"
                placeholder="Aditya Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A8A9A]">
                Organisation name
              </label>
              <input
                className="w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#09090C] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]"
                type="text"
                placeholder="NHAI / IIT Bombay / …"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A8A9A]">Role</label>
              <select
                className="w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#09090C] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors focus:border-[#F5A623] [&>option]:bg-[#09090C]"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                required
              >
                <option value="" disabled>
                  Select your role…
                </option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A8A9A]">
                Phone{" "}
                <span className="text-[#4A4A5A]">(optional)</span>
              </label>
              <input
                className="w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#09090C] px-3 py-2.5 text-sm text-[#F0F0F4] outline-none transition-colors placeholder:text-[#4A4A5A] focus:border-[#F5A623]"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md bg-[rgba(239,68,68,0.10)] px-3 py-2 text-sm text-[#EF4444]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !role}
              className="mt-2 w-full rounded-lg bg-[#F5A623] px-4 py-2.5 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Continue to dashboard →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
