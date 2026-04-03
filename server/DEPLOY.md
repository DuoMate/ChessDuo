# Deploy Stockfish Server to Render (5 Minutes)

## Prerequisites
- GitHub account with this repo
- [Render account](https://render.com) (free)

---

## Option A: Zero-Config (render.yaml) ⭐ Recommended

### Step 1: Push render.yaml to GitHub

The `server/render.yaml` file enables zero-config deployment.

```bash
git add server/render.yaml
git commit -m "Add Render deployment config"
git push origin main
```

### Step 2: Connect to Render

1. Go to [render.com](https://render.com) → **Dashboard**
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Click **"Apply"**

**That's it!** Render will deploy automatically on every push.

---

## Option B: Manual (Web Service)

### Step 1: Create Web Service

1. [render.com](https://render.com) → **Dashboard** → **"New +"** → **"Web Service"**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `server` |
| Language | `Node` |
| Version | `20` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Plan | `Free` |

4. Click **"Create Web Service"**

### Step 2: Wait for Deployment

First deploy takes ~2-3 minutes.

---

## Step 3: Get Your Server URL

After deployment, you'll see:
```
https://chessduo-stockfish.onrender.com
```

Test it:
```bash
curl -X POST https://your-app.onrender.com/evaluate \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","depth":10}'
```

Should return:
```json
{"fen":"...","score":35,"depth":10,"timeMs":89}
```

---

## Step 4: Configure GitHub Secrets (for Auto-Deploy)

1. Go to **GitHub** → **Settings** → **Secrets and variables** → **Actions**
2. Add:

| Secret | Where to Find |
|--------|--------------|
| `RENDER_SERVICE_ID` | Render Dashboard → Your Service → Settings → Service ID |
| `RENDER_API_KEY` | Render Dashboard → Account Settings → API Keys |

### Get RENDER_SERVICE_ID:
- Render Dashboard → Your Service (e.g., `chessduo-stockfish`)
- Settings → General → Scroll to "Service ID"
- Format: `srv-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Get RENDER_API_KEY:
- Render Dashboard → Account Settings → API Keys
- Click "Create API Key"
- Name it anything, copy the value

---

## Step 5: Push to Trigger Deployment

```bash
git add .
git commit -m "Configure server deployment"
git push origin main
```

**GitHub Actions will:**
1. Build the server
2. Run tests (health check)
3. Deploy to Render

---

## Update Frontend

Add to your frontend `.env.local`:
```bash
NEXT_PUBLIC_STOCKFISH_SERVER_URL=https://chessduo-stockfish.onrender.com
```

Or in Vercel/Netlify environment variables.

---

## Troubleshooting

### Deployment Failed
- Check GitHub Actions logs for errors
- Common: `render deploy-action` needs correct secrets

### Server Slow/Cold Start
- Render free tier sleeps after 15 min
- First request takes ~30s to wake
- **Fix**: Use [UptimeRobot](https://uptimerobot.com) to ping every 5 min

### Health Check Fails
```bash
curl https://your-app.onrender.com/health
```
Should return: `{"status":"ok","instances":0}`

---

## Free Tier Limits

| Limit | Value |
|-------|-------|
| Hours/month | 750 |
| Sleep after | 15 min inactivity |
| Bandwidth | 100 GB/month |
| Disk | 1 GB |

**Tip**: 750 hours = 31 days of continuous uptime. With sleep, it's effectively unlimited for a hobby project.

---

## Alternative: Railway

If Render doesn't work, try [Railway](https://railway.app):
1. New Project → Deploy from GitHub
2. Set root directory: `server`
3. Deploy!