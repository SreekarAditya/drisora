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
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-white">Uploading video</p>
        <p className="mt-1 text-sm text-gray-400">Keep this page open until upload completes.</p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>

      <div className="grid gap-3 text-sm text-gray-400 sm:grid-cols-3">
        <p>
          <span className="block text-xl font-semibold text-white">{pct}%</span>
          Complete
        </p>
        <p>
          <span className="block text-xl font-semibold text-white">
            {formatBytes(bytesUploaded)}
          </span>
          of {formatBytes(totalBytes)}
        </p>
        <p>
          <span className="block text-xl font-semibold text-white">{speedMbps.toFixed(1)}</span>
          MB/s
        </p>
      </div>
    </div>
  );
}
