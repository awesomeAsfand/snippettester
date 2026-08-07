/**
 * Runs the site's own AEO checker against its own built output.
 * If we sell structural optimisation, our pages should pass our own test.
 */
import { readFileSync, existsSync } from 'node:fs';
import { scoreAll } from './worker/audit.js';

const robots = { found: true, text: readFileSync('public/robots.txt', 'utf8') };

const pages = [
  ['/', 'dist/index.html'],
  ['/websites', 'dist/websites/index.html'],
  ['/work', 'dist/work/index.html'],
  ['/evidence', 'dist/evidence/index.html'],
  ['/services', 'dist/services/index.html'],
  ['/pricing', 'dist/pricing/index.html'],
  ['/teardowns', 'dist/teardowns/index.html'],
  ['/teardowns/auditing-our-own-abandoned-product', 'dist/teardowns/auditing-our-own-abandoned-product/index.html'],
  ['/about', 'dist/about/index.html'],
  ['/contact', 'dist/contact/index.html'],
];

let fail = 0;
const rows = [];
for (const [label, file] of pages) {
  if (!existsSync(file)) { console.log('MISSING', file); fail++; continue; }
  const html = readFileSync(file, 'utf8');
  const signals = scoreAll(html, robots);
  const got = signals.reduce((n, s) => n + s.points, 0);
  const max = signals.reduce((n, s) => n + s.max, 0);
  const pct = Math.round((got / max) * 100);
  const weak = signals.filter((s) => s.verdict === 'bad').map((s) => `${s.name} ${s.points}/${s.max}`);
  rows.push([label, pct, weak.join('; ') || '—']);
  if (pct < 75) fail++;
}

const w = Math.max(...rows.map((r) => r[0].length));
console.log('\nSELF-AUDIT — site scored by its own checker\n');
for (const [label, pct, weak] of rows) {
  const flag = pct >= 85 ? 'OK  ' : pct >= 75 ? 'OK- ' : 'LOW ';
  console.log(`${flag} ${label.padEnd(w)}  ${String(pct).padStart(3)}/100   ${weak}`);
}
console.log(`\n${fail ? `FAILURES: ${fail}` : 'All pages at or above 75.'}`);
process.exit(fail ? 1 : 0);
