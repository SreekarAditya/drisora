# Drisora Complete Work Log

Generated: 2026-05-04
Repository: `SreekarAditya/drisora`
Main baseline before this document: `4c86e6e` (`origin/main`)
Scope: This document summarizes the Drisora product, engineering, UI, reporting, worker, data-model, and deployment work visible in the repo history and Codex memory notes through PR #17.

> **Archived history:** this snapshot predates the PCI engine remediation in
> `REMEDIATION.md`. Its Depth Pro, point-PCI, crack-width, compliance, and report
> descriptions document former behavior and must not be read as current claims.

## Historical Product State at 2026-05-04

Drisora is now a Next.js / Supabase / R2 / RunPod pavement condition assessment SaaS for road survey media. It supports:

- Google authentication and protected SaaS dashboard routes.
- Account setup and onboarding.
- Project-level organization for roads, highway packages, and zones.
- Survey uploads for image batches, handheld video, and drone footage.
- Direct browser-to-Cloudflare-R2 upload using presigned PUT URLs.
- Redis-backed job lifecycle and RunPod worker submission.
- Drone footage with embedded GPS or paired `.SRT` telemetry.
- Handheld video with optional `.SRT` GPS log.
- Image batches with EXIF/geotag GPS handling.
- YOLO crack detection, SAM2 mask support, Depth Pro / metric analysis controls, PCI scoring, and civil engineering recommendations.
- Results pages for all survey modes.
- Interactive Leaflet maps with PCI and crack-width overlays.
- Detection overlays for YOLO boxes and SAM2 mask polygons when worker payloads include them.
- Professional PDF reports with PCI summary, map, crack metrics, causes, mitigations, priorities, methodology, branding, and IRC:82-2023 language.
- Project dashboards, combined project reports, surveys queue, completed reports list, profile editing, team placeholder, and about page.

## Major Pull Requests And Commits

| PR / Commit | Branch / Commit | Summary |
|---|---|---|
| Initial | `02d2a25` | Initial Create Next App commit. |
| Initial Drisora | `067dc18` | Initial Drisora build. |
| Redeploy / author fixes | `526e064`, `36008fb` | Redeploy trigger and git author cleanup. |
| Root redirect fixes | `101f427`, `da5f680` | Root route redirects to landing or dashboard. |
| Landing redesign | `1ef9cb1` | Premium landing page redesign with product preview mockup. |
| PR #1 | `67b59c8` | Premium survey empty state and upgraded built-for section. |
| PR #2 | `6b5db7b` | Google OAuth auth layer, onboarding, protected routes. |
| Phase 4 | `ae6949e` | Results views, PDF report, and jobs dashboard. |
| Docs | `e422d6b`, `0e9c249` | Premium polish design spec and implementation plan. |
| UX polish commits | `79e3358` to `789d2da` | Onboarding tour, skeletons, upload validation, retry, mobile navbar, mobile results, no-GPS state. |
| PR #3 | `236c2c7` | Drone plus SRT upload validation and JSON error parsing in UI. |
| PR #4 | `2c06550` | RunPod serverless worker refactor. |
| PR #5 | `541a086` | Removed local Claude worktree gitlinks. |
| PR #6 | `a35fabf` | Fixed RunPod serverless API host. |
| PR #7 | `ed1249b` | E2E premium fixes and OpenCV system dependency adjustment. |
| Direct polish | `55a0c08` | Upload lifecycle and premium SaaS polish. |
| PR #8 | `3c76845` | RunPod worker ML pipeline. |
| PR #9 | `da3c945` | Job progress and results redirect-loop fix. |
| PR #10 | `229fc93` | Report crack labels and PDF generation fixes. |
| Worker fixes | `047765a`, `e6c1832`, `3370f55`, `2cb49a3` | Worker warmup caching, compact DJI SRT, worker diagnostics, PDF condition map. |
| PR #12 | `4273623` | Worker runtime model controls. |
| PR #13 | `a1ae18a` | Depth Pro optional for all upload modes. |
| PR #14 | `fdf7a78` | Metric analysis crack-width estimates. |
| PR #15 | `ad44442` | Projects, civil engineering intelligence, crack metrics, and professional PDF reporting. |
| PR #16 | `efdf405` | Final SaaS polish: branding, crack metrics visibility, report map, PDF polish. |
| PR #17 | `4c86e6e` | Targeted smoothness pass: detection overlays, delete consistency, upload copy, About nav. |

