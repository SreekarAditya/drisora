# Premium Polish — Design Spec
**Date:** 2026-05-02  
**Approach:** Page-by-page (B)

---

## Overview

Five areas of polish applied page-by-page: onboarding tour, dashboard, job status page, results pages, and a global mobile audit. All TypeScript must compile with zero errors.

---

## Page 1 — `/onboarding/tour` (new route)

### Route & navigation
- New file: `app/onboarding/tour/page.tsx` — `"use client"` component.
- After profile form saves at `/onboarding`, call `router.push("/onboarding/tour")`.
- Middleware already covers `/onboarding/tour` via the `/onboarding` prefix — no middleware change needed.
- Skip button on every step navigates to `/dashboard`.

### Layout
- Full-screen `bg-[#0a0a0a]`, centered card `max-w-lg`.
- Top of card: Drisora wordmark + amber dot tagline (matches existing onboarding form style).
- Step indicator: pill-style dots — wide amber pill for active step, small dark pill for inactive. Below dots: `STEP N OF 3` in mono uppercase + amber, then heading (lg, semibold, white), then subtitle (sm, gray-500).
- Footer row: "Skip tour" text-button (left) | ← Back button (hidden on step 0) | Next → / "Let's go" button (right, amber).
- Keyboard: left/right arrow keys navigate steps.

### Step 1 — "Choose your survey type"
- Three horizontal list cards stacked vertically inside the card body.
- Each card: icon (SVG, amber on dark bg) + title (white, semibold) + "Best for:" description (gray-500, sm).
- Cards animate in with a staggered entrance (100 ms delay between each) using CSS `@keyframes` fade-up — purely cosmetic, no interactivity.
- Modes: Image Batch ("Best for: road inspections with DSLR or phone camera"), Handheld Video ("Best for: continuous road surveys filmed from a moving vehicle"), Drone Footage ("Best for: aerial coverage with embedded GPS mapping").

### Step 2 — "What you'll get"
- Three tab toggles at the top: Image Batch / Handheld Video / Drone.
- Below tabs: a framed inline HTML/CSS mockup that switches per tab. No real images — all CSS.
  - **Image Batch tab:** 4-column grid of placeholder photo cards, each with a colored PCI chip in the top-right corner (green, yellow, orange, red to show range).
  - **Handheld Video tab:** A time-series chart mockup — amber polyline on a dark grid, x-axis labeled "Frame", y-axis labeled "PCI".
  - **Drone tab:** A simplified map mockup — dark rectangle with a curved amber dotted path and colored dots at intervals representing PCI scores.
- Tab switch is instant (no animation needed).

### Step 3 — "Here's how it works"
- Three numbered steps displayed horizontally (or stacked on mobile) with arrows between them:
  `① Upload your footage  →  ② AI analyses pavement  →  ③ Download IRC report`
- Each step: number circle (amber), short label (white), one-line description (gray-500).
- No checkmarks — forward-looking only.
- Primary CTA: amber button "Upload your first survey →" → `/upload`.
- Secondary link below: "Take me to the dashboard" → `/dashboard`.

---

## Page 2 — `/dashboard`

### Empty state (enhance existing)
- `EmptyState` component in `components/dashboard/JobList.tsx` — keep same structure, increase visual weight.
- Icon area: `h-16 w-16` rounded-full, `border border-[#222] bg-[#111]`, add a subtle amber glow (`shadow-[0_0_24px_rgba(245,158,11,0.15)]`).
- Headline: "No surveys yet" (white, base, semibold).
- Subtext: "Upload drone footage, a handheld video, or an image batch to get your first PCI report." (gray-500, sm, max-w-xs).
- CTA: existing amber "Start your first survey →" button → `/upload`.
- Stats cards still render above (showing `0`, `0`, `—`, `—`) — no layout jump.

### Loading skeleton (new)
- Convert `DashboardPage` to use `<Suspense>`:
  - Extract the Supabase fetch + `<JobList>` render into a new `async` component `JobListFetcher`.
  - Wrap it in `<Suspense fallback={<DashboardSkeleton />}>` inside `DashboardPage`.
