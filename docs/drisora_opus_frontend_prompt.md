# Drisora Frontend Facelift — Full Redesign Prompt for Claude Opus

---

## 1. Product Context

**What is Drisora:**
Pavement condition intelligence SaaS for India's civil infrastructure sector. PWD engineers, NHAI teams, municipal corporations, and EPC contractors upload drone footage (MP4 + DJI .SRT telemetry) and receive fully automated IRC:82-2023 compliant PCI-scored geospatial reports — crack detection via YOLOv12s, segmentation via SAM2, depth-estimated crack widths in mm via DepthPro, color-coded road maps, and downloadable PDF reports. No manual inspection. No spreadsheets.

**Tech stack:** Next.js 15 App Router · Supabase · Clerk auth · Tailwind CSS v4 · TypeScript  
**Target user:** Senior civil engineer at PWD/NHAI/EPC firm. Trusts tools that look rigorous. Pays ₹1,00,000/year for software that respects their professional judgment.  
**Design mandate:** This must look and feel like enterprise-grade infrastructure intelligence software — not a student project, not a generic SaaS template.

---

## 2. Design System Directive

### Aesthetic Direction: "Precision Instrument"
Think Bloomberg Terminal meets Mapbox Studio. Dark, dense, authoritative. Not tech-bro dark. Civil engineering dark — the kind of interface a field engineer trusts with government data. Every element earns its place. Nothing decorative that doesn't serve data.

**Tone:** Industrial-precision minimalism with controlled data density. Confident. Restrained. Exact.

**What makes it unforgettable:** Numbers that feel weighted. PCI scores that feel like verdicts, not labels. A dashboard that looks like it's already processing the next 50km of road.

### Color System
Keep the existing dark/amber brand — it's right. Refine it:
```
--bg-base:     #09090C   /* near-black, slightly blue-tinted */
--bg-surface:  #111116   /* card/panel backgrounds */
--bg-elevated: #1A1A22   /* modals, dropdowns */
--bg-border:   rgba(255,255,255,0.07)  /* subtle borders */
--bg-border-2: rgba(255,255,255,0.13)  /* hover borders */

--text-primary:   #F0F0F4   /* main text */
--text-secondary: #8A8A9A   /* labels, meta */
--text-muted:     #4A4A5A   /* disabled, placeholders */

--accent:         #F5A623   /* amber — primary CTA, active states */
--accent-dim:     rgba(245,166,35,0.12)  /* amber tints on cards */
--accent-hover:   #FFBE4D   /* lighter amber on hover */

/* PCI semantic colors — these are data, not decoration */
--pci-good:       #22C55E   /* PCI 85-100: Good */
--pci-satisfactory: #84CC16 /* PCI 70-84: Satisfactory */
--pci-fair:       #EAB308   /* PCI 55-69: Fair */
--pci-poor:       #F97316   /* PCI 40-54: Poor */
--pci-critical:   #EF4444   /* PCI 0-39: Critical */

--success:        #10B981
--warning:        #F59E0B
--danger:         #EF4444
--info:           #3B82F6
```

### Typography System
**DO NOT use:** Inter, Roboto, Arial, Space Grotesk, or any generic choice.

**Use this pairing:**
```css
/* Display / headings — authoritative, slightly technical */
font-family: 'DM Sans', sans-serif;   /* weights 400, 500, 600 */

/* Data / numbers / mono values — tabular figures, precision feel */
font-family: 'JetBrains Mono', monospace;   /* for PCI scores, frame counts, dates */

/* Body / labels */
font-family: 'DM Sans', sans-serif;   /* weight 400 regular */
```

**Type scale (rem):**
```
display:  2.5rem / 600   /* page hero titles */
h1:       1.75rem / 600
h2:       1.25rem / 500
h3:       1rem    / 500
body:     0.875rem / 400  /* 14px */
small:    0.75rem  / 400  /* 12px */
label:    0.6875rem / 500 / tracking-widest uppercase  /* section labels like "PAVEMENT INTELLIGENCE" */
mono:     JetBrains Mono for all numeric data
```

