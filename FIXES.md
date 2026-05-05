# All Bugs Fixed — Production Deployment Guide

## Errors Fixed in This Version

### Error 1: "xhr poll error" (on the live site)
Socket.IO was starting in long-polling mode and failing to upgrade to WebSocket.
Binary audio frames don't work over polling — nothing ever arrived at the backend.
**Fix:** Transport order changed to `['websocket', 'polling']` in websocketService.ts.

### Error 2: "is not an accepted origin" (Render logs)
The Vercel URL was being rejected by the backend despite `cors_allowed_origins="*"`.
This is because `gevent` async mode has a known bug where the wildcard is not
respected for WebSocket upgrade requests.
**Fix:** Switched backend from `async_mode='gevent'` to `async_mode='threading'`,
which handles `*` correctly.

### Error 3: "EventletDeprecationWarning" / gevent deprecated (Render logs)
Both eventlet and gevent are in maintenance-only mode and cause issues on modern
Python/Render environments.
**Fix:** Removed all gevent imports and deps. Now uses `threading` mode + gunicorn
gthread worker — stable, no deprecation warnings, works on Render's free tier.

### Error 4: Vercel build failure — Secret "nlp-backend-url" does not exist
The vercel.json used `"VITE_BACKEND_URL": "@nlp-backend-url"` which is Vercel Secret
syntax — it looks for an encrypted secret with that name, which doesn't exist.
**Fix:** Removed the `env` block from vercel.json entirely. The env var is set
directly in the Vercel dashboard instead (see Step 2 below).

---

## Deployment Steps

### Step 1 — Deploy the Backend on Render

1. Push the `NLP-Backend-fixed/` contents to your GitHub backend repo.
2. In Render dashboard → your service → **Settings**:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class gthread --workers 1 --threads 4 --bind 0.0.0.0:$PORT websocket_api:app`
3. Under **Environment**, make sure these are set:
   - `WHISPER_MODEL` = `tiny`
   - `CHUNK_SECONDS` = `5`
4. Click **Manual Deploy** → Deploy latest commit.
5. Wait for it to say "Live". Copy the URL: `https://nlp-backend-xxxx.onrender.com`

### Step 2 — Set the Environment Variable on Vercel

1. Go to vercel.com → your NLP-Site project → **Settings** → **Environment Variables**
2. Click **Add New**:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://nlp-backend-xxxx.onrender.com`  ← your actual Render URL
   - Check all environments: **Production**, **Preview**, **Development**
3. Click **Save**

### Step 3 — Redeploy the Frontend

Push the `NLP-Site-fixed/` contents to your GitHub frontend repo.
Vercel will auto-deploy. Or: Vercel dashboard → Deployments → Redeploy.

---

## Verify It Works

1. Open `nlp-site-iota.vercel.app`
2. The status dot should turn **purple/blue** and show "✓ Connected to Backend"
3. Click **Start Recording** — speak a sentence — click **Stop**
4. Within a few seconds the transcription should appear

## Local Development

Create `.env.local` in the frontend root:
```
VITE_BACKEND_URL=http://localhost:8080
```
Run backend: `python websocket_api.py`
Run frontend: `npm run dev`