- `DashboardSkeleton` (new component in `components/dashboard/`):
  - Same page wrapper as `JobList` (heading + "New Survey" button area as shimmer).
  - 4 stat cards as shimmer rectangles (`rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]`).
  - Table container with 4 skeleton rows — each row shimmer-fills the same columns as the real table (date, mode badge, frames, PCI, status, actions).
  - Uses the existing `Skeleton` shimmer pattern from `app/jobs/[id]/page.tsx`.

---

## Page 3 — `/jobs/[id]`

### Retry button (new API endpoint)
- New file: `app/api/jobs/[id]/retry/route.ts`.
  - `POST` handler: authenticates user, fetches job, verifies ownership, checks `status === "failed"`.
  - Resets job in Supabase: `status = "queued"`, `error_message = null`, `processed_count = 0`.
  - Re-submits to RunPod (same call as in `app/api/jobs/create/route.ts`).
  - Returns `{ ok: true }` on success.
- In `app/jobs/[id]/page.tsx`, failed state: replace the "Try again" link with a **Retry button**.
  - On click: POST to `/api/jobs/[id]/retry`, show spinner on the button.
  - On success: resume polling (the job is now `queued` again).
  - On error: show inline error message below the button ("Retry failed — please try again.").
- Keep the `error_message` text visible so the user knows what originally failed.
- Add a secondary "New survey" link → `/upload` below the retry button.

### Pipeline timeout — specific message
- In `app/jobs/[id]/page.tsx`, within the failed branch: check `job.error_message?.toLowerCase().includes("timeout")`.
- If true, render a distinct timeout state:
  - Headline: "Processing timed out"
  - Subtext: "The pipeline took too long and was stopped automatically."
  - Retry button (same as above).
  - Below retry: "Contact support" anchor `mailto:support@drisora.com` (gray-400, sm, underline).
- If false, render the generic failed state (as revised above).

### Upload — per-file errors
- Read `useUpload.ts` and the upload panel components to understand current error surfacing.
- If errors are currently a single string, refactor to a `Record<string, string>` map of `filename → errorReason`.
- In each panel's file list UI, render a small red error row beneath each errored file: filename (truncated) + reason (e.g. "File too large", "Unsupported format").
- Submit button stays disabled while any file has an error.

### Loading skeleton
- `LoadingSkeleton` in `app/jobs/[id]/page.tsx` is already solid — no changes needed.

---

## Page 4 — `/jobs/[id]/results`

### No detections found (all three mode components)
- Condition: `results.frames.length === 0`.
- Shared `NoDetectionsState` component in `components/results/jobs/shared.tsx`:
  - Green checkmark circle icon (`h-14 w-14`, `bg-emerald-500/10`, `text-emerald-400`).
  - Headline: "No defects detected" (white, lg, semibold).
  - Subtext: "This road section scored PCI 100 — no cracks or damage were found." (gray-500, sm).
  - "Download report" button (amber, sm) → `/api/jobs/[jobId]/report`.
  - "Back to dashboard" link (gray-400, sm) → `/dashboard`.
- Each of `ImageBatchResults`, `HandheldVideoResults`, `DroneJobResults`: check frames length at the top, return `<NoDetectionsState jobId={jobId} />` before rendering normal UI. `SummaryBar` still renders above it.

### Map — no GPS data (`DroneJobResults`)
- Condition: `gpsFrames.length === 0` (already computed in the component).
- Replace the map `<div>` with a centered empty state inside the same `h-[560px]` container:
  - Location-pin SVG icon (gray-600).
  - "No GPS data available" (white, sm, semibold).
  - "This survey has no location coordinates — the map view is unavailable." (gray-600, xs).
  - "Results are still available in the crack distribution section below." (gray-700, xs).
- Sidebar and crack distribution panels still render normally.

