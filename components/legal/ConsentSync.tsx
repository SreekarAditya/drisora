"use client";

import { useEffect } from "react";

export const PENDING_CONSENT_KEY = "drisora_pending_consent";

/**
 * Flushes the consent payload captured at the login gate (stashed in localStorage
 * before the OAuth redirect) to the server once the user is authenticated.
 * Mounted in the authenticated dashboard layout. No-op when nothing is pending.
 */
export function ConsentSync() {
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PENDING_CONSENT_KEY) : null;
    if (!raw) return;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(PENDING_CONSENT_KEY);
      return;
    }

    fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        // Clear on success or on a definitive client error (4xx) so we don't loop.
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          window.localStorage.removeItem(PENDING_CONSENT_KEY);
        }
      })
      .catch(() => {
        // Network error: leave it in place to retry on next load.
      });
  }, []);

  return null;
}
