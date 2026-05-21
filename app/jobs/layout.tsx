import { redirect } from "next/navigation";
import { Navbar } from "@/components/dashboard/Navbar";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="min-h-screen bg-[#09090C] text-[#F0F0F4]">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />
      {children}
    </div>
  );
}
