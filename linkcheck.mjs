import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})('dist');

let problems = 0;
const seenInternal = new Set();

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const page = f.replace(/^dist/, '').replace(/\/index\.html$/, '') || '/';

  // structural checks
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) { console.log(`✗ ${page}: ${h1} H1 elements`); problems++; }
  if (!/<html lang="en"/.test(html)) { console.log(`✗ ${page}: missing lang`); problems++; }
  if (!/rel="canonical"/.test(html)) { console.log(`✗ ${page}: missing canonical`); problems++; }
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  if (title.length < 20 || title.length > 70) { console.log(`✗ ${page}: title ${title.length} chars — "${title}"`); problems++; }
  const noindex = /name="robots" content="noindex/.test(html);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!noindex && (desc.length < 70 || desc.length > 175)) { console.log(`✗ ${page}: description ${desc.length} chars`); problems++; }

  // json-ld validity
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { console.log(`✗ ${page}: malformed JSON-LD — ${e.message}`); problems++; }
  }

  // placeholder / dead hrefs — the exact sin the teardown calls out
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    const h = m[1];
    if (h === '#' || h === '' || h === '<>') { console.log(`✗ ${page}: placeholder href "${h}"`); problems++; }
  }

  // internal links resolve
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const target = m[1];
    if (seenInternal.has(page + target)) continue;
    seenInternal.add(page + target);
    const candidates = [
      join('dist', target),
      join('dist', target, 'index.html'),
      join('dist', target.replace(/\/$/, '') + '.html'),
    ];
    const ok = candidates.some((c) => existsSync(c) && statSync(c).isFile()) ||
      (existsSync(join('dist', target)) && statSync(join('dist', target)).isDirectory() && existsSync(join('dist', target, 'index.html')));
    if (!ok) { console.log(`✗ ${page}: internal link 404 → ${target}`); problems++; }
  }
}

// required public files
for (const f of ['dist/robots.txt', 'dist/llms.txt', 'dist/favicon.svg', 'dist/sitemap-index.xml', 'dist/_headers', 'dist/404.html']) {
  if (!existsSync(f)) { console.log(`✗ missing ${f}`); problems++; }
}

// page weight
console.log('\nPage weight (uncompressed HTML):');
for (const f of files.sort()) {
  const kb = (statSync(f).size / 1024).toFixed(1);
  console.log(`  ${String(kb).padStart(6)} KB  ${f.replace('dist', '')}`);
}
const css = [];
(function w(d){ if(!existsSync(d)) return; for(const e of readdirSync(d,{withFileTypes:true})){ const p=join(d,e.name); if(e.isDirectory()) w(p); else if(e.name.endsWith('.css')) css.push([p,(statSync(p).size/1024).toFixed(1)]); }})('dist');
css.forEach(([p,k]) => console.log(`  ${String(k).padStart(6)} KB  ${p.replace('dist','')}`));
console.log(`\n${files.length} pages checked. ${problems ? `${problems} PROBLEM(S)` : 'No problems found.'}`);
process.exit(problems ? 1 : 0);
