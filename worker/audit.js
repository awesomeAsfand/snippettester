/**
 * Free AEO readiness checker — Cloudflare Pages Function.
 *
 * Deterministic on purpose. Every point awarded traces to something
 * measurable in the HTML or robots.txt, so the same URL always scores the
 * same and nothing here can hallucinate a finding.
 *
 * Deploy: Cloudflare Pages picks up /functions automatically. No adapter,
 * no server, the rest of the site stays static.
 */

const MAX_BYTES = 2_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const UA = 'SnippetTesterBot/1.0 (+https://www.snippettester.com/about)';

const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Bytespider',
];

const BLOCKED_HOSTS =
  /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0)/i;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  let raw = '';
  try {
    if (request.method === 'POST') {
      const body = await request.json();
      raw = String(body?.url ?? '');
    } else {
      raw = new URL(request.url).searchParams.get('url') ?? '';
    }
  } catch {
    return json({ error: 'Could not read the request body.' }, 400);
  }

  let target;
  try {
    target = normaliseUrl(raw);
  } catch (err) {
    return json({ error: err.message }, 400);
  }

  let html, finalUrl, status;
  try {
    const res = await fetchWithTimeout(target.href);
    status = res.status;
    finalUrl = res.url || target.href;
    if (!res.ok) {
      return json(
        { error: `That URL returned HTTP ${res.status}. Check it loads in a browser first.` },
        422,
      );
    }
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) {
      return json({ error: `That URL served "${type || 'an unknown type'}" rather than HTML.` }, 422);
    }
    html = await readCapped(res);
  } catch (err) {
    return json(
      { error: err.name === 'AbortError' ? 'The page took too long to respond.' : 'Could not reach that URL.' },
      502,
    );
  }

  const robots = await fetchRobots(target.origin);
  const signals = scoreAll(html, robots);
  const score = signals.reduce((n, s) => n + s.points, 0);
  const max = signals.reduce((n, s) => n + s.max, 0);
  const pct = Math.round((score / max) * 100);

  return json({
    url: finalUrl,
    status,
    checkedAt: new Date().toISOString(),
    score: pct,
    band: band(pct),
    summary: summarise(pct, signals),
    signals,
  });
}

/* ---------------------------------------------------------------- fetching */

function normaliseUrl(input) {
  let s = (input || '').trim();
  if (!s) throw new Error('Enter a URL to check.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https URLs can be checked.');
  if (BLOCKED_HOSTS.test(u.hostname)) throw new Error('Private and local addresses cannot be checked.');
  if (!u.hostname.includes('.')) throw new Error('That hostname looks incomplete.');
  return u;
}

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    });
  } finally {
    clearTimeout(t);
  }
}

async function readCapped(res) {
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}

async function fetchRobots(origin) {
  try {
    const res = await fetchWithTimeout(new URL('/robots.txt', origin).href, 6000);
    if (!res.ok) return { found: false, text: '' };
    const text = (await res.text()).slice(0, 120_000);
    return { found: true, text };
  } catch {
    return { found: false, text: '' };
  }
}

/* ----------------------------------------------------------------- parsing */

const strip = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

const textOf = (html) =>
  strip(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordsIn = (s) => (s ? s.split(/\s+/).filter(Boolean) : []);

function headings(html) {
  const out = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ level: Number(m[1]), text: textOf(m[2]) });
  }
  return out;
}

function attr(html, tag, name) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  return html.match(re)?.[1] ?? null;
}

function metaContent(html, nameAttrValue) {
  const re = new RegExp(
    `<meta\\b[^>]*\\bname\\s*=\\s*["']${nameAttrValue}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["']`,
    'i',
  );
  const alt = new RegExp(
    `<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*\\bname\\s*=\\s*["']${nameAttrValue}["']`,
    'i',
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rawBlock = m[1].trim();
    try {
      const parsed = JSON.parse(rawBlock);
      out.push({ ok: true, data: parsed });
    } catch {
      out.push({ ok: false, data: null });
    }
  }
  return out;
}

function collectTypes(node, acc = new Set()) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, acc));
    return acc;
  }
  const t = node['@type'];
  if (typeof t === 'string') acc.add(t);
  if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && acc.add(x));
  Object.values(node).forEach((v) => {
    if (v && typeof v === 'object') collectTypes(v, acc);
  });
  return acc;
}

/* ----------------------------------------------------------------- scoring */

function scoreAll(html, robots) {
  const clean = strip(html);
  const body = clean.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? clean;
  const text = textOf(body);
  const words = wordsIn(text);

  return [
    sigStructuredData(html),
    sigAnswerFirst(body, words),
    sigHeadings(clean),
    sigFormats(body),
    sigEvidence(body, text, words),
    sigPosition(body),
    sigCrawlers(robots),
    sigMetadata(html),
  ];
}

