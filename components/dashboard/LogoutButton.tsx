"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/landing");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-[rgba(255,255,255,0.10)] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-colors hover:border-white/20 hover:bg-white/5 hover:text-[#F0F0F4]"
    >
      Log out
    </button>
  );
}
