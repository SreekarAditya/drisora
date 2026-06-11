"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TOS_VERSION, PRIVACY_VERSION, meetsAgeFloor, MINIMUM_AGE_YEARS } from "@/lib/legal/versions";

/**
 * Blocking re-consent modal. Rendered by the authenticated layout when the user's
 * most recently accepted ToS/Privacy versions are older than the current
 * constants. The user cannot dismiss it without re-accepting; declining signs
 * them out.
 *
 * `acceptedTos` / `acceptedPrivacy` are the user's latest stored versions (or null).
 */
export function ReConsentModal({
  acceptedTos,
  acceptedPrivacy,
  dob,
}: {
  acceptedTos: string | null;
  acceptedPrivacy: string | null;
  dob: string | null;
}) {
  const router = useRouter();
  const stale = acceptedTos !== TOS_VERSION || acceptedPrivacy !== PRIVACY_VERSION;
  const [open, setOpen] = useState(stale);
  const [tos, setTos] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [dobInput, setDobInput] = useState(dob ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiresDob = !dob || !meetsAgeFloor(dob);
  const dobReady = Boolean(dobInput) && meetsAgeFloor(dobInput);
  const underage = Boolean(dobInput) && !meetsAgeFloor(dobInput);
  const canSubmit = tos && privacy && (!requiresDob || dobReady) && !submitting;

  if (!open) return null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function accept() {
    if (requiresDob && !dobReady) {
      setError(
        dobInput
          ? `You must be at least ${MINIMUM_AGE_YEARS} years old to use Drisora.`
          : "Date of birth is required."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // dob is required by the API; reuse the stored value unless a legacy user
      // needs to provide it during this re-consent flow.
      body: JSON.stringify({
        dob: dobInput,
        professional_capacity: true,
        tos_version: TOS_VERSION,
        pp_version: PRIVACY_VERSION,
      }),
    });
    if (res.ok) {
      setOpen(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Could not record your acceptance. Please try again.");
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[16px] border border-[rgba(255,255,255,0.10)] bg-[#111116] p-6 text-[#C9C9D4] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <h2 className="text-lg font-semibold text-white">We&rsquo;ve updated our terms</h2>
        <p className="mt-2 text-[13px] leading-6 text-[#A8A8B6]">
          Our Terms of Service and/or Privacy Policy have changed. Please review and accept the current
          versions to continue using Drisora.
        </p>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 text-[13px] text-[#A8A8B6]">
            <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F5A623]" />
            <span>
              I accept the updated{" "}
              <Link href="/legal/terms" target="_blank" className="text-[#F5A623] underline">
                Terms of Service (v{TOS_VERSION})
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-3 text-[13px] text-[#A8A8B6]">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F5A623]" />
            <span>
              I accept the updated{" "}
              <Link href="/legal/privacy" target="_blank" className="text-[#F5A623] underline">
                Privacy Policy (v{PRIVACY_VERSION})
              </Link>
              .
            </span>
          </label>
        </div>

        {requiresDob && (
          <div className="mt-5">
            <label htmlFor="reconsent-dob" className="mb-1.5 block text-[13px] text-[#A8A8B6]">
              Date of birth
            </label>
            <input
              id="reconsent-dob"
              type="date"
              required
              value={dobInput}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setDobInput(e.target.value);
                if (error === "Date of birth is required.") setError(null);
              }}
              className="h-11 w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0C0C12] px-3 text-sm text-white outline-none focus:border-[#F5A623]"
              aria-invalid={underage}
            />
            {underage && (
              <p className="mt-1.5 text-[12px] text-[#EF4444]">
                You must be at least {MINIMUM_AGE_YEARS} years old to use Drisora.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-[12px] text-[#EF4444]">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            disabled={!canSubmit}
            onClick={accept}
            className="h-11 flex-1 rounded-[8px] bg-[#F5A623] text-sm font-medium text-[#111] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Accept and continue"}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="grid h-11 place-items-center rounded-[8px] border border-[rgba(255,255,255,0.12)] px-4 text-sm text-[#A8A8B6]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
