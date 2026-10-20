# Portfolio CMS — `feature/admin-cms`

The CMS extends the existing `ContentProvider` / `contentApi.ts` architecture. It does not add public navigation sections, change public component styles, or change the Telegram Worker. All development stays on `feature/admin-cms`; the branch workflow validates builds but does not deploy.

## Run and check locally

Use Node **22.18+ or 24 LTS** (the database integration tests use Node's built-in SQLite).

```sh
npm ci
npm ci --prefix worker
npm run typecheck
npm test
npm run build
npm run cms:admin:build
npm run cms:public:build
npm run preview
```

Open `/admin/` for the dashboard and `/` for the existing public site. `admin/index.html` is a real Vite entry, so direct navigation and refresh work on GitHub Pages without SPA rewrites. Both Worker build commands are **dry runs**, writing only to ignored `artifacts/`, never the public `dist/` directory.

Frontend configuration (public URLs, never credentials):

- `VITE_PUBLIC_API_URL`: defaults to `https://portfolio-public-api.kmuhammadali.workers.dev`.
- `VITE_ADMIN_API_URL`: defaults to `https://portfolio-cms-api.kmuhammadali.workers.dev`.
- `VITE_SITE_URL`: defaults to `https://kmuhammadali.github.io`.
- Existing `VITE_CONTACT_API_URL` continues to configure Telegram contact delivery independently.

Use a local API origin when testing edits. The production API intentionally has no development JWT bypass. Tests create ephemeral RSA keys and an isolated in-memory database; no production data is mutated.

## Editors

Home, About and Contact have structured fields and repeatable lists. Skills also exposes its section intro. Skills, Projects, Posts and Media support create/edit/delete, publication controls, numeric ordering (lower comes first), image URLs and appropriate metadata. Home cards, terminal line structure, four contact slots and navigation destinations are validated so content edits cannot break the existing layout. Settings edits the existing public `name`, `navigation` and `footer` keys only.

Media manages **metadata and externally hosted HTTPS URLs**, not binary uploads or R2 objects. Deleting media does not delete the underlying file. Post bodies are stored/returned as text; no untrusted HTML is executed by the dashboard. Projects/posts remain available from their existing public API endpoints; no new public page/navigation is introduced.

Save persists changes through the Admin API. Drafts never appear in public collection responses. A deleted/unpublished canonical page or setting falls back to the existing local website content. Published changes are loaded on public page load/refocus; `ContentProvider.refresh()` is also available. The public API uses `no-store` to avoid stale published content. Failures retain safe local fallbacks without discarding healthy collections.

## API contract

All routes below require a **verified** `Cf-Access-Jwt-Assertion`, not merely a present header. Verification enforces RS256 signature, configured team issuer, audience, expiry, issued-at and not-before dates using Cloudflare's JWKS endpoint. No JWTs are returned to JavaScript or stored in localStorage.

- `GET /api/admin/session`: existing authenticated session response.
- `GET /api/admin/{content|skills|projects|posts|settings|media}?limit=50&offset=0`: `{items,total,limit,offset}`; max limit 200.
- `GET /api/admin/{resource}/{id}`: decoded record (settings use their key).
- `POST /api/admin/{resource}`: create; unknown/immutable fields are rejected. IDs default to UUIDs for collections; page ID equals its canonical section.
- `PATCH` or `PUT /api/admin/{resource}/{id}`: validated field update, preserving unspecified values.
- `DELETE /api/admin/{resource}/{id}`: delete metadata/record only.

Writes require an allowlisted `Origin`, `X-CMS-Request: 1`, and JSON for POST/PUT/PATCH. The dashboard supplies these automatically and sends only HttpOnly-cookie credentials. `If-Match: "<updated_at>"` detects stale edits; the dashboard sends it on existing-record writes/deletes. Atomic conditional SQL updates prevent stale overwrites. Slug/object-key conflicts return 409; input errors return 400/413/415. Failed authentication returns 401; unavailable verification/configuration fails closed with 503. SQL uses bound parameters and fixed table/column allowlists. Error responses never echo credentials or SQL.

The existing public `/api/content`, `/api/content/:section`, `/api/settings`, `/api/skills`, `/api/projects` and `/api/posts` response shapes remain compatible. `/api/posts/:slug` adds published post details; `/api/media` returns published media metadata without private object keys. Public routes accept GET only.

## Cloudflare deployment — approval required; NOT performed by this task

The existing schema and deployed Worker code were inspected read-only. No production migrations, writes, Access changes or deployments are run automatically.

1. Review this branch and take a D1 backup before approving migration. Existing database: `portfolio-cms-db` (`d814a960-3a01-4464-abe6-b40b2c483687`). `cms/schema.local.sql` mirrors the existing tables and is **only for local tests/bootstrap; never apply it to production**.
2. After approval, apply the additive migration once using Wrangler's migration tracking:

   ```sh
   worker/node_modules/.bin/wrangler d1 migrations apply portfolio-cms-db --remote --config cms/admin/wrangler.toml
   ```

   It adds publication/order fields to page content, ordering to posts, and publication/order/alt-text/update metadata to media. Existing records, IDs, content and original columns are retained. Existing pages/skills keep their publication state; media defaults to unpublished. Do not re-run the raw ALTER statements manually.

3. Verify the existing Cloudflare Access application/policy restricts the **entire Admin API hostname**, including `/admin/*` and `/assets/*`, to the intended administrators. Keep `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` aligned with that application. Both are public identifiers, not secrets. Configure Access CORS to let OPTIONS preflight reach the Worker; allow the exact frontend origin, credentials, methods GET/POST/PUT/PATCH/DELETE and headers Content-Type/If-Match/X-CMS-Request. The Worker independently enforces CORS, CSRF protection and JWT verification.
4. The reviewed configuration allows only `https://muhammad-ali.uz` and the existing `https://kmuhammadali.github.io` origin. `DASHBOARD_ORIGIN` is `https://muhammad-ali.uz`. Set repository variable `VITE_SITE_URL=https://muhammad-ali.uz`; retain the existing `VITE_CONTACT_API_URL`. The workflow also accepts optional `VITE_PUBLIC_API_URL` and `VITE_ADMIN_API_URL` overrides. No Telegram secrets belong in either CMS Worker or frontend.
5. After approval, independently deploy the two Workers:

   ```sh
   worker/node_modules/.bin/wrangler deploy --config cms/admin/wrangler.toml
   worker/node_modules/.bin/wrangler deploy --config cms/public/wrangler.toml
   ```

6. An independently approved frontend release must publish the new Vite build, including `admin/index.html` and its assets, to `DASHBOARD_ORIGIN`. **This task does not merge into main or enable feature-branch production deployment.** The existing Pages workflow still deploys only `main`; feature-branch CI only validates.
7. Open `https://muhammad-ali.uz/admin/`. If cross-site Access cookies are blocked, the sign-in link opens `https://portfolio-cms-api.kmuhammadali.workers.dev/admin/`. This same-origin, JWT-protected dashboard proxies only the approved static HTML/assets and never forwards Access credentials to GitHub. It requires step 6's static files to exist.
8. Verify sign-in, a temporary draft, publication/unpublication, ordering and deletion after the approved deployment. Check the public API and website refresh. Leave existing Telegram delivery settings intact.

## Verification performed during implementation

TypeScript, API/client tests, SQLite CRUD/migration tests, frontend build and both Worker dry-run builds were executed. Browser tests used an isolated local API with ephemeral signed test JWTs, never the production database: Home edits appeared publicly; a skill was created, published, unpublished and deleted; media validation preserved inputs. Dashboard editors and mobile layout were checked. Production Access sign-in and production CRUD remain untested until deployment is approved.

## Deployment preparation — 2026-10-20

GitHub Pages already has custom domain `muhammad-ali.uz` and Actions as its source. CI for `d52da7c` passed. A private, ignored SQL backup was exported to `artifacts/portfolio-cms-before-deploy-20261020.sql` (SHA-256 `5074f66bd00c9d3835582dbba9c0fb5ff4773c3519af6a2d3046405f7d759829`). D1 Time Travel bookmark: `0000000c-00000000-0000510a-6685460fd8f903ecfd7dd7579fce735e`. Migration rehearsal against that export preserved every original column value: 3 settings, 4 pages, 1 skill, and empty projects/posts/media collections. No production migration or deployment has been performed. Refresh the backup if production records change before approval.

Cloudflare CLI authentication permits Worker/D1 operations. Dashboard sign-in is still needed to confirm the existing Access application and policy; do not replace it with a broad allow/bypass rule. In **Zero Trust → Access → Applications**, locate the application protecting `portfolio-cms-api.kmuhammadali.workers.dev`, confirm its audience matches `ACCESS_AUD`, protect the whole hostname and retain the administrator allowlist. Under its CORS settings, allow the two origins listed above, credentials, methods GET/POST/PUT/PATCH/DELETE and headers Content-Type/If-Match/X-CMS-Request; allow OPTIONS preflight to reach the Worker. Production migration, both Worker deployments, frontend release/merge and temporary production CRUD verification require explicit approval.