function sig(name, max, points, verdictText, fix, note) {
  const p = Math.max(0, Math.min(max, Math.round(points)));
  const ratio = p / max;
  return {
    name,
    points: p,
    max,
    verdict: ratio >= 0.8 ? 'ok' : ratio >= 0.45 ? 'mid' : 'bad',
    detail: verdictText,
    fix: p === max ? note || 'Nothing to change here.' : fix,
  };
}

function sigStructuredData(html) {
  const blocks = jsonLdBlocks(html);
  const parsed = blocks.filter((b) => b.ok);
  const broken = blocks.length - parsed.length;
  const types = new Set();
  parsed.forEach((b) => collectTypes(b.data, types));
  const hasMicrodata = /\bitemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html);

  let pts = 0;
  if (parsed.length) pts += 7;
  else if (hasMicrodata) pts += 3;
  const entity = ['Organization', 'LocalBusiness', 'ProfessionalService', 'Person', 'Product'].some((t) =>
    types.has(t),
  );
  const content = ['Article', 'BlogPosting', 'NewsArticle', 'FAQPage', 'QAPage', 'HowTo', 'Service'].some((t) =>
    types.has(t),
  );
  if (entity) pts += 5;
  if (content) pts += 6;
  if (broken) pts -= 4;

  const list = [...types].slice(0, 6).join(', ');
  const detail = blocks.length
    ? `${parsed.length} JSON-LD block${parsed.length === 1 ? '' : 's'} parsed${broken ? `, ${broken} malformed` : ''}${list ? ` — types: ${list}` : ''}.`
    : hasMicrodata
      ? 'Microdata found, but no JSON-LD.'
      : 'No structured data found.';

  const fix = broken
    ? 'Fix the malformed JSON-LD first — a block that will not parse is worse than no block, because it signals carelessness to every validator.'
    : !blocks.length
      ? 'Add JSON-LD: one entity type (Organization or LocalBusiness) plus the type that matches this page (Article, Service, FAQPage).'
      : !entity
        ? 'Add an entity block — Organization or LocalBusiness — so machines know who publishes this.'
        : 'Add the content type that matches this page: Article, Service, FAQPage or HowTo.';

  return sig(
    'Structured data',
    18,
    pts,
    detail,
    fix,
    'Entity and content types both present and parsing cleanly.',
  );
}

function sigAnswerFirst(body, words) {
  const firstH2 = body.search(/<h2\b/i);
  const opening = textOf(firstH2 > 0 ? body.slice(0, firstH2) : body.slice(0, 6000));
  const openWords = wordsIn(opening);
  const first60 = openWords.slice(0, 60).join(' ');

  const sentences = opening.split(/(?<=[.!?])\s+/).filter((s) => wordsIn(s).length > 3);
  const firstSentence = sentences[0] || '';
  const fsLen = wordsIn(firstSentence).length;

  const definitional =
    /\b(is|are|means|refers to|provides|helps|offers|does|costs|takes)\b/i.test(first60);
  const hedged = /\b(welcome to|we are a leading|in today'?s|passionate about|world-class|cutting-edge)\b/i.test(
    first60,
  );

  let pts = 0;
  if (openWords.length >= 25) pts += 4;
  if (definitional) pts += 5;
  if (fsLen >= 8 && fsLen <= 32) pts += 4;
  if (!hedged) pts += 2;
  if (words.length < 120) pts = Math.min(pts, 5);

  const detail = openWords.length
    ? `Opening runs ${openWords.length} words before the first section break; first sentence is ${fsLen} words.${hedged ? ' Contains marketing filler.' : ''}`
    : 'No text found before the first section heading.';

  return sig(
    'Answer-first opening',
    15,
    pts,
    detail,
    hedged
      ? 'Cut the filler opener. Lead with a plain declarative sentence that answers what this page is about — roughly 44% of ChatGPT citations come from the first 30% of a page.'
      : 'Open with one short declarative sentence that directly states the answer, then expand. Models quote the opening far more often than the middle.',
    'Opens with a direct, quotable statement.',
  );
}

