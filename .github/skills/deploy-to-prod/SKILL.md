---
name: deploy-to-prod
description: "Deploy affiliate-hub changes to Vercel production. Use when: shipping code to prod, pushing changes live, deploying to production, no more local only prod, commit and deploy, go live, push to Vercel."
argument-hint: "Optional: commit message override"
---

# Deploy to Production

Deploy all local changes to Vercel production via `git push origin main`.
This project uses **Vercel** for hosting and **Turso** for the database.
Local `vercel dev` is for development only — all real data lives in prod.

**Production URL:** `https://affiliates.onlymatt.ca`
**Auth cookie:** `affiliate_admin` — value = `ADMIN_SESSION_TOKEN` from `.env.local`
**Turso seeding:** If data is missing from prod, bulk-upsert from `data/collaborators.json` or `data/affiliates.json` using:
```bash
node -e "const https=require('https'),data=JSON.stringify({collaborators:require('./data/collaborators.json')}),o={hostname:'affiliates.onlymatt.ca',path:'/api/collaborators-bulk-upsert',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'Cookie':'affiliate_admin=<TOKEN>'}};const r=https.request(o,res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(res.statusCode,b))});r.write(data);r.end()"
```

## Pre-flight Checks

Before committing, verify:

1. **No hardcoded secrets** — scan for passwords, tokens, API keys in changed files
   ```
   git diff HEAD | grep -iE "(password|secret|token|key)\s*=\s*['\"][^'\"]{6,}"
   ```
2. **No debug-only code** — `console.log` dumps, test routes, temp overrides
3. **Environment variables** — any new `process.env.X` references must already exist in Vercel dashboard
   - Required: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD`, `ADMIN_SESSION_TOKEN`
4. **Fallback safety** — `lib/affiliates-store.js` and `lib/collaborators-store.js` use `hasTursoConfig()` guards; confirm new code respects that pattern

## Deployment Procedure

### Step 1 — Review all changes
```bash
git status
git diff
```
Confirm every modified file is intentional. Flag anything unexpected.

### Step 2 — Stage everything
```bash
git add -A
```
Or stage selectively if some files should be held back.

### Step 3 — Commit
```bash
git commit -m "<concise imperative summary of what changed>"
```
If the user provided a commit message argument, use it verbatim.
Otherwise infer a message from `git diff --stat HEAD`.

### Step 4 — Push to main (triggers Vercel deploy)
```bash
git push origin main
```
Vercel automatically deploys on every push to `main`.

### Step 5 — Verify deployment
Check the Vercel deployment tail or dashboard:
```bash
vercel ls 2>/dev/null | head -5
```
Or open the production URL and smoke-test the changed endpoints.

## Post-deploy Smoke Test

For API changes, test the relevant endpoint on prod (not localhost):
- Affiliates: `GET /api/affiliates`
- Collaborators: `GET /api/collaborators`
- Auth: `POST /api/login` with valid credentials

For UI changes, open the prod URL and confirm the affected section renders correctly.

## Rollback

If the deployment breaks prod:
```bash
git revert HEAD --no-edit
git push origin main
```

## Key Facts

| Concern | Detail |
|---------|--------|
| Hosting | Vercel (Hobby plan — limited function count) |
| Database | Turso (libSQL); local falls back to `data/*.json` (read-only) |
| Auth | Cookie `affiliate_admin`; token from `ADMIN_SESSION_TOKEN` env var |
| Dev server | `npm start` → `vercel dev` (local only, never prod) |
| Deploy trigger | `git push origin main` → Vercel auto-deploy |
| Branch | `main` is production |
