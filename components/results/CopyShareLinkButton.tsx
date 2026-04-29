"use client";

import { useState } from "react";

interface CopyShareLinkButtonProps {
  path: string;
}

export function CopyShareLinkButton({ path }: CopyShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-500 hover:text-amber-400"
    >
      {copied ? "Copied" : "Copy share link"}
    </button>
  );
}
