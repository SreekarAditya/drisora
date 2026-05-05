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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />
      <PageTransition>{children}</PageTransition>
      <footer className="border-t border-white/[0.07] px-6 py-5 text-center text-xs text-gray-700">
        <a href="/about" className="transition-colors duration-150 hover:text-gray-400">About Drisora</a>
      </footer>
    </div>
  );
}
