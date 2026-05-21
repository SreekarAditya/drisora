import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/dashboard/Navbar";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { PageTransition } from "@/components/ui/PageTransition";

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

  return (
    <div className="min-h-screen bg-[#09090C] text-[#F0F0F4]">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />
      <PageTransition>{children}</PageTransition>
      <footer className="border-t border-[rgba(255,255,255,0.07)] px-6 py-5 text-center font-mono text-[11px] text-[#4A4A5A]">
        <a href="/about" className="transition-colors duration-150 hover:text-[#8A8A9A]">About Drisora</a>
      </footer>
    </div>
  );
}