### Spacing System (8pt grid)
```
4px   — icon gap, tight inline
8px   — component internal padding
12px  — compact card padding
16px  — standard card padding
24px  — section gap
32px  — major section gap
48px  — page section separation
64px  — hero section breathing room
```

### Component Radius
```
sm: 6px    — badges, tags, chips
md: 10px   — buttons, inputs
lg: 14px   — cards, panels
xl: 20px   — modals, upload zones
```

### Shadows & Elevation (dark mode)
No white-style drop shadows. Use inner glow + border approach:
```css
/* card elevation */
border: 1px solid rgba(255,255,255,0.07);
background: #111116;

/* active/selected card */
border: 1px solid rgba(245,166,35,0.35);
background: rgba(245,166,35,0.06);

/* modal */
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 24px 80px rgba(0,0,0,0.6);
```

### Animation Principles (from ui-ux-pro-max §7)
- Duration: 150ms micro-interactions, 250ms page transitions, 400ms complex reveals
- Easing: ease-out for entering, ease-in for exiting (never linear)
- Only animate: opacity, transform — never width/height/top/left
- Stagger list items: 30-50ms per item
- Exit faster than enter (60-70% of enter duration)
- Every animation must express cause-effect, not be decorative
- Respect `prefers-reduced-motion`
- One orchestrated page-load reveal per page (staggered stat cards, then table rows)

---

## 3. Pages to Redesign — Detailed Spec Per Page

### PAGE 1: `/` — Marketing Landing Page

**Current problems:** Typography is brute-force weight without hierarchy. "Trusted by" section looks like a wireframe. Features grid has no visual rhythm. CTA section is bare.

**Redesign spec:**

#### Nav
```
[D] Drisora          How it works    Features    Pricing    Log in    [Get Started →]
```
- Frosted glass nav: `backdrop-blur(16px) background: rgba(9,9,12,0.85)`
- Left: logo mark (keep existing D mark) + wordmark in DM Sans 600
- Right: ghost text links + solid amber "Get Started" button (rounded-md, px-5 py-2)
- Sticky. 1px border-bottom on scroll only.

#### Hero Section
```
                        [• IRC:82-2023 COMPLIANT]        ← amber pill badge, mono font

    AUTOMATED ROAD                                        ← DM Sans 600, 72px, tight
    CONDITION                                             ← line 2
    [ASSESSMENT]                                          ← amber color for this word only

    Upload drone footage. Get a PCI-scored                ← 16px body, text-secondary
    geospatial report in minutes.                         

    [Get Started →]    [See how it works]                ← amber filled + ghost outline
```
- Full-width, min-height 100vh
- Background: keep #0A0A0A but add **subtle road-texture SVG grid** — thin orthogonal lines at 5% opacity suggesting road sections. Not noise. Engineering grid.
- Hero mockup (the road map visualization) must be **elevated** — put it in a realistic browser chrome frame with a title bar, subtle window controls (red/yellow/green dots), and a gradient fade at the bottom
- The mockup frame itself: rounded-xl, 1px amber/10% border, subtle inner glow

#### "Trusted By" Section
**Current: placeholder card grid. Redesign:**
```
BUILT FOR INDIA'S INFRASTRUCTURE SECTOR   ← label style uppercase tracking-widest

    PWD ————————————————— NHAI
    Public Works Departments               National Highways Authority

    ULBs ————————————————— EPC
    Municipal Corporations                 Engineering, Procurement & Construction

                    R&D
            Research Institutions
```
- NOT cards with borders. Use a **connection diagram layout** — entities arranged around a central "Drisora" hub, lines connecting them
- Or: clean two-column text list with amber identifier abbreviation (bold, large, amber) + right-aligned description text
- The amber abbreviations (PWD, NHAI, etc.) in JetBrains Mono 32px act as visual anchors