## Authentication, Routing, And App Structure

Completed work:

- Added Google OAuth login and signup flow.
- Added profile/account setup.
- Added protected dashboard layout.
- Added Supabase SSR auth refresh behavior using `supabase.auth.getUser()`.
- Moved auth/redirect behavior to the Next 16 `proxy.ts` convention during route wiring work.
- Preserved tokenized access for printable report routes so PDF rendering can happen without normal dashboard auth redirects.
- Added top-level SaaS navigation:
  - Dashboard
  - Projects
  - Surveys
  - Reports
  - Team
  - About
  - User avatar dropdown with Edit Profile, About, and Sign out.
- Added breadcrumbs throughout dashboard routes.
- Added mobile hamburger navigation.
- Added root redirect behavior:
  - Authenticated users go to dashboard.
  - Unauthenticated users go to landing/login flow.

Important routes:

- `/`
- `/landing`
- `/login`
- `/signup`
- `/onboarding`
- `/onboarding/tour`
- `/dashboard`
- `/upload`
- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/surveys`
- `/reports`
- `/team`
- `/profile`
- `/about`
- `/jobs/[id]`
- `/jobs/[id]/results`
- `/survey/[id]`
- `/survey/[id]/report`
- `/report/[id]`

## Upload And Job Lifecycle

Completed work:

- Replaced proxy-style uploads with direct browser-to-R2 uploads through presigned PUT URLs.
- Added shared `hooks/useUpload.ts`.
- Added per-file upload progress.
- Added per-file validation errors.
- Added retry behavior for failed file uploads.
- Split job creation from job submission:
  - Create job first in `uploading`.
  - Upload files to R2.
  - Submit to RunPod only after upload success.
- Added Redis-backed job records.
- Added Supabase `jobs` table integration.
- Added job status API.
- Added job retry API.
- Added worker webhook endpoint.
- Added `uploading` status end-to-end.
- Added average PCI and processed count support.
- Added dashboard and job status views for:
  - Uploading
  - Queued
  - Extracting frames
  - Detecting
  - Segmenting
  - Scoring
  - Complete
  - Failed
- Added timeout-specific error messaging.
- Added soft delete for jobs.
- Made deleted jobs disappear from:
  - Dashboard
  - Surveys
  - Reports
  - Projects
- Added delete confirmation UI on Dashboard and Surveys.

Upload modes:

- Image Batch:
  - JPEG/PNG upload.
  - Up to 1,000 files.
  - EXIF/geotag GPS copy in the UI.
  - Metric Analysis toggle.
- Handheld Video:
  - MP4/MOV upload.
  - Frame interval selector.
  - Optional `.SRT` GPS log.
  - Metric Analysis toggle.
- Drone Footage:
  - MP4/MOV upload.
  - Embedded GPS scan.
  - `.SRT` GPS fallback.
  - Metric Analysis toggle.

Key files:

- `hooks/useUpload.ts`
- `app/api/jobs/create/route.ts`
- `app/api/upload/presign/route.ts`
- `app/api/jobs/[id]/route.ts`
- `app/api/jobs/[id]/submit/route.ts`
- `app/api/jobs/[id]/retry/route.ts`
- `app/api/webhooks/job-complete/route.ts`
- `components/upload/UploadClient.tsx`
- `components/upload/ImageBatchPanel.tsx`
- `components/upload/HandheldVideoPanel.tsx`
- `components/upload/DroneFootagePanel.tsx`

## Cloudflare R2, Redis, RunPod, And Worker Pipeline

Completed work:

- Added R2 presigned upload helpers.
- Added R2 object listing, text fetch, and presigned GET helpers for results.
- Added R2 CORS documentation.
- Added Redis job helpers.
- Added RunPod job submission helper.
- Added RunPod worker/serverless refactors.
- Fixed RunPod serverless API host.
- Added worker runtime model controls.
- Fixed worker warmup caching.
- Fixed OpenCV system dependency issue.
- Added compact DJI GPS SRT support.
- Added worker diagnostics and PDF map improvements.
- Added optional Depth Pro / Metric Analysis controls across upload modes.

Important external dependencies:

- Cloudflare R2 bucket.
- R2 CORS policy.
- Upstash Redis.
- RunPod serverless endpoint.
- Supabase project.
- Vercel deployment.

## Results Pages

Completed work:

- Added results pages for:
  - Image Batch
  - Handheld Video
  - Drone Footage
- Added Suspense loading skeletons.
- Added no-detections state.
- Added mobile-friendly image grids.
- Added mobile bottom sheet for drone map sidebar.
- Added no-GPS state for drone results.
- Added PCI summary cards.
- Added crack type distribution.
- Added frame/section sidebars.
- Added civil engineering analysis in section sidebars.
- Added crack metrics:
  - Max width in mm
  - Avg width in mm
  - Total crack length per crack type
  - Camera-to-surface distance when available
  - Legacy-estimate badge where values are derived
- Added YOLO/SAM2 detection overlay rendering:
  - Bounding boxes.
  - Class labels.
  - Confidence values.
  - Semi-transparent SAM2 mask polygons.
  - Toggle: Show detections.
  - Defaults to showing detections when data exists.
- Maintained backward compatibility:
  - Old results without raw boxes or mask polygons still render normally.
  - Old results with only crack types/PCI still get derived crack metrics.

Key files:

- `components/results/jobs/ImageBatchResults.tsx`
- `components/results/jobs/HandheldVideoResults.tsx`
- `components/results/jobs/DroneJobResults.tsx`
- `components/results/jobs/DetectionFrameImage.tsx`
- `components/results/jobs/DroneMapClient.tsx`
- `components/results/jobs/shared.tsx`
- `lib/jobs/results.ts`
- `lib/detection-annotations.ts`

## Maps And Geospatial UI

Completed work:

- Added Leaflet survey map rendering.
- Added dark Carto basemap.
- Added PCI-colored route/section lines.
- Added PCI legend.
- Added section popups.
- Added drone GPS route map.
- Added map sidebar for selected section/frame.
- Added Width mm overlay mode.
- Added crack width color legend:
  - `< 3 mm`
  - `3-5 mm`
  - `5-8 mm`
  - `>= 8 mm`
- Added width tooltips with:
  - PCI
  - Max crack width
  - Width band
  - Crack types
  - Legacy estimate note when applicable
- Added richer static map schematic in printable reports.
- Added richer PDF map page in generated reports.

Key files:

- `components/map/SurveyMapClient.tsx`
- `components/map/SurveyMap.tsx`
- `components/map/SectionPopup.tsx`
- `components/results/jobs/DroneMapClient.tsx`
- `components/pdf/JobReport.tsx`
- `app/report/[id]/page.tsx`

## Reports And PDF Generation

Completed work:

- Added PDF generation API.
- Added printable report route.
- Added tokenized printable report access.
- Added report storage in Supabase Storage / reports bucket.
- Added signed URL generation.
- Added dashboard report screen with:
  - Download PDF
  - iframe preview
  - Copy share link
- Added report path persistence.
- Added Playwright-based PDF rendering contract for survey reports.
- Reworked PDF from frame-heavy prototype into a professional report:
  - Cover page.
  - Executive Summary.
  - Condition distribution.
  - Pavement Condition Map.
  - Section Summary Table.
  - Methodology and Accuracy Note.
  - IRC:82-2023 compliance language.
  - Page numbers.
  - Drisora branding.
- Added dedicated PDF columns:
  - Section
  - GPS
  - PCI
  - Crack Types + Count
  - Max Width mm
  - Avg Width mm
  - Possible Cause(s)
  - Recommended Mitigation
  - Priority
- Added concise row cap for long reports.
- Added project combined PDF report.
- Added printable legacy report improvements:
  - Static condition schematic instead of placeholder.
  - Max crack width KPI.
  - Separate max and avg width columns.
  - Derived legacy crack metrics.

Key files:

- `app/api/survey/[id]/report/route.ts`
- `app/api/jobs/[id]/report/route.ts`
- `app/api/projects/[id]/report/route.ts`
- `app/report/[id]/page.tsx`
- `components/pdf/JobReport.tsx`
- `components/pdf/ProjectReport.tsx`
- `components/results/ReportDownloadButton.tsx`
- `components/results/CopyShareLinkButton.tsx`
- `lib/report-token.ts`

## Projects, Surveys, Reports, And SaaS IA

Completed work:

- Added Projects as a top-level container.
- Added project create flow.
- Added project dashboard.
- Added ability to assign surveys/jobs to projects.
- Added linked surveys/reports list.
- Added aggregated project PCI view.
- Added project-level treatment/cause summaries.
- Added combined project PDF export.
- Added Surveys tab for active/queued/failed uploads.
- Added Reports tab for completed outputs.
- Added filters for Reports.
- Added Team placeholder.
- Added Edit Profile page.
- Added About page with:
  - Product story.
  - AI stack.
  - Accuracy notes.
  - IRC compliance notes.
  - Contact.
- Promoted About to top-level navigation.
- Added footer About link.

Key files:

- `app/(dashboard)/projects/page.tsx`
- `app/(dashboard)/projects/new/page.tsx`
- `app/(dashboard)/projects/[id]/page.tsx`
- `app/(dashboard)/surveys/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/team/page.tsx`
- `app/(dashboard)/profile/page.tsx`
- `app/(dashboard)/about/page.tsx`
- `components/projects/ProjectCreateForm.tsx`
- `components/projects/ProjectAssignForm.tsx`
- `components/surveys/SurveyOperationsTable.tsx`
- `components/profile/ProfileForm.tsx`

## Civil Engineering Intelligence

Completed work:

- Added hard-coded IRC:82-2023-aligned civil/highway knowledge base.
- Added distress analysis for:
  - Longitudinal Crack
  - Transverse Crack
  - Alligator/Fatigue Crack
  - Pothole
- Added possible causes.
- Added recommended mitigations.
- Added severity classification:
  - Low
  - Medium
  - High
- Added maintenance priority:
  - Routine
  - Preventive
  - Immediate
- Used PCI, crack count/density proxy, and crack width to determine severity and priority.
- Rendered civil intelligence in:
  - Results sidebar.
  - Survey map popups.
  - PDF section tables.
  - Project-level summaries.

Key file:

- `lib/civil-intelligence.ts`

## Crack Metrics And Legacy Backward Compatibility

Completed work:

- Added crack width in mm across UI and PDF.
- Added max width.
- Added avg width.
- Added crack length by type.
- Added width heatmap/overlay.
- Added width legends and tooltips.
- Added derived crack metrics for legacy jobs and surveys.
- Avoided hardcoding example job IDs.
- Confirmed no literal hardcoded example UUIDs remain in new code during previous hardcoding cleanup passes.
- Kept data model additive.
- Did not break existing jobs/surveys that lack new fields.
- Added `crack_metrics_estimated` and `crack_metrics_source` metadata for job results.
- Added derived values on load instead of requiring destructive backfills.

Key files:

- `lib/crack-metrics.ts`
- `lib/jobs/results.ts`
- `app/api/survey/[id]/results/route.ts`
- `types/index.ts`
- `components/results/jobs/shared.tsx`
- `components/results/jobs/DroneJobResults.tsx`
- `components/results/jobs/ImageBatchResults.tsx`
- `components/results/jobs/HandheldVideoResults.tsx`
- `components/map/SectionPopup.tsx`
- `components/pdf/JobReport.tsx`

## Branding And Visual Polish

Completed work:

- Replaced old square "D" style logo.
- Added professional Drisora mark/wordmark.
- Added generated `/icon` favicon.
- Applied branding to:
  - Top nav.
  - Login.
  - Onboarding.
  - Job status page.
  - Landing page.
  - About page.
  - PDF headers.
  - Project report header.
- Tightened dark theme contrast.
- Improved dashboard hero KPI cards.
- Improved empty states.
- Improved loading states.
- Improved mobile responsiveness.
- Improved buttons, cards, tabs, toggles, and focus/hover states.
- Removed customer-facing internal readiness badges from New Survey page:
  - R2 upload
  - AI scoring
  - PDF report
- Improved upload microcopy:
  - Replaced clunky "1 to 1,000 images" language.
  - Made EXIF/geotag support explicit.
  - Made optional SRT support explicit for handheld video.

Key files:

- `components/branding/DrisoraLogo.tsx`
- `app/icon.tsx`
- `components/dashboard/Navbar.tsx`
- `app/(auth)/login/page.tsx`
- `app/onboarding/page.tsx`
- `app/onboarding/tour/page.tsx`
- `app/jobs/[id]/page.tsx`
- `app/landing/page.tsx`
- `app/(dashboard)/about/page.tsx`
- `components/pdf/JobReport.tsx`
- `components/pdf/ProjectReport.tsx`

## Database And Migrations

Migration files:

- `supabase/migrations/001_initial_schema.sql`
  - Initial tables for surveys, sections, detections, reports, and related primitives.
- `supabase/migrations/002_rls_policies.sql`
  - Row-level security policies.
- `supabase/migrations/003_spatial_indexes.sql`
  - Spatial indexes for road geometry.
- `supabase/migrations/004_profiles_google_auth.sql`
  - Profiles and Google auth support.
- `supabase/migrations/005_jobs.sql`
  - Jobs table and job lifecycle fields.
- `supabase/migrations/006_jobs_average_pci.sql`
  - Adds `average_pci` and `processed_count`.
- `supabase/migrations/007_jobs_uploading_status.sql`
  - Adds/permits `uploading` status for upload-first lifecycle.
- `supabase/migrations/008_projects_crack_metrics.sql`
  - Adds projects.
  - Adds project assignment to jobs/surveys.
  - Adds soft delete fields.
  - Adds profile avatar/notification fields.
  - Adds road-section crack width metrics.
  - Adds crack length by type.
  - Adds civil severity, maintenance priority, possible causes, and recommended mitigation.
  - Adds detection width/length/density columns.
  - Adds indexes for projects, jobs, surveys, and crack width.

Important rule:

- New data model changes have been additive. Old records should continue to work even when new fields are null or absent.

## API Inventory

Implemented or updated API routes:

- `app/api/jobs/create/route.ts`
- `app/api/jobs/[id]/route.ts`
- `app/api/jobs/[id]/submit/route.ts`
- `app/api/jobs/[id]/retry/route.ts`
- `app/api/jobs/[id]/results/route.ts`
- `app/api/jobs/[id]/report/route.ts`
- `app/api/upload/presign/route.ts`
- `app/api/webhooks/job-complete/route.ts`
- `app/api/survey/create/route.ts`
- `app/api/survey/[id]/status/route.ts`
- `app/api/survey/[id]/results/route.ts`
- `app/api/survey/[id]/report/route.ts`
- `app/api/surveys/route.ts`
- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/links/route.ts`
- `app/api/projects/[id]/report/route.ts`
- `app/api/profile/route.ts`

