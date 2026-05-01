import { UploadClient } from "@/components/upload/UploadClient";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          New survey
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Choose how you captured your road footage. We&apos;ll handle the rest.
        </p>
      </header>

      <UploadClient />
    </main>
  );
}