### Results skeleton (new)
- `app/jobs/[id]/results/page.tsx` is a server component. Wrap in `<Suspense fallback={<ResultsSkeleton />}>` after extracting the data fetch + renderer into a child async component `ResultsContent`.
- `ResultsSkeleton` (new, in `components/results/jobs/`): mode-agnostic — the mode is fetched inside the Suspense boundary so it can't be known before data loads.
  - Shimmer `SummaryBar` (4 stat chips as shimmer blocks, same height as real bar).
  - Large shimmer content block below (`h-[400px] rounded-xl`) to fill the expected page height.
  - No mode-specific variants needed.

---

## Page 5 — Mobile audit (global)

### Navbar — hamburger dropdown (`components/dashboard/Navbar.tsx`)
- Add `const [menuOpen, setMenuOpen] = useState(false)`.
- On `< md` (768px):
  - Hide existing `<nav>` links and the sign-out button (`hidden md:flex` / `hidden md:block`).
  - Show hamburger button (3-line SVG, `md:hidden`) in top-right.
  - On tap: toggle `menuOpen`. Render a full-width dropdown `div` below the header (`w-full border-b border-[#1a1a1a] bg-[#0f0f0f]`):
    - "Surveys" link → `/dashboard`
    - "New Survey" link → `/upload`
    - Divider line
    - "Sign out" button (same `handleSignOut` logic)
  - Clicking any link closes the menu. Add `useEffect` to close on route change.
- On `≥ md`: existing layout fully unchanged.

### Results grid — 1 column on mobile (`ImageBatchResults`)
- Change the image grid class to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

### Map sidebar → bottom sheet on mobile (`DroneJobResults`)
- On `< lg`: the `SegmentSidebar` renders as a fixed bottom sheet instead of the right grid column.
- When `selectedFrame !== null` on mobile: mount `SegmentSidebar` as `fixed bottom-0 left-0 right-0 z-50 h-96 rounded-t-xl border-t border-[#1a1a1a] bg-[#0f0f0f]`.
- Add a drag-handle bar at the top of the sheet (short gray bar, `w-10 h-1 rounded-full bg-[#333] mx-auto mt-3`). Tapping it or the close button dismisses.
- On `≥ lg`: existing right-column sidebar layout unchanged.
- Detect screen size via a `useMediaQuery("(max-width: 1023px)")` hook (simple `window.matchMedia` wrapper, SSR-safe with `useState` defaulting to `false`).

### Dashboard table — horizontal scroll on mobile (`JobList`)
- Wrap the `<table>` in `<div className="overflow-x-auto">`.
- Add `hidden sm:table-cell` to the "Frames" column header and every `<td>` in that column to reduce crowding on small screens.

---

## New files summary

| File | Purpose |
|------|---------|
| `app/onboarding/tour/page.tsx` | 3-step onboarding tour |
| `app/api/jobs/[id]/retry/route.ts` | Re-queue failed job |
| `components/dashboard/DashboardSkeleton.tsx` | Dashboard loading skeleton |
| `components/results/jobs/ResultsSkeleton.tsx` | Results loading skeleton |

## Modified files summary

| File | Change |
|------|--------|
| `app/onboarding/page.tsx` | Push to `/onboarding/tour` after save |
| `app/(dashboard)/dashboard/page.tsx` | Add Suspense + JobListFetcher |
| `components/dashboard/JobList.tsx` | Enhance empty state, add overflow-x-auto, hide Frames col on mobile |
| `app/jobs/[id]/page.tsx` | Retry button, timeout-specific message |
| `app/jobs/[id]/results/page.tsx` | Add Suspense + ResultsFetcher |
| `components/results/jobs/shared.tsx` | Add NoDetectionsState |
| `components/results/jobs/ImageBatchResults.tsx` | No-detections guard, 1-col mobile grid |
| `components/results/jobs/HandheldVideoResults.tsx` | No-detections guard |
| `components/results/jobs/DroneJobResults.tsx` | No-detections guard, no-GPS empty state, mobile bottom sheet |
| `components/dashboard/Navbar.tsx` | Hamburger dropdown for mobile |
| `hooks/useUpload.ts` + upload panels | Per-file error map |
