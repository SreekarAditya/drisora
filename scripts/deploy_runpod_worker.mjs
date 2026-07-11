#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "skip-build" || key === "skip-push" || key === "dry-run") {
      parsed[key] = true;
      continue;
    }
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function loadEnvFile(filePath) {
  const absolute = path.join(rootDir, filePath);
  if (!existsSync(absolute)) return {};
  const values = {};
  for (const rawLine of readFileSync(absolute, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || "";
    throw new Error(`${command} ${args.join(" ")} failed\n${detail}`);
  }
  return result.stdout || "";
}

function gitValue(args, fallback = "unknown") {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    stdio: "pipe",
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : fallback;
}

function requireValue(env, name) {
  if (!env[name]) throw new Error(`Missing ${name}`);
  return env[name];
}

function templateEnv(env, existing) {
  const map = new Map((existing || []).map((item) => [item.key, item.value]));
  const directKeys = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "NEXT_PUBLIC_APP_URL",
    "APP_CALLBACK_URL",
    "WORKER_WEBHOOK_SECRET",
    "CLOUDFLARE_R2_WEBHOOK_SECRET",
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET_NAME",
    "OBJECT_STORAGE_ENDPOINT_URL",
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "OBJECT_STORAGE_BUCKET",
    "DRISORA_DETERMINISTIC_SEED",
    "DRISORA_DETERMINISTIC_EXTRACTOR",
    "DRISORA_YOLO_BATCH_SIZE",
    "DRISORA_YOLO_WEIGHTS_PATH",
    "DRISORA_YOLO_WEIGHTS_URL",
    "DRISORA_YOLO_WEIGHTS_SHA256",
    "SAM2_MODEL_PATH",
    "SAM2_MODEL_URL",
    "SAM2_MODEL_CFG",
    "SAM2_MODEL_SHA256",
  ];

  for (const key of directKeys) {
    if (env[key]) map.set(key, env[key]);
  }
  if (!map.has("WORKER_WEBHOOK_SECRET") && env.RUNPOD_CALLBACK_SECRET) {
    map.set("WORKER_WEBHOOK_SECRET", env.RUNPOD_CALLBACK_SECRET);
  }
  if (!map.has("NEXT_PUBLIC_APP_URL") && env.APP_CALLBACK_URL) {
    map.set("NEXT_PUBLIC_APP_URL", env.APP_CALLBACK_URL);
  }

  // Deployed scientific path is pinned to the checkpoints verified in the image.
  map.set("DRISORA_YOLO_WEIGHTS_PATH", "/opt/models/yolov12s_rdd2022.pt");
  map.set("DRISORA_YOLO_WEIGHTS_SHA256", "138d3c738d53fdb9dd53297607bc612a4835c0554d3c1acb3f272d9987ee3cb3");
  map.set("SAM2_MODEL_PATH", "/opt/models/sam2.1_hiera_small.pt");
  map.set("SAM2_MODEL_URL", "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt");
  map.set("SAM2_MODEL_CFG", "configs/sam2.1/sam2.1_hiera_s.yaml");
  map.set("SAM2_MODEL_SHA256", "6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38");
  for (const key of Array.from(map.keys())) {
    if (
      key.startsWith("DEPTH_ANYTHING_V2_") ||
      [
        "DRISORA_DEPTH_BATCH_SIZE",
        "DRISORA_ENABLE_DEPTH_DEFAULT",
        "DRISORA_WARM_SAM2",
        "RUNPOD_API_KEY",
      ].includes(key)
    ) {
      map.delete(key);
    }
  }

  return Array.from(map, ([key, value]) => ({ key, value }));
}

