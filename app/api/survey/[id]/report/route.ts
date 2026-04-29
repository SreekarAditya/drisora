import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { createReportToken } from "@/lib/report-token";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REPORT_BUCKET = "reports";
const REPORT_TTL_SECONDS = 60 * 60;

async function signedReportUrl(path: string) {
  const serviceSupabase = createServiceRoleClient();
  const { data, error } = await serviceSupabase.storage
    .from(REPORT_BUCKET)
    .createSignedUrl(path, REPORT_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create report signed URL");
  }

  return data.signedUrl;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select("id, user_id, report_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  try {
    if (survey.report_path) {
      return NextResponse.json({ url: await signedReportUrl(survey.report_path) });
    }

    const headerStore = await headers();
    const host = headerStore.get("host");
    const protocol = headerStore.get("x-forwarded-proto") ?? "http";

    if (!host) {
      return NextResponse.json({ error: "Missing request host" }, { status: 500 });
    }

    const token = createReportToken(id);
    const reportUrl = `${protocol}://${host}/report/${id}?token=${encodeURIComponent(token)}`;
    const browser = await chromium.launch({ headless: true });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 60_000 });
      await page.emulateMedia({ media: "print" });
      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });
    } finally {
      await browser.close();
    }

    const reportPath = `reports/${id}/report.pdf`;
    const serviceSupabase = createServiceRoleClient();
    const { error: uploadError } = await serviceSupabase.storage
      .from(REPORT_BUCKET)
      .upload(reportPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: updateError } = await serviceSupabase
      .from("surveys")
      .update({ report_path: reportPath })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: await signedReportUrl(reportPath) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    );
  }
}
