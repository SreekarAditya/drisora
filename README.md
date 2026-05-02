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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API token key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public R2 URL (optional, for serving results) |
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