#### "From Flight to Report" — Process Section
**Keep the 3-step structure, upgrade execution:**
- Step numbers: `01 / 02 / 03` in amber JetBrains Mono 14px
- Connecting line between steps: 1px dashed amber/30%
- Terminal code blocks: refined — `background: #0D0D10`, `border: 1px solid rgba(255,255,255,0.08)`, `border-radius: 10px`, proper syntax highlighting with dim green for success lines
- Each step title in DM Sans 500 18px
- Add animated "processing" indicator on step 02 — subtle pulsing amber dot

#### Features Grid — "Everything the Field Team Needs"
**Current: 6 flat cards, equal weight, boring. Redesign:**
- Bento grid layout: not equal cards — feature 1 (YOLOv12s Detection) gets a wider card (2-col span)
- Each feature card has: `CATEGORY` label in amber uppercase tracking-widest → title → 2-line description → amber chip with key spec
- Hover: border goes from rgba(255,255,255,0.07) to rgba(245,166,35,0.30), background shifts to rgba(245,166,35,0.04)
- Stagger entrance animation: cards fade+translateY(12px) → 0 with 50ms delay each

#### CTA Section
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│         READY TO START?                              │  ← amber label
│                                                      │
│    Start your first survey.                          │  ← 48px DM Sans 600
│                                                      │
│    Upload a drone flight and receive a full          │
│    IRC:82-2023 compliant report in minutes.          │
│                                                      │
│    [Get Started →]    [See how it works]             │
│                                                      │
└─────────────────────────────────────────────────────┘
```
- The CTA box: `border: 1px solid rgba(245,166,35,0.20)`, radial gradient glow center: `radial-gradient(ellipse at 50% 100%, rgba(245,166,35,0.08) 0%, transparent 70%)`

#### Footer
```
[D] Drisora                     IRC:82-2023 · YOLOv12s · SAM2 · DepthPro
```
- Single-line footer. Minimal. Tech stack citation right-aligned in mono text-muted.

---

### PAGE 2: `/login` — Auth Page

**Current: logo + card + Google button, centered on near-black. Feels naked.**

**Redesign:**
- Split layout: left 55% = animated road grid background with large "Drisora" wordmark and tagline "Pavement Intelligence for India's Roads" — bottom: three logos/trust signals (IRC:82-2023, YOLOv12s, SAM2)
- Right 45% = auth panel, vertically centered, card with `background: #111116, border-radius: 20px, border: 1px solid rgba(255,255,255,0.10)`
- Inside card: Logo mark + "Welcome back" + "Sign in to your workspace" + Google button (white bg, dark text, Google icon SVG) + terms line
- Google button: `background: white, color: #111, border-radius: 8px, height: 48px` — standard Google branding
- On mobile: collapse to centered single-column, no split

---

### PAGE 3: `/dashboard` — Survey Operations

**Current: stat cards feel small and uniform. Table rows have no hierarchy. PCI numbers don't feel important.**

**Redesign:**

#### Page Header
```
PAVEMENT INTELLIGENCE                    ← amber label uppercase mono
Survey operations                        ← 28px DM Sans 600
22 total surveys · latest activity 19 May 2026  ← text-secondary 14px
                              [↻ Refresh]  [+ New Survey]  ← top-right
```