## Important Environment And Deployment Notes

Required external setup:

- Supabase database migrations through `008_projects_crack_metrics.sql`.
- Supabase auth callback URLs configured for local and deployed app.
- Supabase service role key for server-side report generation where needed.
- Cloudflare R2 bucket and credentials.
- Cloudflare R2 CORS policy applied once.
- Upstash Redis REST URL and token.
- RunPod API key and endpoint ID.
- Worker webhook secret shared between worker and Next.js.
- `NEXT_PUBLIC_APP_URL` for worker callbacks and deployed report links.
- Playwright Chromium installed where PDF generation runs:
  - `npx playwright install chromium`

Important verification note:

- In this environment, `next build --webpack` is the reliable production build path.
- Turbopack repeatedly hit sandbox/native-process restrictions in earlier audits.

## Verification Performed

Across the later implementation passes, the following were run successfully:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (`next build --webpack`)
- `git diff --check`
- Hardcoded UUID searches.
- Targeted copy scans.
- Vercel PR checks on PR #16 and PR #17.

Known environment limitation:

- Starting `npm run dev` inside this sandbox can fail with `listen EPERM 0.0.0.0:3000`. This was an environment permission issue, not a confirmed app regression.

## Backward Compatibility Decisions

- No special hardcoded job ID exists.
- Example screenshot/PDF UUIDs were treated as examples only.
- Old jobs without raw detection geometry still render normally.
- Old jobs without stored mm widths get estimated crack metrics from crack type, PCI, and detection density proxies.
- Old surveys without new project/crack/civil fields continue to load because new model changes are additive.
- Report token flow remains available for PDF rendering.
- Printable reports remain server-rendered and CSS-based.
- Storage/report paths remain compatible with existing generated reports.

