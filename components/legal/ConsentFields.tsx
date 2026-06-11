"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { meetsAgeFloor, MINIMUM_AGE_YEARS } from "@/lib/legal/versions";

export type ConsentState = {
  dob: string;
  tos: boolean;
  privacy: boolean;
};

const EMPTY: ConsentState = { dob: "", tos: false, privacy: false };

/** True when DOB is present, age >= 18, and both consent checkboxes are ticked. */
export function isConsentComplete(s: ConsentState): boolean {
  return Boolean(s.dob) && meetsAgeFloor(s.dob) && s.tos && s.privacy;
}

/**
 * Reusable consent capture UI: DOB field (with client-side 18+ check) plus two
 * required checkboxes (Terms, Privacy). Controlled — the
 * parent owns validity and decides when to enable the submit/OAuth action.
 *
 * Server-side enforcement still happens in /api/consent (age re-check + audit row);
 * this is the UX gate, not the security boundary.
 */
export function ConsentFields({
  value,
  onChange,
}: {
  value?: ConsentState;
  onChange: (next: ConsentState, complete: boolean) => void;
}) {
  const [state, setState] = useState<ConsentState>(value ?? EMPTY);

  useEffect(() => {
    onChange(state, isConsentComplete(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const underage = Boolean(state.dob) && !meetsAgeFloor(state.dob);

  function set<K extends keyof ConsentState>(key: K, val: ConsentState[K]) {
    setState((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4 text-left">
      <div>
        <label htmlFor="dob" className="mb-1.5 block text-[13px] text-[#A8A8B6]">
          Date of birth
        </label>
        <input
          id="dob"
          type="date"
          required
          value={state.dob}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => set("dob", e.target.value)}
          className="h-11 w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0C0C12] px-3 text-sm text-white outline-none focus:border-[#F5A623]"
          aria-invalid={underage}
        />
        {underage && (
          <p className="mt-1.5 text-[12px] text-[#EF4444]">
            You must be at least {MINIMUM_AGE_YEARS} years old to use Drisora.
          </p>
        )}
      </div>

      <Checkbox
        checked={state.tos}
        onChange={(v) => set("tos", v)}
        id="consent-tos"
        label={
          <>
            I have read and agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="text-[#F5A623] underline">
              Terms of Service
            </Link>
            .
          </>
        }
      />
      <Checkbox
        checked={state.privacy}
        onChange={(v) => set("privacy", v)}
        id="consent-privacy"
        label={
          <>
            I have read and agree to the{" "}
            <Link href="/legal/privacy" target="_blank" className="text-[#F5A623] underline">
              Privacy Policy
            </Link>
            .
          </>
        }
      />
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#A8A8B6]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#F5A623]"
      />
      <span>{label}</span>
    </label>
  );
}
