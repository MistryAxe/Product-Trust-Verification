import { barcodeCores, batchMentioned, nameMatch, textHasBarcode, tokens } from './match.js';

const UA = 'ProductTrustRecallLookup/1.0 (student project)';
const MAX_BYTES = 250000; // never read more than this from one answer: the free plan allows only ~10 ms of work per request

// ---- small helpers ---------------------------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...' };
export function cleanText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim();
}
const short = (text, n) => { const t = cleanText(text); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const isoFrom = (value) => {
  const s = String(value || '');
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};
function yearsAgo(n) {
  const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
}

// Reads at most MAX_BYTES of an answer, with a time limit. Throws on anything unexpected.
export async function getText(url, { timeoutMs = 4000, accept = 'application/json' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept, 'user-agent': UA } });
    if (res.status === 404) return { status: 404, text: '' };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('answer too large');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = ''; let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { try { await reader.cancel(); } catch (_) { /* ignore */ } throw new Error('answer too large'); }
      text += decoder.decode(value, { stream: true });
    }
    return { status: res.status, text };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function getJson(url, options) {
  const { status, text } = await getText(url, options);
  if (status === 404 || !text) return null;
  try { return JSON.parse(text); } catch (_) { throw new Error('not valid JSON'); }
}

const FOREIGN_SCOPE = (place) => `Issued in ${place}. It may not cover products sold in South Africa, so check the batch or lot on your pack.`;

// ---- US Consumer Product Safety Commission (consumer goods, electronics, toys...) ----------------------
export function parseCpsc(json, ctx) {
  const list = Array.isArray(json) ? json : [];
  if (list.length > 80) throw new Error('query was not filtered (too many results)');
  const cores = barcodeCores(ctx.barcode);
  const out = [];
  for (const r of list) {
    const upcs = (r.ProductUPCs || []).map((u) => u?.UPC).filter(Boolean);
    const productNames = (r.Products || []).map((p) => `${p?.Name || ''} ${p?.Model || ''}`).join(' ');
    const firms = [...(r.Manufacturers || []), ...(r.Importers || []), ...(r.Distributors || [])].map((f) => f?.Name || '').join(' ');
    const text = `${r.Title || ''} ${productNames} ${firms} ${r.Description || ''}`;
    let matchType = '';
    let matched = [];
    if (cores.length && (upcs.some((u) => cores.includes(String(u).replace(/\D/g, '').replace(/^0+/, ''))) || textHasBarcode(text, cores))) matchType = 'barcode';
    else {
      const nm = nameMatch(ctx, `${r.Title || ''} ${productNames} ${firms}`);
      if (nm.ok) { matchType = 'name'; matched = nm.matched; }
    }
    if (!matchType) continue;
    out.push({
      id: `cpsc-${r.RecallNumber || r.RecallID}`, source: 'cpsc', sourceName: 'US Consumer Product Safety Commission', country: 'United States',
      title: short(r.Title, 160), date: isoFrom(r.RecallDate), reason: short((r.Hazards || [])[0]?.Name || r.Description, 220),
      url: String(r.URL || '').trim(), remedy: short((r.RemedyOptions || []).map((o) => o?.Option).filter(Boolean).join(', '), 80),
      matchType, matched, batchMatch: batchMentioned(text, ctx.batch), scope: FOREIGN_SCOPE('the United States'),
    });
  }
  return out;
}
export async function searchCpsc(base, ctx) {
  const queries = [];
  const cores = barcodeCores(ctx.barcode);
  if (cores.length) queries.push(`${base}?format=json&UPC=${encodeURIComponent(cores[0])}`);
  const brandWords = tokens(ctx.brand);
  if (brandWords.length) queries.push(`${base}?format=json&RecallTitle=${encodeURIComponent(brandWords[0])}&RecallDateStart=${yearsAgo(3)}`);
  if (!queries.length) return { skipped: true, items: [] };
  const answers = await Promise.all(queries.map((q) => getJson(q)));
  return { items: answers.flatMap((a) => parseCpsc(a, ctx)) };
}

// ---- US FDA food recalls (openFDA enforcement reports) -----------------------------------------------------
export function parseFda(json, ctx) {
  const list = Array.isArray(json?.results) ? json.results : [];
  const cores = barcodeCores(ctx.barcode);
  const cutoff = yearsAgo(3);
  const out = [];
  for (const r of list) {
    const text = `${r.product_description || ''} ${r.code_info || ''} ${r.more_code_info || ''}`;
    const date = isoFrom(r.report_date);
    let matchType = '';
    let matched = [];
    if (cores.length && textHasBarcode(text, cores)) matchType = 'barcode';
    else if (date && date >= cutoff) {
      const nm = nameMatch(ctx, `${r.product_description || ''} ${r.recalling_firm || ''}`);
      if (nm.ok) { matchType = 'name'; matched = nm.matched; }
    }
    if (!matchType) continue;
    out.push({
      id: `fda-${r.recall_number}`, source: 'fda', sourceName: 'US Food and Drug Administration', country: 'United States',
      title: short(r.product_description, 160), date, reason: short(r.reason_for_recall, 220),
      url: `https://api.fda.gov/food/enforcement.json?search=recall_number.exact%3A%22${encodeURIComponent(r.recall_number)}%22`,
      classification: String(r.classification || ''), status: String(r.status || ''), firm: short(r.recalling_firm, 80),
      matchType, matched, batchMatch: batchMentioned(text, ctx.batch), scope: FOREIGN_SCOPE('the United States'),
    });
  }
  return out;
}
export async function searchFda(base, ctx, apiKey) {
  const queries = [];
  const cores = barcodeCores(ctx.barcode);
  const key = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  if (cores.length) {
    // The barcode is printed in several lengths in these notices, so try the two common ones.
    for (const len of [12, 13]) queries.push(`${base}?search=${encodeURIComponent(`product_description:"${cores[0].padStart(len, '0')}"`)}&limit=10${key}`);
  }
  const brandWords = tokens(ctx.brand);
  if (brandWords.length) {
    const from = yearsAgo(3).replace(/-/g, '');
    const to = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    queries.push(`${base}?search=${encodeURIComponent(`product_description:"${brandWords[0]}" AND report_date:[${from} TO ${to}]`)}&limit=40${key}`);
  }
  if (!queries.length) return { skipped: true, items: [] };
  const answers = await Promise.all(queries.map((q) => getJson(q)));
  return { items: answers.flatMap((a) => parseFda(a, ctx)) };
}

