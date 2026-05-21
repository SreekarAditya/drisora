function Skeleton({ className }: { className: string }) {
  return (
    <div className={`animate-skeleton rounded-[8px] bg-[rgba(255,255,255,0.04)] ${className}`} />
  );
}

export function ResultsSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090C]">
      <div className="border-b border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-32 rounded-[8px]" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <Skeleton className="h-[400px] w-full rounded-[14px]" />
      </div>
    </div>
  );
}