function sigHeadings(html) {
  const hs = headings(html);
  const h1 = hs.filter((h) => h.level === 1);
  const h2 = hs.filter((h) => h.level === 2);

  let skipped = false;
  let prev = 0;
  for (const h of hs) {
    if (prev && h.level > prev + 1) skipped = true;
    prev = h.level;
  }
  const questionish = hs.filter((h) =>
    /\?|^(what|how|why|when|who|which|does|do|can|is|are|should)\b/i.test(h.text.trim()),
  ).length;

  let pts = 0;
  if (h1.length === 1) pts += 5;
  else if (h1.length > 1) pts += 1;
  if (h2.length >= 3) pts += 4;
  else if (h2.length >= 1) pts += 2;
  if (!skipped && hs.length > 1) pts += 3;
  if (questionish >= 2) pts += 3;
  else if (questionish === 1) pts += 1;

  const detail = `${h1.length} H1, ${h2.length} H2, ${hs.length} headings total. ${skipped ? 'Levels are skipped.' : 'Level order is clean.'} ${questionish} question-form heading${questionish === 1 ? '' : 's'}.`;

  return sig(
    'Heading structure',
    15,
    pts,
    detail,
    h1.length !== 1
      ? 'Use exactly one H1, then nest H2s beneath it. Sequential heading structure is associated with roughly 2.8x higher citation odds.'
      : skipped
        ? 'Do not skip levels — an H2 should never be followed directly by an H4.'
        : 'Phrase more subheadings as the question a person would actually type. Question headings give a model an obvious answer boundary to lift.',
    'One H1, clean nesting, question-shaped subheadings.',
  );
}

function sigFormats(body) {
  const tables = (body.match(/<table\b/gi) || []).length;
  const tableHeaders = (body.match(/<th\b/gi) || []).length;
  const lists = (body.match(/<(ul|ol)\b/gi) || []).length;
  const items = (body.match(/<li\b/gi) || []).length;
  const dls = (body.match(/<dl\b/gi) || []).length;
  const details = (body.match(/<details\b/gi) || []).length;

  let pts = 0;
  if (tables && tableHeaders) pts += 7;
  else if (tables) pts += 4;
  if (lists >= 2 && items >= 6) pts += 4;
  else if (lists >= 1) pts += 2;
  if (dls || details) pts += 3;

  const detail = `${tables} table${tables === 1 ? '' : 's'} (${tableHeaders} header cell${tableHeaders === 1 ? '' : 's'}), ${lists} list${lists === 1 ? '' : 's'} with ${items} items${dls || details ? ', plus definition or disclosure markup' : ''}.`;

  return sig(
    'Extractable formats',
    14,
    pts,
    detail,
    !tables
      ? 'Add at least one real HTML table with <th> headers. Tables are extracted far more reliably than the same facts written as prose.'
      : 'Add headed rows to your tables and break long prose passages into lists a model can lift whole.',
    'Facts are in shapes a model can lift cleanly.',
  );
}

