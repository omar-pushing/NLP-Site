# Bug Fixes & Production Deployment Guide

## What Was Broken & Why

### 1. Frontend never connects to the real backend (PRIMARY BUG)
**File:** `src/services/websocketService.ts` and Vercel config

The `VITE_BACKEND_URL` environment variable was **never set on Vercel**.
The code falls back to `http://localhost:8080`, which is unreachable from a browser
visiting `nlp-site-iota.vercel.app`. This is why the status shows "Connecting to
Backend…" forever and the spinner never resolves.

**Fix:** Set `VITE_BACKEND_URL` in Vercel dashboard → Settings → Environment Variables.

---

### 2. Backend WebSocket transport order was wrong
**File:** `src/services/websocketService.ts`

`transports: ['polling', 'websocket']` means Socket.IO starts on long-polling and
*tries* to upgrade later. On Render's free tier (behind a reverse proxy), this upgrade
often silently fails — the client stays on polling, which doesn't support the binary
frames used to send audio. Result: audio never reaches the backend.

**Fix:** Changed to `transports: ['websocket', 'polling']` so WebSocket is tried first.

---

### 3. Backend not started with the correct server (BACKEND BUG)
**File:** `Procfile` and `render.yaml` in NLP-Backend

`web: python websocket_api.py` uses Flask's built-in dev server via `socketio.run()`.
This works locally but **does not support WebSocket upgrades in production** when
behind a proxy. The correct way is `gunicorn` with the `geventwebsocket` worker.

**Fix:** Procfile changed to:
```
web: gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --workers 1 --bind 0.0.0.0:$PORT websocket_api:app
```

---

### 4. UI spinner stuck forever on network issues
**File:** `src/app/App.tsx`

- The safety timeout was 30 seconds — too long, user thinks it's broken.
- On WebSocket disconnect mid-processing, `isProcessing` was never cleared.

**Fix:** Timeout reduced to 15s with an error message. `onDisconnect` now also clears
`isProcessing`.

---

### 5. `add_audio` didn't handle all binary payload types
**File:** `websocket_api.py` in NLP-Backend

Added handling for `memoryview` (which gevent can produce) and empty payload guard.

---

## Deployment Steps

### Step 1 — Deploy the Backend (Render)

1. Push `NLP-Backend-fixed/` to your GitHub repo (or update the existing one).
2. Go to [render.com](https://render.com) → your `nlp-backend` service → Settings.
3. Change **Start Command** to:
   ```
   gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --workers 1 --bind 0.0.0.0:$PORT websocket_api:app
   ```
4. Redeploy. Wait for it to go live (it takes a few minutes — Whisper model downloads on first start).
5. Copy your backend URL, e.g. `https://nlp-backend-xxxx.onrender.com`

### Step 2 — Set the Vercel Environment Variable

1. Go to [vercel.com](https://vercel.com) → your `NLP-Site` project → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://nlp-backend-xxxx.onrender.com`  ← your Render URL
   - **Environments:** Production, Preview, Development (check all)
3. Click **Save**.

### Step 3 — Redeploy the Frontend

In Vercel, go to **Deployments** → click the three-dot menu on the latest deploy → **Redeploy**.

OR push a small change to trigger a new deploy automatically.

---

## Local Development

Create a `.env.local` file in the frontend root:
```
VITE_BACKEND_URL=http://localhost:8080
```

Start the backend:
```bash
cd NLP-Backend
pip install -r requirements.txt
python websocket_api.py
```

Start the frontend:
```bash
cd NLP-Site
npm install
npm run dev
```
