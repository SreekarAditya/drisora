// Single source of truth for legal document versions.
// Bump the version string AND the date whenever the corresponding document
// changes materially. The re-consent flow compares the user's stored
// tos_version / pp_version against these constants to decide whether to
// re-prompt. Keep these in sync with the headers in app/legal/*.

export const TOS_VERSION = "1.0";
export const TOS_EFFECTIVE_DATE = "2026-06-11";

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_EFFECTIVE_DATE = "2026-06-11";

// Minimum age (hard floor) enforced at registration.
export const MINIMUM_AGE_YEARS = 18;

/** Returns full years between dob and `now` (default: today). */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** True when the supplied DOB string (YYYY-MM-DD) meets the age floor. */
export function meetsAgeFloor(dobIso: string): boolean {
  if (!dobIso) return false;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return false;
  return ageInYears(dob) >= MINIMUM_AGE_YEARS;
}