function sigEvidence(body, text, words) {
  const numbers = (text.match(/\b\d[\d,.]*\s?(%|percent|per cent|x\b)?/g) || []).length;
  const per1k = words.length ? (numbers / words.length) * 1000 : 0;
  const quotes = (body.match(/<blockquote\b/gi) || []).length + (text.match(/[“"][^”"]{40,}[”"]/g) || []).length;

  const host = attr(body, 'base', 'href');
  const outbound = new Set();
  const re = /<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(body))) {
    try {
      const h = new URL(m[1]).hostname.replace(/^www\./, '');
      if (!/facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|pinterest/.test(h)) outbound.add(h);
    } catch {}
  }
  void host;

  let pts = 0;
  if (per1k >= 12) pts += 6;
  else if (per1k >= 5) pts += 4;
  else if (per1k >= 2) pts += 2;
  if (outbound.size >= 3) pts += 5;
  else if (outbound.size >= 1) pts += 2;
  if (quotes >= 1) pts += 3;

  const detail = `${numbers} figures across ${words.length} words (${per1k.toFixed(1)} per 1,000), ${outbound.size} distinct outbound domain${outbound.size === 1 ? '' : 's'}, ${quotes} block quotation${quotes === 1 ? '' : 's'}.`;

  return sig(
    'Evidence density',
    14,
    pts,
    detail,
    per1k < 5
      ? 'Put real figures in the copy. Adding statistics is associated with roughly 22% higher AI visibility, and adding quotations roughly 37%.'
      : 'Cite the sources behind your figures with outbound links, and quote a named authority at least once.',
    'Claims carry figures, sources and attribution.',
  );
}

function sigPosition(body) {
  const cut = Math.floor(body.length * 0.3);
  const head = wordsIn(textOf(body.slice(0, cut))).length;
  const total = wordsIn(textOf(body)).length || 1;
  const share = head / total;

  let pts = 0;
  if (share >= 0.3) pts = 8;
  else if (share >= 0.2) pts = 6;
  else if (share >= 0.12) pts = 4;
  else if (share >= 0.06) pts = 2;

  return sig(
    'Substance placed early',
    8,
    pts,
    `${Math.round(share * 100)}% of the page's words sit in the first 30% of its markup.`,
    'Move real content above the decoration. Heavy nav, hero markup and carousels push your actual answer past the part of the page models weight most heavily.',
    'Real content starts early in the document.',
  );
}

function sigCrawlers(robots) {
  if (!robots.found) {
    return sig(
      'AI crawler access',
      10,
      8,
      'No robots.txt found, so nothing is disallowed.',
      'Add a robots.txt. Not having one works by default, but you lose the ability to state anything deliberately.',
    );
  }

  const groups = [];
  let current = null;
  for (const line of robots.text.split(/\r?\n/)) {
    const l = line.replace(/#.*$/, '').trim();
    if (!l) continue;
    const ua = l.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) {
      if (!current || current.rules.length) current = { agents: [], rules: [] };
      current.agents.push(ua[1].trim());
      if (!groups.includes(current)) groups.push(current);
      continue;
    }
    const dis = l.match(/^disallow\s*:\s*(.*)$/i);
    if (dis && current) current.rules.push(dis[1].trim());
  }

  const blocked = [];
  for (const agent of AI_AGENTS) {
    const g = groups.find((x) => x.agents.some((a) => a.toLowerCase() === agent.toLowerCase()));
    if (g && g.rules.some((r) => r === '/')) blocked.push(agent);
  }
  const star = groups.find((x) => x.agents.includes('*'));
  const starBlocksAll = star && star.rules.some((r) => r === '/');

  let pts = 10;
  if (starBlocksAll) pts = 0;
  else pts -= Math.min(10, blocked.length * 3);

  const detail = starBlocksAll
    ? 'robots.txt disallows everything for all user agents.'
    : blocked.length
      ? `Blocked by name: ${blocked.join(', ')}.`
      : 'No AI crawler is disallowed.';

  return sig(
    'AI crawler access',
    10,
    pts,
    detail,
    starBlocksAll
      ? 'Your robots.txt blocks every crawler from the whole site. Nothing else on this list matters until that is fixed.'
      : 'You are blocking crawlers you may want. Blocking GPTBot or ClaudeBot removes you from those answers entirely — a legitimate choice, but make it on purpose.',
    'Answer engines are allowed to read the page.',
  );
}

function sigMetadata(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const desc = metaContent(html, 'description') ?? '';
  const canonical = /<link\b[^>]*rel\s*=\s*["']canonical["']/i.test(html);
  const lang = attr(html, 'html', 'lang');

  let pts = 0;
  if (title.length >= 25 && title.length <= 65) pts += 2;
  else if (title.length) pts += 1;
  if (desc.length >= 70 && desc.length <= 165) pts += 2;
  else if (desc.length) pts += 1;
  if (canonical) pts += 1;
  if (lang) pts += 1;

  const detail = `Title ${title.length} chars, description ${desc.length} chars, canonical ${canonical ? 'present' : 'missing'}, lang ${lang ? `"${lang}"` : 'missing'}.`;

  return sig(
    'Metadata hygiene',
    6,
    pts,
    detail,
    'Aim for a 25-65 character title, a 70-165 character description, a canonical link and a lang attribute. Basic, but it is what gets rewritten when it is wrong.',
    'Title, description, canonical and lang all in range.',
  );
}

/* ----------------------------------------------------------------- verdict */

function band(pct) {
  if (pct >= 80) return 'Strong';
  if (pct >= 60) return 'Workable';
  if (pct >= 40) return 'Weak';
  return 'Invisible';
}

function summarise(pct, signals) {
  const worst = [...signals].sort((a, b) => a.points / a.max - b.points / b.max).slice(0, 2);
  const names = worst.map((s) => s.name.toLowerCase()).join(' and ');
  if (pct >= 80)
    return `This page is already shaped the way answer engines like. The remaining gains are in ${names} — worth doing, but you do not need an agency for them.`;
  if (pct >= 60)
    return `The foundations are there. ${worst[0].name} is the constraint, and fixing it plus ${worst[1].name.toLowerCase()} would move this page more than any amount of new content.`;
  if (pct >= 40)
    return `This page is readable but not extractable. ${names} are the two things holding it back, and both are structural rather than editorial.`;
  return `An answer engine has little to work with here. Start with ${names} — until those exist, publishing more content will not help.`;
}


// Exported for the repo's own test harness; unused by the Worker runtime.
export { scoreAll, normaliseUrl, band, summarise };
