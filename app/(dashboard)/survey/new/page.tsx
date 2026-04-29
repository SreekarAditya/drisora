import { redirect } from "next/navigation";
import { NewSurveyForm } from "@/components/upload/NewSurveyForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewSurveyPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-amber-500">Upload</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">New Survey</h1>
      </div>
      <NewSurveyForm />
    </main>
  );
}
