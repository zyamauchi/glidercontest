# GliderContest.com — Deployment Guide

## What you're deploying

```
glidercontest/
├── backend/          → Node/Express API  → Railway service #1
├── frontend/         → React/Vite SPA    → Railway service #2
└── supabase_schema.sql → Run once in Supabase
```

---

## Step 1 — Supabase (database, auth, storage)

### 1a. Create project
1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name: `glidercontest` | Region: US West (closest to Avenal) | Set a strong DB password
4. Wait ~2 min for it to provision

### 1b. Run the schema
1. In your project: left sidebar → **SQL Editor** → **New query**
2. Open `supabase_schema.sql` from this repo
3. Paste the entire contents → click **Run**
4. You should see "Success" with no errors

### 1c. Enable email confirmations
1. Left sidebar → **Authentication** → **Email Templates**
2. Confirm the "Confirm signup" template looks correct (it defaults to fine)
3. **Authentication** → **Settings** → make sure **Enable email confirmations** is ON

### 1d. Get your API keys
1. Left sidebar → **Settings** → **API**
2. Copy these three values — you'll need them shortly:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long JWT starting with `eyJ`)
   - **service_role key** (long JWT — keep this secret, backend only)

---

## Step 2 — GitHub repository

Push the code to GitHub first (Railway deploys from GitHub):

```bash
cd /path/to/glidercontest
git init
git add .
git commit -m "Initial GliderContest build"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/glidercontest.git
git push -u origin main
```

---

## Step 3 — Railway: Backend API

You already have a Railway account. Here's how to add a new service:

1. Go to https://railway.app → open your existing project (or create a new one named `glidercontest`)
2. Click **+ New Service** → **GitHub Repo**
3. Select your `glidercontest` repo
4. Railway will detect the repo — **before** it deploys, set the root directory:
   - Click the service → **Settings** → **Source** → **Root Directory** → type `backend`
5. Click **Deploy**

### Set backend environment variables
In the backend service → **Variables** tab → add each one:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `FRONTEND_URL` | (leave blank for now, add after frontend deploys) |
| `PORT` | `3001` |

6. Railway will redeploy automatically after you add variables
7. Once deployed, copy the backend's **public URL** — looks like `https://glidercontest-api.up.railway.app`

---

## Step 4 — Railway: Frontend

1. In the same Railway project → **+ New Service** → **GitHub Repo** → same repo
2. Set root directory to `frontend`
3. Before deploying, set environment variables:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_API_URL` | the backend Railway URL from Step 3 (e.g. `https://glidercontest-api.up.railway.app`) |
| `VITE_CD_INVITE_CODE` | choose a secret code, e.g. `GC-CD-AVENAL2026` |

4. Deploy. Once it's live, copy the frontend's Railway URL.

### Update backend CORS
Go back to the **backend** service → **Variables** → update `FRONTEND_URL` to the frontend's Railway URL.

---

## Step 5 — Go back to Supabase: fix CORS/redirect URLs

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: set to your frontend Railway URL (e.g. `https://glidercontest-frontend.up.railway.app`)
3. **Redirect URLs**: add both:
   - `https://glidercontest-frontend.up.railway.app/**`
   - `https://glidercontest.com/**`  ← add this now even before DNS is set up

---

## Step 6 — Namecheap DNS → glidercontest.com

1. Log in to Namecheap → **Domain List** → **Manage** on glidercontest.com
2. Click **Advanced DNS** tab
3. Delete any existing A records or CNAME for `@` and `www`
4. Add these records:

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `@` | your frontend Railway URL (without `https://`) | Automatic |
| CNAME | `www` | your frontend Railway URL (without `https://`) | Automatic |

> **Note:** Some registrars don't allow CNAME on root (`@`). If Namecheap gives an error, use their **URL Redirect Record** instead:
> - Type: URL Redirect | Host: `@` | Value: `https://www.glidercontest.com` | Type: Permanent (301)
> - Then only the CNAME for `www`

5. DNS propagation takes 5–30 min (sometimes up to a few hours)

### Add custom domain in Railway
1. Frontend service → **Settings** → **Networking** → **Custom Domain**
2. Add `glidercontest.com` and `www.glidercontest.com`
3. Railway will issue an SSL cert automatically (Let's Encrypt)

---

## Step 7 — Update Supabase redirect URLs for custom domain

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: update to `https://glidercontest.com`
3. **Redirect URLs**: make sure `https://glidercontest.com/**` is in the list

---

## Step 8 — Create your first CD account

1. Go to https://glidercontest.com/auth
2. Click **Create Account**
3. Select **Contest Director**
4. Enter the `VITE_CD_INVITE_CODE` you set
5. Check your email for the confirmation link
6. Sign in and create your first contest

---

## Local development

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env        # fill in your Supabase keys
npm install
npm run dev                 # runs on :3001

# Terminal 2 — frontend
cd frontend
cp .env.example .env        # fill in Supabase keys, leave VITE_API_URL blank
npm install
npm run dev                 # runs on :5173, proxies /api to :3001
```

---

## Deploying updates

Just `git push origin main` — Railway auto-deploys on push to main.

If you only changed backend code, only the backend redeploys (Railway is smart about this if you have separate services with root directories set).

---

## Troubleshooting

**"Invalid JWT" errors** — check that `SUPABASE_SERVICE_ROLE_KEY` in the backend matches exactly what's in Supabase Settings → API. No extra spaces.

**CORS errors** — verify `FRONTEND_URL` in the backend matches your actual frontend URL exactly (no trailing slash, correct protocol).

**Email confirmations not sending** — Supabase free tier has a limit of 3 emails/hour. For production use, go to Supabase → **Authentication** → **SMTP Settings** and connect your own SMTP (e.g. Resend, SendGrid, or Mailgun — all have free tiers).

**Map not loading** — Leaflet loads from unpkg.com CDN. Check browser console for errors.

**"Not registered" on upload** — pilot must be approved by the CD first (Pilots tab → Approve).

**Database schema errors** — if you re-run the schema SQL, it may fail on `create table` if tables already exist. That's fine — skip to the `insert into storage.buckets` line and run just that part, or add `if not exists` to the table creates.

---

## Architecture summary

```
glidercontest.com (Namecheap DNS)
        ↓
Railway frontend (React/Vite, built static)
        ↓ /api/* 
Railway backend (Node/Express)
        ↓
Supabase (PostgreSQL + Auth + Storage + Realtime)
```

- **Pilots** sign up, confirm email, fill profile (glider → auto HC lookup), join contest
- **CD** creates contest, sets tasks via map, approves pilots, overrides HCs, finalizes days
- **IGC upload** → backend parses + scores → result saved → realtime pushes to leaderboard
- **TSK files** generated per-pilot with handicap-scaled cylinder radii
- **Leaderboard** is public (no login required to view)
