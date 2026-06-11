import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/dashboard/Navbar";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { PageTransition } from "@/components/ui/PageTransition";
import { ConsentSync } from "@/components/legal/ConsentSync";
import { ReConsentModal } from "@/components/legal/ReConsentModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, org_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  // Most recent consent record drives the re-consent gate. Ordered by acceptance
  // time so the latest accepted versions win. A missing record (null) also
  // triggers the modal, covering legacy users who signed up before consent capture.
  const { data: consent } = await supabase
    .from("consent_records")
    .select("tos_version, pp_version, dob")
    .eq("user_id", user.id)
    .order("tos_accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#09090C] text-[#F0F0F4]">
      <ConsentSync />
      <ReConsentModal
        acceptedTos={consent?.tos_version ?? null}
        acceptedPrivacy={consent?.pp_version ?? null}
        dob={consent?.dob ?? null}
      />
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />
      <PageTransition>{children}</PageTransition>
      <footer className="border-t border-[rgba(255,255,255,0.07)] px-6 py-5 text-center font-mono text-[11px] text-[#4A4A5A]">
        <a href="/about" className="transition-colors duration-150 hover:text-[#8A8A9A]">About Drisora</a>
        <span className="mx-2 text-[#2A2A33]">·</span>
        <a href="/legal/terms" className="transition-colors duration-150 hover:text-[#8A8A9A]">Terms</a>
        <span className="mx-2 text-[#2A2A33]">·</span>
        <a href="/legal/privacy" className="transition-colors duration-150 hover:text-[#8A8A9A]">Privacy</a>
      </footer>
    </div>
  );
}
