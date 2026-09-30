export default function TeamPage() {
  const roles = [
    {
      role: "Owner",
      desc: "Controls billing, standards, project access",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      role: "Engineer",
      desc: "Uploads surveys, reviews PCI, and prepares reports",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      role: "Reviewer",
      desc: "Approves mitigation plans before submission",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 rounded-[14px] border border-[rgba(245,166,35,0.25)] bg-[rgba(245,166,35,0.06)] px-5 py-3">
        <p className="text-[13px] text-[#F5A623]">
          Full role-based collaboration — review, approval, and field-engineer workflows — coming in v2.
        </p>
      </div>

      <header className="mb-8 border-b border-[rgba(255,255,255,0.07)] pb-6">
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
          <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
          Organization
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">Team</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8A8A9A]">
          Role-based review, approval, and field-engineer collaboration will live here.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {roles.map(({ role, desc, icon }) => (
          <div key={role} className="flex flex-col rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)]">
              {icon}
            </div>
            <h2 className="text-lg font-semibold text-white">{role}</h2>
            <p className="mt-2 text-sm leading-6 text-[#8A8A9A]">{desc}</p>
            <div className="mt-auto border-t border-[rgba(255,255,255,0.07)] pt-5">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(245,166,35,0.30)] bg-transparent px-4 py-2 text-sm font-medium text-[#F5A623] opacity-50 cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Invite member
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
