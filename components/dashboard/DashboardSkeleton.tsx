function Skeleton({ className }: { className: string }) {
  return (
    <div className={`animate-skeleton rounded ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.07)] pb-6">
        <div>
          <Skeleton className="mb-3 h-3 w-36" />
          <Skeleton className="mb-2 h-8 w-52" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-10 w-24 rounded-[10px]" />
          <Skeleton className="h-10 w-32 rounded-[10px]" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-5">
            <Skeleton className="mb-3 h-2.5 w-24" />
            <Skeleton className="mb-3 h-7 w-16" />
            <Skeleton className="h-2 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
        <div className="border-b border-[rgba(255,255,255,0.07)] bg-[#111116] px-6 py-3">
          <Skeleton className="h-2.5 w-72" />
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.05)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="ml-4 h-5 w-28 rounded-[6px]" />
              <Skeleton className="ml-4 h-3 w-10" />
              <Skeleton className="ml-4 h-5 w-10" />
              <Skeleton className="ml-4 h-6 w-20 rounded-[6px]" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-7 w-14 rounded-[8px]" />
                <Skeleton className="h-7 w-14 rounded-[8px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
