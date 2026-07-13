---
name: Self-hosted deploy & cache provenance
description: User self-hosts this repo on their own VPS (behind nginx); how to prove which build is live and avoid stale-cache "deploy didn't take" reports.
---

The user deploys this repo's api-server (which serves both SPAs host-based) to their own VPS, not via Replit publishing. "Production is broken after I pushed changes" is often a stale build/cache, not a code bug.

**Rule:** never conclude the upstream POS API is missing features from hand-crafted probes alone — the proxy sends different request shapes (e.g. leads always sends `affiliate=<comma ids>`, never `all`). Test through the proxy or replicate its exact query.

**Provenance:** `/api/healthz` returns `buildTime` and every `/api` response carries `X-Build-Time` (baked in by esbuild define at build). First step when a VPS deploy "didn't take": compare that timestamp to when they rebuilt.

**Why:** production upstream was wrongly declared "old code" once because a probe used `affiliate=all` (a shape the app never sends); the real issue was the user's VPS running a stale server build.

**How to apply:** API responses are no-store, index.html no-store/no-cache, hashed /assets immutable 1y. If stale UI persists on their VPS, they must rebuild BOTH the SPAs and the api-server bundle and restart the node process (pm2).
