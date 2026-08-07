/**
 * OBSOLETE — DELETE THIS WHOLE `functions/` FOLDER BEFORE YOUR FIRST COMMIT.
 *
 * This file used to hold the AEO checker back when the project deployed to
 * Cloudflare Pages, which compiled a `functions/` directory into routes
 * automatically.
 *
 * The project now deploys as a Cloudflare Worker with static assets, so the
 * scoring engine lives at:
 *
 *     worker/audit.js     the scoring engine
 *     worker/index.js     routes /api/audit to it, everything else to assets
 *
 * Workers ignores this directory entirely, so leaving it here breaks nothing.
 * It is deleted anyway because two copies of the same logic is how someone
 * later edits the wrong one and cannot work out why nothing changed.
 *
 * On Windows: delete the `functions` folder in File Explorer.
 * Or from PowerShell, in the site directory:
 *
 *     Remove-Item -Recurse -Force functions
 */

export {};
