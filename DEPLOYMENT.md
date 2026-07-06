# Nova AI — Deployment Guide

This project is a **TanStack Start v1** app (Vite 7, React 19, SSR-ready) backed by Supabase. Below are deployment instructions for **Vercel**, **Railway**, and **AWS** (via SST / Docker on ECS or Lightsail).

---

## 1. Prerequisites

- Node.js 20+ and [Bun](https://bun.sh) (recommended) or npm
- A Supabase project (URL + publishable key + service role key), with the **Google** auth provider enabled (Client ID + Secret from Google Cloud Console, with the Gmail + Calendar scopes allowed on the OAuth consent screen)
- A [Google AI Studio](https://aistudio.google.com/) API key for Gemini (chat, vision, PDF, TTS)
- Optional: any custom news/weather keys (defaults use free Open-Meteo + Google News RSS)

### Required environment variables

| Name | Scope | Description |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | client + server | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + server | Supabase publishable (anon) key |
| `VITE_SUPABASE_PROJECT_ID` | client | Supabase project ref |
| `SUPABASE_URL` | server | Same as above (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | server | Same as above (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service role key (privileged) |
| `GEMINI_API_KEY` | server | Google Gemini API key — chat, vision, TTS |
| `GOOGLE_OAUTH_CLIENT_ID` | server | Same Google OAuth client registered in Supabase's Google provider — used to refresh Gmail/Calendar access tokens |
| `GOOGLE_OAUTH_CLIENT_SECRET` | server | Secret for the above |

> Copy `.env.example` → `.env` and fill values for local dev.

---

## 2. Local Setup

```bash
bun install
bun run dev          # http://localhost:8080
bun run build        # production build (.output/)
bun run preview      # serve built output locally
```

Run database migrations against your Supabase project:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

---

## 3. Deploy to Vercel

TanStack Start has first-class Vercel support — Vercel auto-detects the framework.

### One-click via CLI

```bash
npm i -g vercel
vercel login
vercel             # follow prompts, link project
vercel --prod      # ship to production
```

Or use the helper script:

```bash
bash scripts/deploy-vercel.sh
```

### Configuration

`vercel.json` (already committed) sets the build command and pins the Node runtime. Add env vars in the Vercel dashboard under **Settings → Environment Variables** (or via `vercel env add`).

**Build command:** `bun run build`
**Output directory:** `.output/public`
**Install command:** `bun install`

---

## 4. Deploy to Railway

Railway runs the app in a Node container using the included `Dockerfile` (or Railway's Nixpacks).

### CLI

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

Or run:

```bash
bash scripts/deploy-railway.sh
```

### Configuration

- `railway.json` defines build + start commands and a healthcheck.
- Add env vars: `railway variables set KEY=value` (or via dashboard).
- Railway exposes `$PORT` automatically — the start command honors it.

---

## 5. Deploy to AWS

Two supported paths:

### A) AWS App Runner / ECS Fargate via Docker (recommended)

```bash
# Build & push to ECR
bash scripts/deploy-aws.sh <aws-account-id> <region> <ecr-repo-name>
```

This script:
1. Builds the Docker image from the included `Dockerfile`.
2. Authenticates Docker with ECR.
3. Pushes the image tagged `:latest`.
4. Prints the ECR image URI to use in App Runner / ECS.

Then in the AWS console:
- **App Runner**: Create service → "Container registry" → pick the pushed ECR image → set port `3000` → add env vars → deploy.
- **ECS Fargate**: Create task definition referencing the ECR image, port `3000`, env vars from Secrets Manager.

### B) AWS Lightsail Containers (simplest)

```bash
aws lightsail push-container-image \
  --service-name nova-ai \
  --label nova \
  --image nova-ai:latest

aws lightsail create-container-service-deployment \
  --service-name nova-ai \
  --containers file://aws/lightsail-containers.json \
  --public-endpoint file://aws/lightsail-endpoint.json
```

Sample JSON files are in the `aws/` directory.

---

## 6. Post-deploy checklist

- [ ] Verify `/auth` renders and Google sign-in works (configure the OAuth redirect URI in both Google Cloud Console and Supabase to your deployed origin).
- [ ] Check `/assistant` voice + text chat (requires `GEMINI_API_KEY`).
- [ ] Test `/vision` upload (image + PDF).
- [ ] Confirm Gmail / Calendar connectors return data (reconnect Google from Settings if needed — this requires `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` to be set so tokens can refresh).
- [ ] Run a Lighthouse pass on the deployed URL.

---

## 7. Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Failed to resolve import` at build | Run `bun install`; ensure all envs are set. |
| 401 from server functions | `SUPABASE_PUBLISHABLE_KEY` missing OR client not sending bearer (check `attachSupabaseAuth` in `src/start.ts`). |
| Vision/PDF returns an AI error | `GEMINI_API_KEY` not configured on the deploy target. |
| Gmail/Calendar empty / "Google account not connected" | User needs to sign in with Google (or reconnect from Settings) with the Gmail/Calendar scopes granted; verify the Google OAuth redirect URI matches the deployed origin. |
| Gmail/Calendar worked once, then stopped | `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` missing or wrong, so the stored refresh token can't mint new access tokens. |
| Build OOM on Railway/AWS | Bump container memory to ≥ 1 GB. |

---

Happy shipping. 🚀
