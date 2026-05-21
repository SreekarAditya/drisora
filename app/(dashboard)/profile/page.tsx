import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, org_name, role, phone, avatar_url, notifications_enabled")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <header className="mb-8 border-b border-[rgba(255,255,255,0.07)] pb-6">
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
          <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
          Account
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">Edit Profile</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8A8A9A]">
          Keep engineer identity, organization details, contact information, avatar, notifications, and password recovery current.
        </p>
      </header>

      <section className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6">
        <ProfileForm email={user.email ?? ""} profile={profile} />
      </section>
    </main>
  );
}
