export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
          Product
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">About Drisora</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Drisora turns drone footage and telemetry into engineering-grade pavement condition intelligence for PWD, NHAI, municipal, and EPC teams.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          ["Product story", "Road engineers need evidence that survives technical review, not just annotated frames. Drisora organizes every survey into projects, PCI trends, maps, crack metrics, and concise maintenance reports."],
          ["AI stack", "YOLOv12s detects distress, SAM2 refines crack masks, and Depth Pro estimates camera-to-surface distance for pixel-to-mm crack-width conversion."],
          ["Accuracy notes", "Outputs should be reviewed against field observations, surface texture, lighting, speed, and telemetry quality. Depth-derived crack width is reported as an engineering estimate, not a lab gauge measurement."],
          ["IRC compliance", "PCI bands, 10 m section reporting, severity language, and intervention prioritization are aligned with IRC:82-2023 pavement maintenance decision workflows."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">{body}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="text-lg font-semibold text-white">Contact</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          For deployment, model validation, or agency-specific reporting templates, contact the Drisora team at support@drisora.com.
        </p>
      </section>
    </main>
  );
}
