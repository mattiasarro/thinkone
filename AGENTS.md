# Agent instructions

## Ship every change

When you make a change, commit it, push it and deploy it to production. Do not stop at a local commit, and do not ask
first.

1. Run the checks for what you touched and don't push if they fail:
   - backend: `cd backend && uv run pytest -q`
   - frontend: `cd frontend && npx tsc --noEmit && npx eslint .`
2. `git push origin main`
3. Redeploy the affected services. Pushing to GitHub does **not** trigger a deploy:
   - `backend/**` changed: `railway redeploy --service api --from-source --yes`, then the same for `worker` (same image;
     the api start command runs migrations, so api goes first)
   - `frontend/**` changed: `railway redeploy --service frontend --from-source --yes`
   - docs or `data/` only: push, no redeploy
4. Wait for each deployment to reach SUCCESS and check it's healthy: `https://api-production-b9c7d.up.railway.app/api/health`
   returns ok and `https://frontend-production-ba0c.up.railway.app/login` loads. If a deploy fails, read its build/deploy
   logs and fix it rather than leaving production broken.

Service setup, env vars and rollback are in `deploy/RAILWAY.md`.
