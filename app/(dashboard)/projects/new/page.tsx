import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 border-b border-[rgba(255,255,255,0.10)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#4A4A5A]">
          Project setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#F0F0F4]">
          Create project
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8A8A9A]">
          Use projects for a road stretch, highway package, concession section, or city zone.
          Multiple survey dates and overlapping runs can be linked under one engineering view.
        </p>
      </header>

      <section className="rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0b0c0d] p-6">
        <ProjectCreateForm />
      </section>
    </main>
  );
}
