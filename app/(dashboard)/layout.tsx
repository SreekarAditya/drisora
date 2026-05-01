import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/dashboard/Navbar";

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
    .select("full_name, org_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar user={user} profile={profile} />
      {children}
    </div>
  );
}
