import { createHmac, timingSafeEqual } from "crypto";

interface ReportTokenPayload {
  surveyId: string;
  exp: number;
}

function secret() {
  const value = process.env.REPORT_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error("Missing REPORT_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }

  return value;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createReportToken(surveyId: string, ttlSeconds = 120) {
  const payload: ReportTokenPayload = {
    surveyId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyReportToken(token: string | null | undefined, surveyId: string) {
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as ReportTokenPayload;
    return payload.surveyId === surveyId && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
