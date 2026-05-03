const RUNPOD_BASE = "https://api.runpod.ai/v2";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function triggerRunpodJob(payload: Record<string, unknown>) {
  const endpointId = requireEnv("RUNPOD_ENDPOINT_ID");
  const apiKey = requireEnv("RUNPOD_API_KEY");

  const res = await fetch(`${RUNPOD_BASE}/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod trigger failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function submitRunpodJob(input: {
  job_id: string;
  user_id: string;
  project_id?: string | null;
  mode: string;
  r2_prefix: string;
  file_names: string[];
  options: Record<string, unknown>;
}) {
  const data = (await triggerRunpodJob(input)) as { id?: string };
  if (!data.id) {
    throw new Error("RunPod submission response did not include an id");
  }
  return data.id;
}
