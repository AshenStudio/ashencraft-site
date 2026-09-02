# AshenCraft Website

Public website for AshenCraft - a clean home page and a live map page. Static
HTML/CSS/JS served by a stdlib-only Python server that also proxies `/api/*`
and `/map/*` same-origin, so the browser never makes cross-origin requests and
never hits CORS.

## Pages

| Page | File | What it does |
|:---|:---|:---|
| Home | `index.html` | Hero, features, Play now (live launcher download from the API), players-online chip (live from the map feed), Discord link |
| Live Map | `map.html` | Full-viewport iframe of the AshenMap web UI with a fullscreen toggle |

## Local development

No build step. Serve with the repo's own server (proxy + static) or any static
server for the pages alone:

```bash
cd Projects/ashencraft-site
python serve.py            # serves on :80; set PORT=8080 to avoid conflicts
PORT=8080 MAP_URL=http://localhost:8123 API_URL=https://ashenapi.overdev.net python serve.py
```

`site-config.js` (committed local-dev default) is regenerated at container boot
by `start.sh` from the stack env.

## Files

| File | Role |
|:---|:---|
| `serve.py` | Static server + same-origin proxy (stdlib only) |
| `site.js` | Nav injection (single source) + live widgets with static fallbacks |
| `theme.css` | Canonical dark palette (AshenStudio design system) |
| `start.sh` | Container entrypoint - regenerates `site-config.js`, then execs `serve.py` |
| `Dockerfile` | Static-file image (`python:3-slim`) |
| `docker-compose.yml` | The `ashen-website` Portainer stack (port 8081 default) |
| `scripts/check-assets.js` | CI guard: every local asset reference carries a `?v=` token |
| `.github/workflows/publish.yml` | Test + GHCR push + Portainer redeploy |

## The proxy routes

| Route | Upstream | Prefix |
|:---|:---|:---|
| `/api/<path>` | `API_URL` (default `https://ashenapi.overdev.net`) | kept (`/api/launcher/version` -> `/api/launcher/version`) |
| `/map/<path>` | `MAP_URL` (default `https://map.ashencraft.overdev.net`) | stripped (`/map/up/world/world/0` -> `/up/world/world/0`) |
| `/site-config.js` | local file | served with `Cache-Control: no-store` |

Every proxied response is `no-store`; the pages' static assets carry `?v=`
tokens for CDN cache busting.

## Deploy (first-deploy runbook)

The committed workflow is the **temp variant** (house pattern while the org
Actions/package quota blocks org GHCR): it pushes
`ghcr.io/7lokii/ashencraft-site:latest`, and the real deploy flows through the
**`7lokii/ashencraft-site-temp`** mirror repo, which carries the
`PORTAINER_*` secrets. The org repo's `main` is the canonical source; after a
temp deploy, sync org `main` to the deployed tree.

1. Push to the temp mirror; the workflow builds, pushes the image to
   `ghcr.io/7lokii/ashencraft-site:latest`, and redeploys the stack.
2. Create the stack in Portainer (`https://ashendocker.overdev.net`, endpoint
   `local` id 3): Stacks -> Add stack -> Web editor -> name `ashen-website` ->
   paste `docker-compose.yml` -> deploy. Do this AFTER the first image push so
   the pull succeeds.
3. Set repo secrets: `PORTAINER_URL` = `https://ashendocker.overdev.net`,
   `PORTAINER_API_KEY` (a fresh token from Portainer Settings -> Access
   tokens), `STACK_ID` (55=api, 56=dashboard, 57=ashenbot; the site is next).
4. Verify locally: `curl -s http://<vps-ip>:8081/` returns the home page.
5. The Cloudflare checklist below must land, then verify
   `https://ashencraft.overdev.net/`.

Redeploys are automatic: every push to `main` runs the tests, pushes the image,
prunes Docker space on the VPS (disk-full incident lesson), and PUTs the
checked-out `docker-compose.yml` as StackFileContent (never Portainer's stored
copy - stored copies went stale and broke ashenbot and the API stack).

## Cloudflare checklist (friend with zone access)

In order, before or while flipping `ashencraft.overdev.net` to the site:

1. Add `mc.ashencraft.overdev.net` -> game server IP (`2.80.36.114`), grey
   cloud (DNS only) so Minecraft port 25565 keeps working. The client's default
   join address is updated separately.
2. Add `map.ashencraft.overdev.net` -> game server IP, TLS terminated on the
   game box (same nginx/caddy that serves the current HTTPS map).
3. Flip `ashencraft.overdev.net` to the VPS: proxied (orange cloud) record +
   an origin rule sending requests to port 8081 (the site's host port).
4. Redirect the old map URL: while `map.ashencraft.overdev.net` is live, add a
   redirect rule from `ashencraft.overdev.net` map paths to the new map host.

## House rules

- No em-dashes (U+2014) anywhere - use `-` or `--`.
- No third-party game names in public content. Copy is derived from
  `AshenCraft/public_docs/` and stays self-describing.
- `?v=` discipline: run `node scripts/check-assets.js` before committing any
  asset change; bump the token on every page that references the changed file.
- Every live-data widget has a static fallback - a dead upstream must never
  blank the page.