## Current Known Limitations

- Detection overlays require worker JSON to include boxes and/or mask polygons in a supported shape. If the worker only uploads already-rendered overlay PNGs, the UI still shows the image but cannot reconstruct missing raw geometry.
- Legacy crack width values may be labeled as estimates when the original depth/width values were not stored.
- Depth-derived crack width remains an engineering estimate and should be field-verified for contractual acceptance.
- Full BOQ/payment-grade acceptance still requires agency validation rules outside the current app.
- Some external setup cannot be verified from the repo alone, including deployed Supabase settings, R2 bucket CORS, RunPod endpoint state, and Vercel environment variables.

## Main Branch Baseline

As of this document:

- `main` is aligned with `origin/main`.
- Latest merge commit is `4c86e6e`.
- Latest merged PR is #17.
- The app builds successfully with webpack.

## Fast Handoff For The Next Engineer

Start here:

1. Read `AGENTS.md` before editing, especially the Next.js warning.
2. Use `next build --webpack` for production verification.
3. Check Supabase migrations through `008`.
4. Confirm env vars for Supabase, R2, Redis, RunPod, and webhook secrets.
5. For report/PDF work, inspect:
   - `app/api/survey/[id]/report/route.ts`
   - `app/report/[id]/page.tsx`
   - `components/pdf/JobReport.tsx`
6. For job upload/processing work, inspect:
   - `hooks/useUpload.ts`
   - `app/api/jobs/create/route.ts`
   - `app/api/jobs/[id]/submit/route.ts`
   - `lib/jobs/submit.ts`
   - `lib/runpod.ts`
7. For crack metrics/civil intelligence, inspect:
   - `lib/crack-metrics.ts`
   - `lib/civil-intelligence.ts`
   - `lib/jobs/results.ts`
8. For results overlays, inspect:
   - `components/results/jobs/DetectionFrameImage.tsx`
   - `lib/detection-annotations.ts`
