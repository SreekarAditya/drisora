import { UploadClient } from "@/components/upload/UploadClient";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            New survey
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Upload capture media, lock the input set, then send it into the processing queue.
          </p>
        </div>
      </header>

      <UploadClient />
    </main>
  );
}
