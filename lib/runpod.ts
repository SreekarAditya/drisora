const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
  throw new Error("Missing RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID");
}

const RUNPOD_BASE = "https://api.runpod.io/v2";

export async function triggerRunpodJob(payload: Record<string, unknown>) {
  const res = await fetch(`${RUNPOD_BASE}/${RUNPOD_ENDPOINT_ID}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input: payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod trigger failed (${res.status}): ${text}`);
  }

  return res.json();
}
