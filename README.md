This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Core verification commands:

```bash
npm run lint
npm run typecheck
npm run test:worker
npm run eval:sample
npm run build
```

Or run the combined artifact gate:

```bash
npm run verify
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Research Artifact

Drisora's paper track is a systems-artifact paper, not a detector benchmark paper. The current artifact path lives in:

- [`docs/DRISORA_RESEARCH_READINESS.md`](docs/DRISORA_RESEARCH_READINESS.md)
- [`docs/DRISORA_ARTIFACT_GUIDE.md`](docs/DRISORA_ARTIFACT_GUIDE.md)
- [`docs/DRISORA_SYSTEM_PAPER_DRAFT.md`](docs/DRISORA_SYSTEM_PAPER_DRAFT.md)
- [`evaluation/README.md`](evaluation/README.md)

The evaluation command validates segment labels and generates deterministic metrics/tables from frozen exports:

```bash
node evaluation/drisora_eval.mjs compute \
  --export evaluation/fixtures/sample_export.json \
  --labels evaluation/fixtures/sample_labels.json \
  --out evaluation/output/sample
```

## Cloudflare R2 CORS Setup

File uploads go directly from the browser to R2 using presigned PUT URLs. The CORS policy must be applied to the R2 bucket before uploads will work.

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 → your bucket → **Settings** → **CORS policy**
2. Paste the contents of [`worker/R2_CORS_CONFIG.json`](worker/R2_CORS_CONFIG.json)
3. Save

Without this, browsers will block the cross-origin PUT requests.

## Environment Variables

Copy `.env.local.example` and fill in the values before running locally.

**Next.js (`.env.local`):**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for trusted server routes |
| `REPORT_TOKEN_SECRET` | Secret for signed report preview/download links |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API token key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public R2 URL (optional, for serving results) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CLOUDFLARE_R2_WEBHOOK_SECRET` | Shared secret for worker → Next.js webhook |
| `WORKER_WEBHOOK_SECRET` | Preferred shared secret for worker → Next.js webhook |
| `RUNPOD_API_KEY` | RunPod API key for serverless job submission |
| `RUNPOD_ENDPOINT_ID` | RunPod serverless endpoint ID |

**Worker (`worker/.env`):**

| Variable | Description |
|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API token key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name |
| `NEXT_PUBLIC_APP_URL` | Deployed app URL (e.g. `https://drisora.vercel.app`) |
| `WORKER_WEBHOOK_SECRET` | Shared secret (must match Next.js) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `RUNPOD_API_KEY` | RunPod API key |
| `RUNPOD_ENDPOINT_ID` | RunPod serverless endpoint ID |

Optional worker model/runtime controls:

| Variable | Description |
|---|---|
| `DRISORA_DETERMINISTIC_SEED` | Deterministic seed for Python/NumPy/Torch setup |
| `DRISORA_DETERMINISTIC_EXTRACTOR` | Prefer deterministic frame extraction |
| `DRISORA_ENABLE_DEPTHPRO_DEFAULT` | Enables DepthPro metric analysis by default when set to `1` |
| `DRISORA_WARM_SAM2` | Preloads SAM2 during worker warmup when set to `1` |
| `SAM2_MODEL_PATH` | Local SAM2 checkpoint path; defaults to `/tmp/models/sam2.1_hiera_small.pt` |
| `SAM2_MODEL_URL` | SAM2 checkpoint download URL |
| `SAM2_MODEL_CFG` | SAM2 config name |
| `DEPTHPRO_MODEL_PATH` | Local DepthPro checkpoint path; defaults to `/tmp/models/depth_pro.pt` |
| `DEPTHPRO_MODEL_URL` | DepthPro checkpoint download URL |
