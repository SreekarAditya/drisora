"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileValue {
  full_name: string | null;
  org_name: string | null;
  role: string | null;
  phone: string | null;
  avatar_url: string | null;
  notifications_enabled: boolean | null;
}

interface Props {
  email: string;
  profile: ProfileValue | null;
}

const ROLES = [
  "PWD Engineer",
  "Municipal Corporation",
  "College Infrastructure Team",
  "Private Contractor",
  "Other",
];

const inputClass = "w-full rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#0D0D11] px-[14px] py-2.5 text-sm text-[#F0F0F4] outline-none transition-all duration-150 focus:border-[rgba(245,166,35,0.50)] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.10)]";

export function ProfileForm({ email, profile }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body = {
      ...Object.fromEntries(form.entries()),
      notifications_enabled: form.get("notifications_enabled") === "on",
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to update profile");
        return;
      }
      setMessage("Profile updated");
    } catch {
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    setResetting(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Password reset email sent");
    } finally {
      setResetting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#8A8A9A]">Identity</span>
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-medium text-[#8A8A9A]">Full name</span>
            <input name="full_name" defaultValue={profile?.full_name ?? ""} className={inputClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-[#8A8A9A]">Organization</span>
            <input name="org_name" defaultValue={profile?.org_name ?? ""} className={inputClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-[#8A8A9A]">Role</span>
            <select name="role" defaultValue={profile?.role ?? ""} className={inputClass}>
              <option value="">Select role</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-[#8A8A9A]">Phone</span>
            <input name="phone" defaultValue={profile?.phone ?? ""} className={inputClass} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#8A8A9A]">Avatar URL</span>
            <input name="avatar_url" type="url" defaultValue={profile?.avatar_url ?? ""} placeholder="https://..." className={`${inputClass} placeholder:text-[#4A4A5A]`} />
          </label>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#8A8A9A]">Notifications</span>
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
        </div>
        <div className="rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              name="notifications_enabled"
              type="checkbox"
              defaultChecked={profile?.notifications_enabled ?? true}
              className="mt-1 h-4 w-4 accent-[#F5A623] rounded"
            />
            <span>
              <span className="block text-sm font-medium text-[#F0F0F4]">Processing and report notifications</span>
              <span className="mt-1 block text-sm leading-6 text-[#8A8A9A]">
                Receive upload, completion, failure, and shared-report notifications.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#8A8A9A]">Security</span>
          <div className="h-px flex-1 bg-[rgba(255,255,255,0.07)]" />
        </div>
        <div className="rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11] p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-[#F0F0F4]">Password recovery</p>
              <p className="mt-1 font-mono text-[13px] text-[#8A8A9A]">{email}</p>
            </div>
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={resetting}
              className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2 text-sm font-semibold text-[#8A8A9A] transition-all duration-150 hover:border-[rgba(255,255,255,0.20)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white disabled:opacity-50"
            >
              {resetting ? "Sending..." : "Send reset email"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p className="rounded-[8px] bg-[rgba(16,185,129,0.10)] border border-[rgba(16,185,129,0.25)] px-3 py-2 text-sm text-[#10B981]">{message}</p>
      )}
      {error && (
        <p className="rounded-[8px] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.25)] px-3 py-2 text-sm text-[#EF4444]">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-[8px] bg-[#F5A623] py-3 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-6"
      >
        {saving ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
