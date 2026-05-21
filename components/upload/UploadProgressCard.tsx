interface UploadProgressCardProps {
  pct: number;
  bytesUploaded: number;
  totalBytes: number;
  speedMbps: number;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function UploadProgressCard({
  pct,
  bytesUploaded,
  totalBytes,
  speedMbps,
}: UploadProgressCardProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-[#F5A623]" />
          <p className="text-lg font-semibold text-white">Uploading video</p>
        </div>
        <p className="mt-1 text-[13px] text-[#8A8A9A]">Keep this page open until upload completes.</p>
      </div>

      <div className="h-[3px] overflow-hidden rounded-full bg-[rgba(245,166,35,0.15)]">
        <div
          className="h-full rounded-full bg-[#F5A623] transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
          <span className="block font-mono text-xl font-semibold text-white">{pct}%</span>
          <span className="text-[12px] text-[#8A8A9A]">Complete</span>
        </div>
        <div className="rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
          <span className="block font-mono text-xl font-semibold text-white">{formatBytes(bytesUploaded)}</span>
          <span className="text-[12px] text-[#8A8A9A]">of {formatBytes(totalBytes)}</span>
        </div>
        <div className="rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
          <span className="block font-mono text-xl font-semibold text-white">{speedMbps.toFixed(1)}</span>
          <span className="text-[12px] text-[#8A8A9A]">MB/s</span>
        </div>
      </div>
    </div>
  );
}
