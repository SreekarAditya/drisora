import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold">Drisora</h1>
      <p className="text-gray-600">Survey roads, process detections, and generate PCI-ready reports.</p>
      <div className="flex gap-3">
        <Link className="rounded bg-black px-4 py-2 text-white" href="/login">
          Login
        </Link>
        <Link className="rounded border px-4 py-2" href="/signup">
          Sign up
        </Link>
      </div>
    </main>
  );
}
