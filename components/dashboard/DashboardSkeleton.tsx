function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`rounded bg-[#1a1a1a] ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-x 1.6s infinite",
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-4">
            <Skeleton className="mb-2 h-2.5 w-24" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-2 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] bg-[#0f0f0f] px-6 py-3">
          <Skeleton className="h-2.5 w-72" />
        </div>
        <div className="divide-y divide-[#141414]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3.5">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="ml-4 h-5 w-28 rounded-full" />
              <Skeleton className="ml-4 h-3 w-10" />
              <Skeleton className="ml-4 h-3 w-10" />
              <Skeleton className="ml-4 h-6 w-20 rounded-full" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-7 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