async function runpodGraphql(apiKey, query, variables = {}) {
  const res = await fetch(`https://api.runpod.io/graphql?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) {
    throw new Error(JSON.stringify(body.errors || body, null, 2));
  }
  return body.data;
}

function resolveDigest(image) {
  if (image.includes("@sha256:")) return image;
  const output = run("docker", ["buildx", "imagetools", "inspect", image], { capture: true });
  const digest = output.match(/^Digest:\s+(sha256:[a-f0-9]+)/m)?.[1];
  return digest ? `${image}@${digest}` : image;
}

const args = parseArgs(process.argv.slice(2));
const fileEnv = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...loadEnvFile("worker/.env"),
};
const env = { ...fileEnv, ...process.env };
const gitSha = gitValue(["rev-parse", "HEAD"]);
const shortSha = gitValue(["rev-parse", "--short=12", "HEAD"], "local");
const image = args.image || env.DRISORA_WORKER_IMAGE || `sreekaraditya/drisora-worker:serverless-${shortSha}`;
const platform = args.platform || env.DRISORA_WORKER_PLATFORM || "linux/amd64";
const dockerfile = args.dockerfile || "worker/Dockerfile";
const context = args.context || "worker";

if (!args["skip-build"]) {
  const buildArgs = [
    "buildx",
    "build",
    "--platform",
    platform,
    "--build-arg",
    `DRISORA_BUILD_SHA=${gitSha}`,
    "-f",
    dockerfile,
    "-t",
    image,
    context,
  ];
  if (!args["skip-push"]) buildArgs.push("--push");
  run("docker", buildArgs);
} else if (!args["skip-push"]) {
  run("docker", ["push", image]);
}

const imageName = args["image-name"] || resolveDigest(image);
const apiKey = requireValue(env, "RUNPOD_API_KEY");
const endpointId = args.endpoint || requireValue(env, "RUNPOD_ENDPOINT_ID");

const endpointsData = await runpodGraphql(
  apiKey,
  `query {
    myself {
      endpoints {
        id
        name
        templateId
      }
    }
  }`,
);
const endpoint = endpointsData.myself.endpoints.find((item) => item.id === endpointId);
if (!endpoint) throw new Error(`RunPod endpoint not found: ${endpointId}`);
const templateId = args.template || env.RUNPOD_TEMPLATE_ID || endpoint.templateId;

const templateData = await runpodGraphql(
  apiKey,
  `query Template($id: String!) {
    podTemplate(id: $id) {
      id
      name
      imageName
      dockerArgs
      containerDiskInGb
      volumeInGb
      volumeMountPath
      ports
      isServerless
      containerRegistryAuthId
      env {
        key
        value
      }
    }
  }`,
  { id: templateId },
);
const template = templateData.podTemplate;
if (!template) throw new Error(`RunPod template not found: ${templateId}`);

const input = {
  id: template.id,
  name: template.name,
  imageName,
  dockerArgs: template.dockerArgs || "python handler.py",
  containerDiskInGb: template.containerDiskInGb ?? 30,
  volumeInGb: template.volumeInGb ?? 0,
  isServerless: true,
  env: templateEnv(env, template.env),
};
for (const optionalKey of ["volumeMountPath", "ports", "containerRegistryAuthId"]) {
  if (template[optionalKey]) input[optionalKey] = template[optionalKey];
}

if (args["dry-run"]) {
  console.log(
    JSON.stringify(
      {
        endpointId,
        templateId,
        imageName,
        dockerArgs: input.dockerArgs,
        isServerless: input.isServerless,
        envKeys: input.env.map((item) => item.key),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const updated = await runpodGraphql(
  apiKey,
  `mutation SaveTemplate($input: SaveTemplateInput!) {
    saveTemplate(input: $input) {
      id
      name
      imageName
      dockerArgs
      containerDiskInGb
      volumeInGb
      isServerless
    }
  }`,
  { input },
);

console.log(
  JSON.stringify(
    {
      endpointId,
      templateId,
      imageName: updated.saveTemplate.imageName,
      dockerArgs: updated.saveTemplate.dockerArgs,
      isServerless: updated.saveTemplate.isServerless,
    },
    null,
    2,
  ),
);
