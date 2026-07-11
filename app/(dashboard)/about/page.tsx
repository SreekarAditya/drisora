import { DrisoraLogo } from "@/components/branding/DrisoraLogo";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 border-b border-[rgba(255,255,255,0.07)] pb-8">
        <DrisoraLogo size="lg" showSubtext />
        <p className="mt-8 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
          <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
          Product
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">About Drisora</h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-[#8A8A9A]">
          Drisora turns drone footage and telemetry into engineering-grade pavement condition intelligence for PWD, NHAI, municipal, and EPC teams.
        </p>
      </header>

      <section className="space-y-4">
        <article className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
          <h2 className="text-lg font-semibold text-white">Product story</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <p className="text-sm leading-6 text-[#8A8A9A]">
              Road engineers need evidence that survives technical review, not just annotated frames. Drisora organizes calibrated section bounds, detections, maps, and measurement provenance into projects.
            </p>
            <p className="text-sm leading-6 text-[#8A8A9A]">
              A configured drone flight produces a scoped partial assessment. Unmeasured functional inputs stay null and field verification remains necessary.
            </p>
          </div>
        </article>

        <article className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
          <h2 className="text-lg font-semibold text-white">AI stack</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {["Drisora AI", "SAM2 Masks", "GSD Calibration", "PCI Bounds"].map((node, i) => (
              <div key={node} className="flex items-center gap-3">
                <span className="rounded-[8px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)] px-3 py-1.5 font-mono text-[12px] font-medium text-[#F5A623]">
                  {node}
                </span>
                {i < 3 && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#4A4A5A]">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#8A8A9A]">
            Drisora AI detects trained distress classes, SAM2 refines masks, relative AGL and explicit camera geometry establish GSD, and cross-frame georeferencing prevents duplicate area counting.
          </p>
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
            <h2 className="text-lg font-semibold text-white">Accuracy notes</h2>
            <p className="mt-3 text-sm leading-6 text-[#8A8A9A]">
              Outputs must be reviewed against field observations, surface texture, lighting, speed, GPS quality, camera calibration, and the reported GSD area uncertainty.
            </p>
          </article>
          <article className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
            <h2 className="text-lg font-semibold text-white">IRC scope</h2>
            <p className="mt-3 text-sm leading-6 text-[#8A8A9A]">
              Only cracking extent and pothole number are instrumented, representing 28% of Table 5.4 weight. Roughness, ravelling, patching, and rut depth remain unmeasured, so PCI is an interval rather than a point.
            </p>
          </article>
        </div>

        <article className="rounded-[14px] border-l-[3px] border-[#F5A623] bg-[#111116] p-6">
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p className="mt-3 text-sm leading-6 text-[#8A8A9A]">
            For deployment, model validation, or agency-specific reporting templates, contact the Drisora team at support@drisora.com.
          </p>
        </article>
      </section>
    </main>
  );
}
