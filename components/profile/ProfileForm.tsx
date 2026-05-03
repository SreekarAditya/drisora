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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium text-gray-300">Full name</span>
          <input
            name="full_name"
            defaultValue={profile?.full_name ?? ""}
            className="w-full rounded-md border border-white/10 bg-[#101113] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-gray-300">Organization</span>
          <input
            name="org_name"
            defaultValue={profile?.org_name ?? ""}
            className="w-full rounded-md border border-white/10 bg-[#101113] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-gray-300">Role</span>
          <select
            name="role"
            defaultValue={profile?.role ?? ""}
            className="w-full rounded-md border border-white/10 bg-[#101113] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          >
            <option value="">Select role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium text-gray-300">Phone</span>
          <input
            name="phone"
            defaultValue={profile?.phone ?? ""}
            className="w-full rounded-md border border-white/10 bg-[#101113] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/70"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-300">Avatar URL</span>
          <input
            name="avatar_url"
            type="url"
            defaultValue={profile?.avatar_url ?? ""}
            placeholder="https://..."
            className="w-full rounded-md border border-white/10 bg-[#101113] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700 focus:border-amber-500/70"
          />
        </label>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#101113] p-4">
        <label className="flex items-start gap-3">
          <input
            name="notifications_enabled"
            type="checkbox"
            defaultChecked={profile?.notifications_enabled ?? true}
            className="mt-1 h-4 w-4 accent-amber-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-200">Processing and report notifications</span>
            <span className="mt-1 block text-sm leading-6 text-gray-500">
              Receive upload, completion, failure, and shared-report notifications.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#101113] p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-gray-200">Password</p>
            <p className="mt-1 text-sm text-gray-500">{email}</p>
          </div>
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={resetting}
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            {resetting ? "Sending..." : "Send reset email"}
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
