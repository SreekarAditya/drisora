export default function TeamPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
          Organization
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Team</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Role-based review, approval, and field-engineer collaboration will live here.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Owner", "Controls billing, standards, and project access."],
          ["Engineer", "Uploads surveys, reviews PCI, and prepares reports."],
          ["Reviewer", "Approves mitigation plans before submission."],
        ].map(([role, desc]) => (
          <div key={role} className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <h2 className="text-lg font-semibold text-white">{role}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{desc}</p>
            <span className="mt-5 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-500">
              Placeholder
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
