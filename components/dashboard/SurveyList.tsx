import Link from "next/link";
import type { Survey } from "@/types";
import { SurveyCard } from "@/components/dashboard/SurveyCard";

interface SurveyListProps {
  surveys: Survey[];
}

export function SurveyList({ surveys }: SurveyListProps) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Surveys</h1>
        <Link
          href="/survey/new"
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          New Survey
        </Link>
      </div>

      {surveys.length === 0 ? (
        <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#0d0d0d] px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-2xl font-light text-amber-400">
            +
          </div>
          <p className="text-base text-gray-400">No surveys yet. Upload your first road survey.</p>
          <Link
            href="/survey/new"
            className="mt-5 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Upload now
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((survey) => (
            <SurveyCard key={survey.id} survey={survey} />
          ))}
        </section>
      )}
    </main>
  );
}
