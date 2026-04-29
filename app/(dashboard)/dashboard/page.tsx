import { redirect } from "next/navigation";
import { SurveyList } from "@/components/dashboard/SurveyList";
import { createClient } from "@/lib/supabase/server";
import type { Survey } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: surveys, error } = await supabase
    .from("surveys")
    .select("id, user_id, name, location, engineer_name, surveyed_at, created_at, status, average_pci")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load surveys: ${error.message}`);
  }

  return <SurveyList surveys={(surveys ?? []) as Survey[]} />;
}
