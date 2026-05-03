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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Edit Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Keep engineer identity, organization details, contact information, avatar, notifications, and password recovery current.
        </p>
      </header>

      <section className="rounded-lg border border-white/10 bg-[#0b0c0d] p-6">
        <ProfileForm email={user.email ?? ""} profile={profile} />
      </section>
    </main>
  );
}
