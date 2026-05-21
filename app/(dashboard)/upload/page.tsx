import { UploadClient } from "@/components/upload/UploadClient";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(255,255,255,0.07)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
            <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
            Intake
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">
            New survey
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-[#8A8A9A]">
            Upload capture media, lock the input set, then send it into the processing queue.
          </p>
        </div>
      </header>

      <UploadClient />
    </main>
  );
}
