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

export function ResultsSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-32 rounded-md" />
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
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
}