// ---- South Africa: National Consumer Commission (NCC) ------------------------------------------------------------
const looksLikeRecall = (s) => /recall/i.test(s);
// The NCC's automatic summary is often just its contact-page boilerplate. That tells a customer nothing, so it is dropped.
export function usefulReason(text) {
  const t = cleanText(text);
  if (!t || /^to contact\b/i.test(t) || /contact page/i.test(t) || /use any of the channels/i.test(t)) return '';
  return t;
}
export function parseNccRest(json, ctx) {
  const list = Array.isArray(json) ? json : [];
  const out = [];
  for (const p of list) {
    const title = cleanText(p?.title?.rendered || '');
    const excerpt = cleanText(p?.excerpt?.rendered || '');
    const link = String(p?.link || '');
    if (!looksLikeRecall(`${title} ${link}`)) continue;
    const nm = nameMatch(ctx, `${title} ${excerpt}`);
    if (!nm.ok) continue;
    out.push({
      id: `ncc-${p.id || link}`, source: 'ncc', sourceName: 'National Consumer Commission (South Africa)', country: 'South Africa',
      title: short(title, 160), date: isoFrom(p.date), reason: short(usefulReason(excerpt), 220), url: link,
      matchType: 'name', matched: nm.matched, batchMatch: batchMentioned(`${title} ${excerpt}`, ctx.batch),
      scope: 'Issued by the National Consumer Commission for South Africa. Check the batch or lot on your pack against the notice.',
    });
  }
  return out;
}
// Fallback if the site's search service is switched off: read the recall links on the recall list page.
export function parseNccHtml(html, ctx) {
  const out = [];
  const seen = new Set();
  const anchor = /<a\b[^>]*href="(https?:\/\/[^"#]*thencc\.org\.za\/[^"#]+|\/[^"#]+)"[^>]*>([\s\S]{3,400}?)<\/a>/gi;
  let m;
  while ((m = anchor.exec(String(html || '')))) {
    const link = m[1];
    const title = cleanText(m[2]);
    if (title.length < 12 || seen.has(link) || !looksLikeRecall(`${title} ${link}`)) continue;
    seen.add(link);
    const nm = nameMatch(ctx, `${title} ${link.replace(/[-_/]+/g, ' ')}`);
    if (!nm.ok) continue;
    out.push({
      id: `ncc-${link}`, source: 'ncc', sourceName: 'National Consumer Commission (South Africa)', country: 'South Africa',
      title: short(title, 160), date: '', reason: '', url: link,
      matchType: 'name', matched: nm.matched, batchMatch: false,
      scope: 'Issued by the National Consumer Commission for South Africa. Check the batch or lot on your pack against the notice.',
    });
  }
  return out;
}
// The NCC site is WordPress, and WordPress search returns a post only if it contains EVERY word searched for.
// A long question ("mccain green beans") therefore misses a notice that says "McCain Beans". So ask SHORT questions
// (the brand alone, and the brand plus one product word) and let our own matching (nameMatch) decide what is relevant.
export function nccQueries(ctx) {
  const brand = tokens(ctx.brand);
  const rest = tokens(ctx.name).filter((t) => !brand.includes(t));
  if (!brand.length || !rest.length) return []; // a brand alone can never be matched safely, so do not ask
  return [...new Set([brand.join(' '), `${brand.join(' ')} ${rest[0]}`])];
}
export async function searchNcc(base, ctx) {
  const queries = nccQueries(ctx);
  if (!queries.length) return { skipped: true, items: [] };
  const info = { via: 'rest', queries, fetched: 0 };
  const answers = await Promise.all(queries.map((q, i) => getJson(`${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=${i === 0 ? 30 : 15}&_fields=id,date,link,title,excerpt`).catch(() => undefined)));
  const lists = answers.filter(Array.isArray);
  if (lists.length) {
    const seen = new Set();
    const posts = [];
    for (const list of lists) for (const post of list) { const key = post && (post.id || post.link); if (key && !seen.has(key)) { seen.add(key); posts.push(post); } }
    info.fetched = posts.length;
    return { items: parseNccRest(posts, ctx), info };
  }
  // The site's search service is switched off: fall back to the recall list pages (recent notices only).
  const pages = await Promise.all([`${base}/product-recalls/`, `${base}/`].map((u) => getText(u, { accept: 'text/html' }).catch(() => null)));
  const good = pages.filter((p) => p && p.text);
  if (!good.length) throw new Error('recall pages unavailable');
  info.via = 'pages';
  return { items: good.flatMap((p) => parseNccHtml(p.text, ctx)), partial: true, info };
}