#### Stat Cards — CRITICAL UPGRADE
Four cards but NOT equal visual weight. Make them feel like instruments:
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ ACTIVE QUEUE     │  │ READY REPORTS    │  │ AVERAGE PCI      │  │ NEEDS REVIEW     │
│                  │  │                  │  │                  │  │                  │
│   0              │  │   22             │  │   83.6           │  │   1              │
│                  │  │  ───────────     │  │  Satisfactory    │  │  ⚠ below PCI 70  │
│   0 processing   │  │  3.0k frames     │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```
- All numbers in JetBrains Mono — they're data, treat them as data
- "22" and "83.6" should be visually larger than "0" — use conditional sizing: if value > 0, text is amber; if 0, text is text-muted
- "83.6" gets a PCI color band: a 3px left border in --pci-satisfactory color
- "1 Needs Review" card: amber/warning accent, subtle amber glow
- Card padding: 20px. Height: ~96px. Grid: 4 columns.

#### Survey Table — MAJOR UPGRADE
**Current: flat rows, same weight on all columns. Upgrade:**

Column hierarchy:
- `DATE` — primary: date in DM Sans 500 white, secondary: truncated UUID in mono text-muted below
- `MODE` — amber chip: `[✕ Drone Footage]` (keep the X/drone icon, amber border, amber text, transparent bg)
- `FRAMES` — mono right-aligned
- `AVG PCI` — this is the STAR of the table. Make it big and colored:
  - Number in JetBrains Mono 18px weight 500
  - Color = PCI semantic color (94.3 = green, 81.4 = amber, etc.)
  - Add a subtle 28px wide colored dot/bar left of the number
- `STATUS` — pill badge: green dot + "Complete" text. Use `background: rgba(34,197,94,0.12), color: #22C55E, border: 1px solid rgba(34,197,94,0.25)`
- `ACTIONS` — View (ghost) · PDF (ghost) · Delete (danger ghost, only shows red on hover)

Table refinements:
- Row hover: `background: rgba(255,255,255,0.03)` — barely there
- Header row: `background: #0D0D11`, text in 11px uppercase tracking-widest text-muted
- Row height: 56px
- Alternating rows: NO (too corporate). Use hover state only.
- Add a subtle left border on the PCI column header to signal it's the key metric

---

### PAGE 4: `/projects` — Asset Portfolio

**Current: project cards look underdeveloped. PCI badge is a yellow chip floating awkwardly.**

**Redesign:**

#### Stat Cards (same system as dashboard)
```
PROJECTS (2)  ·  LINKED SURVEYS (9)  ·  READY REPORTS (22)  ·  PORTFOLIO PCI (82.6)
```

#### Project Cards — Full Redesign
```
┌──────────────────────────────────────────────────────────────────────┐
│  PROJECT                                              PCI  83         │  ← amber badge, right
│                                                    ┌────────────┐    │
│  CBIT Campus                                       │ Satisfactory│    │
│  Gandipet, Hyderabad · Self                        └────────────┘    │
│                                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                              │
│  │ LINKED  │  │COMPLETE │  │ ACTIVE  │                              │
│  │    8    │  │    8    │  │    0    │                              │
│  └─────────┘  └─────────┘  └─────────┘                              │
│                                                                       │
│  Latest activity: 09 May 2026                                        │
└──────────────────────────────────────────────────────────────────────┘
```
- PCI badge: left border 4px in pci-semantic-color + number in mono + text label below
- The three mini-stat boxes inside the card: `background: rgba(255,255,255,0.04)` inset cards
- Card hover: left border accent in amber + background shift
- Location line in text-secondary italic

#### Unlinked Surveys Banner
```
⚠  13 survey uploads are not linked to a project yet.
   Open a project and use the assignment panel to attach them.
```
- `background: rgba(245,166,35,0.08), border: 1px solid rgba(245,166,35,0.25), border-radius: 10px`
- Amber warning icon left, text right

---

### PAGE 5: `/surveys` — Operations Tracker

**Current: empty state is generic. "No active uploads" text floats in a featureless box.**

**Redesign:**

#### Stat Cards
Same system. But `ACTIVE = 0` → number in text-muted. Any non-zero → amber number.

#### Empty State — MAJOR UPGRADE
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│           ↑                                                  │
│      [upload icon — large, outlined, amber]                  │
│                                                              │
│       No active uploads                                      │  ← 18px DM Sans 500
│                                                              │
│  Queued, processing, failed, and uploading surveys           │  ← text-secondary
│  will appear here. Completed outputs move to Reports.        │
│                                                              │
│                   [+ New Survey]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
- Empty state box: `border: 1px dashed rgba(255,255,255,0.12)` (dashed signals "nothing here yet, something should go here")
- Upload icon: 48px, thin stroke, amber color
- Minimum height: 280px, vertically centered content

