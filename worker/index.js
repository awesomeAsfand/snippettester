/**
 * Cloudflare Worker entry point.
 *
 * Cloudflare serves matching static assets from ./dist directly, without ever
 * invoking this script. Only requests with no matching asset reach us here —
 * which in practice means /api/audit and genuine 404s.
 *
 * This replaces the old Pages `functions/` directory convention. Pages compiled
 * that folder into routes automatically; Workers uses one entry script and
 * explicit routing, which is the direction Cloudflare is taking new projects.
 */

import { onRequest } from './audit.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/audit') {
      return onRequest({ request, env, ctx });
    }

    // Anything else: hand back to static assets, which applies the
    // not_found_handling rule from wrangler.jsonc (serves /404.html).
    return env.ASSETS.fetch(request);
  },
};
