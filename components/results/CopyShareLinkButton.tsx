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
      className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2 text-sm font-semibold text-[#8A8A9A] transition-all duration-150 hover:border-[rgba(245,166,35,0.30)] hover:text-[#F5A623]"
    >
      {copied ? "Copied" : "Copy share link"}
    </button>
  );
}
