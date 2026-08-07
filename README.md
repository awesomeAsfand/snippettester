# snippettester.com

Static marketing site for an evidence-led SEO/AEO practice, plus a free AEO
readiness checker that runs as a single Cloudflare Worker route.

Deployed as a **Worker with static assets** (not Cloudflare Pages). Pages is in
maintenance mode; Workers is where Cloudflare is putting new work, and it is what
new projects default to.

Positioning, sitemap reasoning and the research behind the copy are in
`POSITIONING-BRIEF.md` (one directory up).

## Run it

```bash
npm install
npm run dev          # http://localhost:4321 — pages only, checker will NOT work
npm run dev:worker    # http://localhost:8787 — full site, checker works
npm run build         # outputs to dist/
npm test              # self-audit + link check
```

`astro dev` serves the pages but knows nothing about the Worker, so the checker
errors there. Use `npm run dev:worker` when you need to test it — that builds the
site and runs the real Worker runtime locally.

## Deploy (Cloudflare Workers, free tier)

1. Push this directory to a Git repo.
2. Cloudflare dashboard → Workers & Pages → **Create** → **Workers** → import the
   repository.
3. Build command `npm run build`, deploy command `npx wrangler deploy`.
4. Cloudflare reads `wrangler.jsonc` for everything else.
5. Add `snippettester.com` and `www.snippettester.com` as custom domains.

Or deploy straight from your machine with `npm run deploy`.

### How routing works

Cloudflare serves anything matching a file in `dist/` directly, without running
any code. Only requests with no matching asset reach `worker/index.js`, which
routes `/api/audit` to the scoring engine and hands everything else back to the
assets binding (which then serves `404.html`). The site is still effectively
static — one route runs on demand.

## Structure

```
wrangler.jsonc      Worker config — name, entry point, assets binding
worker/index.js     Worker entry: routes /api/audit, else falls back to assets
worker/audit.js     the scoring engine
src/pages/          one file per route
src/data/evidence.js  the eight claims — single source of truth for /evidence
                      and for the FAQPage schema on that page
src/components/Checker.astro   checker UI + client script
public/robots.txt   all AI crawlers explicitly allowed
public/llms.txt     published with an honest note about its uselessness
selftest.mjs        scores the built site with its own checker
linkcheck.mjs       H1 count, canonicals, JSON-LD validity, dead hrefs, weight
```

`worker/audit.js` exports a standard `onRequest({ request })` handler, so the
scoring engine is portable — it would run on Pages, Netlify or Deno with a
different wrapper. Only `worker/index.js` is Cloudflare-specific.

## Before you publish

Three things to change, all deliberate placeholders:

1. **`hello@snippettester.com`** appears throughout. Set up the mailbox or
   change the address.
2. **The teardown score is hand-estimated.** `/teardowns/auditing-our-own-abandoned-product`
   labels 41/100 as provisional because it was scored by eye, not by the tool.
   Once deployed, run the real checker against an archived copy of the old page
   and replace the number. The page says so openly — do not remove that note
   without doing the work.

3. **Every price is a placeholder derived from 2026 market surveys, not from you.**
   You have not set rates. The numbers currently in the site are:

   | Item | Current placeholder | Market band it sits in |
   |---|---|---|
   | Essential build (≤5 pages) | $2,500-4,000 | $2,000-8,000 freelance typical |
   | Standard build (6-12 pages) | $4,000-8,000 | $3,000-6,000 for a 5-page brochure |
   | Structural audit | $750 | — |
   | Fix-it sprint | $2,400 | — |
   | Retainer | $2,900/mo | $2,000-15,000 AEO retainers |

   They appear in `src/pages/pricing.astro`, `src/pages/services.astro`,
   `src/pages/index.astro` (the "From $750" card) and `public/llms.txt`.
   Grep for the number before changing it: `grep -rn "2,400" src public`.

## Tests

```bash
npm test        # runs both, after a build
```

`selftest.mjs` fails if any page scores below 75 on the site's own checker. That
is the point: a site selling structural optimisation should pass its own test.
Current scores run 78-91.

## Deliberate choices worth not undoing

- **No web fonts.** System stacks only, so first paint never waits on a network
  request. Largest page is 24 KB of HTML plus 10 KB of CSS.
- **No analytics, no cookie banner.** Nothing to consent to. Add Cloudflare Web
  Analytics if you need numbers — it is cookieless and needs no banner.
- **The checker is deterministic.** Regex over HTML, no model, no API key, no
  per-run cost. Same URL always returns the same score, which is why it can be
  free and why its output is defensible.
- **Static assets are served without invoking the Worker.** Only `/api/audit` and
  404s cost anything. On the free plan this site will not generate a bill.
- **robots.txt allows every AI crawler by name.** Blocking them removes you from
  their answers.