#### Active Upload State (for when surveys ARE processing)
Design the processing state (even though it's empty now — build it):
- Progress row with: filename · size · mode chip · animated progress bar (amber fill) · status text
- Progress bar: `background: rgba(245,166,35,0.15)` track + `background: #F5A623` fill, height 3px, border-radius 2px
- Pulsing amber dot for "Processing" status

---

### PAGE 6: `/reports` — Completed Outputs

**Current: filter bar looks like a form, not a power tool. Table is same as dashboard but less interesting.**

**Redesign:**

#### Filter Bar — Upgrade to "Filter Panel"
```
┌─────────────────────────────────────────────────────────────────────┐
│  From [dd/mm/yyyy ▾]  To [dd/mm/yyyy ▾]  PCI [──●──] [──●──]       │
│  Project [All projects ▾]  Crack type [All types ▾]                  │
│                                              [Reset]  [Apply ▸]     │
└─────────────────────────────────────────────────────────────────────┘
```
- Inline filter bar, not a card — `background: #111116, border: 1px solid rgba(255,255,255,0.07)`
- PCI range: use a dual-handle range slider (amber handles, amber fill between handles)
- Apply button: amber solid. Reset: ghost.
- Inputs: `background: #0D0D11, border: 1px solid rgba(255,255,255,0.10), border-radius: 8px`

#### Reports Table
Same upgrades as dashboard table, plus:
- `REPORT` column: name in white + truncated ID in mono text-muted below
- `PROJECT` column: show "Unassigned" in italic text-muted when null
- `PCI` column: same colored number treatment
- `SOURCE` column: same mode chip
- `ACTIONS`: Quick view · Download PDF · Copy link — all ghost buttons, icon + text
- "Copy share link" → rename to "Copy link" and use a link icon
- Row count summary above table: "Showing 22 reports · Avg PCI 83.6" in text-secondary 13px

---

### PAGE 7: `/surveys/new` — New Survey Upload

**Current: This is actually the strongest app screen. Mostly upgrade polish.**

**Redesign:**

#### Upload Mode Cards (Image Batch / Handheld Video / Drone Footage)
- Non-selected: `border: 1px solid rgba(255,255,255,0.08), background: #111116`
- Selected (Drone Footage): `border: 1px solid rgba(245,166,35,0.50), background: rgba(245,166,35,0.08)` ← clearer selected state
- Icons: upgrade to 28px outlined icons, amber when selected, text-muted when not
- "Selected" text: replace with a checkmark indicator in top-right corner of card

#### Dropzone
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                                      │
│            ↑  (upload cloud icon, 40px amber)        │
│                                                      │
│      Drop drone video, or click to browse            │
│              MP4 or MOV                              │  ← mono 12px text-muted
│                                                      │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```
- `border: 2px dashed rgba(255,255,255,0.15), border-radius: 16px`
- On drag-over: `border-color: rgba(245,166,35,0.60), background: rgba(245,166,35,0.05)` — animated

#### Frame Extraction Options
- 4 options in a 2×2 grid
- Selected ("All frames"): `border: 1px solid rgba(245,166,35,0.50), background: rgba(245,166,35,0.08)` with amber checkmark
- Each option: title in 14px DM Sans 500 + subtitle in 12px text-secondary

---

### PAGE 8: `/team` — Organization

**Current: skeleton. Three role cards with "Placeholder" text. Needs a real design even before functionality arrives.**

**Redesign:**

#### Role Cards (Owner / Engineer / Reviewer)
Build them out as real role cards even if members are empty:
```
┌──────────────────────────────┐
│  ◆  Owner                    │  ← role icon (amber, unique per role)
│     Controls billing,        │
│     standards, project access │
│                              │
│  ────────────────────────── │
│                              │
│  + Invite member             │  ← amber ghost button
│                              │
│  [empty state: avatar stack] │
└──────────────────────────────┘
```
- Owner: shield icon
- Engineer: hard-hat or wrench icon  
- Reviewer: checkmark-circle icon
- All amber tinted

#### Coming Soon Banner
```
Full role-based collaboration — review, approval, and field-engineer workflows — coming in v2.
```
- Subtle amber banner at top of page

---

### PAGE 9: `/about` — Product Info

**Current: 2×2 card grid. Feels like a README rendered as UI.**

**Redesign:**

#### Logo + Brand Block
```
[D]  Drisora
     PAVEMENT AI                         ← keep amber "PAVEMENT AI" label
```
- Larger logo mark (48px)
- More breathing room around it

#### Content Cards — Editorial Upgrade
Replace the flat card grid with an **editorial layout**:
- "Product story" → full-width top card, 2-column text layout inside
- "AI stack" → card with a mini pipeline diagram: `YOLOv12s → SAM2 → DepthPro → IRC Scorer` drawn as connected nodes
- "Accuracy notes" + "IRC compliance" → side-by-side in second row
- "Contact" → full-width bottom, amber left border accent

---

### PAGE 10: `/profile/edit` — Edit Profile

**Current: unstyled form, feels like a dev form, not a settings page.**

**Redesign:**

#### Layout
- Max-width: 640px centered
- Sectioned form with labeled dividers:
  ```
  ── Identity ────────────────────────────────
  Full name        [input]   Organization [input]
  Role             [select]  Phone        [input]
  Avatar URL       [input — full width]

  ── Notifications ────────────────────────────
  [✓] Processing and report notifications
      Receive upload, completion, failure notifications

  ── Security ─────────────────────────────────
  Password recovery
  sreekarp4@gmail.com          [Send reset email]
  ```

#### Input Styles
```css
background: #0D0D11;
border: 1px solid rgba(255,255,255,0.10);
border-radius: 8px;
height: 44px;
padding: 0 14px;
font-family: DM Sans;
color: #F0F0F4;
/* focus: */
border-color: rgba(245,166,35,0.50);
outline: none;
box-shadow: 0 0 0 3px rgba(245,166,35,0.10);
```

#### Save Button
- `background: #F5A623, color: #09090C, font-weight: 600, border-radius: 8px, height: 44px, px: 24px`
- Full width at bottom of form on mobile

---

## 4. Global Component Library

### Navbar (App)
```
[D] Drisora  |  Dashboard  Projects  Surveys  Reports  Team  About  |  [Private]  [+ New Survey]  [S avatar]
```
- `background: #09090C, border-bottom: 1px solid rgba(255,255,255,0.07)`
- Height: 56px
- Active nav item: amber underline + white text (not a box/pill)
- "New Survey" button: amber solid, compact `px-4 py-1.5 text-sm`
- "Private" org label: `background: rgba(255,255,255,0.06), border-radius: 6px, px: 10px py: 4px, font-size: 12px, text-muted`

### Breadcrumb
```
Dashboard / Projects
```
- `font-size: 13px, text-muted`
- Separator: `/` in text-muted/50
- Last item: white

### Buttons
```
Primary:   bg-amber text-bg-base font-600 rounded-md px-4 py-2
Ghost:     border border-white/10 text-primary hover:border-white/20 hover:bg-white/5
Danger:    ghost default, hover: border-red/40 text-red
Icon:      32px square, border-white/10, hover:bg-white/5
```

### PCI Badge Component
```
<PCIBadge score={83} />
→ renders: amber bg rgba(245,166,35,0.15) + amber border + number + label
          left border 3px in pci-semantic-color
```

### Status Pills
```
Complete:    bg-green/10   border-green/25   text-green   dot
Processing:  bg-amber/10   border-amber/25   text-amber   dot (pulsing)
Failed:      bg-red/10     border-red/25     text-red     dot
Uploading:   bg-blue/10    border-blue/25    text-blue    dot
```

### Mode Chips
```
[✕ Drone Footage]   [⊞ Image Batch]   [▶ Handheld Video]
```
- `border: 1px solid rgba(245,166,35,0.30), color: amber, background: rgba(245,166,35,0.08), border-radius: 6px, text-xs mono`

### Section Labels
```
PAVEMENT INTELLIGENCE  /  ASSET PORTFOLIO  /  OPERATIONS  /  COMPLETED OUTPUTS
```
- `font-family: JetBrains Mono, font-size: 11px, letter-spacing: 0.15em, text-transform: uppercase, color: text-secondary`
- Add a 2px amber left border before them: `border-left: 2px solid #F5A623; padding-left: 10px`

---

## 5. UX Rules (from ui-ux-pro-max principles)

Apply these throughout every page:

**Accessibility:**
- Minimum 4.5:1 contrast ratio on all text
- All interactive elements have aria-labels
- Focus states: `outline: 2px solid rgba(245,166,35,0.70); outline-offset: 2px`
- Color is never the ONLY indicator — PCI states use color + label + left border

**Touch & Interaction:**
- All touch targets minimum 44×44px
- `cursor: pointer` on all clickable elements
- Button loading state: disable + spinner during async
- Hover states on table rows, cards, buttons — all 150ms transitions

**Data Display:**
- ALL numbers in JetBrains Mono (tabular figures, prevents layout shift)
- PCI scores: always colored by band, never plain white
- Dates: consistent format "DD Mon YYYY" (not "dd/mm/yyyy" in table)
- Truncated UUIDs: always mono, always text-muted, always 10 chars max + "..."

**Loading States:**
- Skeleton screens (not spinners) for tables >1s load
- Skeleton: `background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)` animated shimmer

**Navigation:**
- Active page in nav: amber underline, white text
- Breadcrumb on every inner page
- "New Survey" CTA always visible in navbar — it's the primary action of the entire app

**Forms:**
- Visible labels above every input (no placeholder-only labels)
- Error messages below the specific field, in red, with icon
- Success feedback inline, not modal-only

**Empty States:**
- Every empty state has: icon + title + description + CTA
- Dashed borders signal "nothing here yet"
- Never a blank white/dark void

---

## 6. Implementation Notes for Next.js 15

```typescript
// Tailwind CSS v4 config additions needed:
// Custom font variables
// Custom color tokens as CSS variables
// Custom animation utilities

// Font loading in layout.tsx:
import { DM_Sans, JetBrains_Mono } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})
```

**CSS Variables (globals.css):**
```css
:root {
  --font-sans: var(--font-dm-sans), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), 'Courier New', monospace;
  
  /* All color tokens listed in Section 2 */
}
```

**Do NOT use:** shadcn/ui default theming (it will fight with this design). Build components from scratch or copy paste with full style override.

**Tailwind classes to create:**
```
text-amber     → color: #F5A623
bg-amber       → background: #F5A623
border-amber   → border-color: #F5A623
pci-good       → color: #22C55E
pci-fair       → color: #EAB308
pci-poor       → color: #F97316
pci-critical   → color: #EF4444
font-mono      → font-family: var(--font-mono)
label-style    → font-mono uppercase tracking-widest text-xs text-secondary
```

---

## 7. The One Rule Above All Others

> Every screen must make a PWD engineer feel like they're operating a **precision instrument**, not filling out a web form. The data is serious. The software must look serious. Dark, exact, authoritative — like STAAD.Pro if it had a good designer.

---

## Deliverable

Implement the complete redesign across all pages listed above. Start with:
1. `globals.css` — full CSS variable system + font imports
2. Shared components: Navbar, Breadcrumb, StatCard, PCIBadge, StatusPill, ModeChip, SectionLabel, Button variants, Input, EmptyState
3. Then page by page in this order: Dashboard → Projects → Reports → Surveys → New Survey → Team → About → Login → Landing

For each page, output the complete Next.js component with full Tailwind classes. No placeholder "// TODO" sections. Complete, production-ready code.
