import { searchCpsc, searchFda, searchNcc } from './sources.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra } });
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Answers are remembered for six hours. CHANGE THIS LABEL whenever the way recalls are searched or matched changes,
// so answers remembered by the older rules are dropped at once instead of being served for hours after an update.
const CACHE_VERSION = 'v3';

// A notice that matches only by brand and product NAME and is older than this probably does not apply to a product bought today.
// (An exact barcode or batch match is never called old.)
const OLD_AFTER_MS = 2 * 365.25 * 24 * 3600 * 1000;
const isOld = (r) => r.matchType === 'name' && !r.batchMatch && Boolean(r.date) && Date.now() - Date.parse(r.date) > OLD_AFTER_MS;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (request.method !== 'GET' || !['/', '/lookup'].includes(url.pathname)) return json({ error: 'not_found' }, 404);

    const debug = url.searchParams.get('debug') === '1'; // explains what was asked; never cached
    const barcode = clean(url.searchParams.get('barcode'), 20).replace(/\D/g, '');
    const query = {
      barcode: barcode.length >= 8 && barcode.length <= 14 ? barcode : '',
      batch: clean(url.searchParams.get('batch'), 40),
      name: clean(url.searchParams.get('name'), 80),
      brand: clean(url.searchParams.get('brand'), 60),
    };
    if (barcode && !query.barcode) return json({ error: 'invalid_barcode' }, 400);
    if (!query.barcode && !query.brand && !query.name) return json({ error: 'need_barcode_or_name' }, 400);

    // Same question asked again within six hours: answer from memory (also keeps the free limits safe).
    const cacheKey = new Request(`https://recall-cache.invalid/${env.CACHE_VERSION || CACHE_VERSION}?${new URLSearchParams(query).toString()}`);
    const cache = caches.default;
    const cached = debug ? null : await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, 'x-cache': 'hit' } });

    const bases = {
      cpsc: env.CPSC_BASE || 'https://www.saferproducts.gov/RestWebServices/Recall',
      fda: env.FDA_BASE || 'https://api.fda.gov/food/enforcement.json',
      ncc: env.NCC_BASE || 'https://thencc.org.za',
    };
    const jobs = [
      ['NCC South Africa', searchNcc(bases.ncc, query)],
      ['US CPSC', searchCpsc(bases.cpsc, query)],
      ['US FDA food', searchFda(bases.fda, query, env.OPENFDA_API_KEY)],
    ];
    const settled = await Promise.allSettled(jobs.map(([, p]) => p));
    const sourcesChecked = [];
    const sourcesFailed = [];
    let items = [];
    const explain = {};
    settled.forEach((result, i) => {
      const label = jobs[i][0];
      if (result.status === 'fulfilled') {
        if (!result.value.skipped) sourcesChecked.push(result.value.partial ? `${label} (recent notices only)` : label);
        if (result.value.info) explain[label === 'NCC South Africa' ? 'ncc' : label] = { ...result.value.info, matched: (result.value.items || []).length };
        items = items.concat(result.value.items || []);
      } else { sourcesFailed.push(label); explain[label === 'NCC South Africa' ? 'ncc' : label] = { error: String((result.reason && result.reason.message) || result.reason) }; }
    });

    // Strongest evidence first (barcode or batch), then newest.
    const byId = new Map();
    for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
    const recalls = [...byId.values()]
      .map((r) => ({ ...r, confidence: r.matchType === 'barcode' || r.batchMatch ? 'high' : 'possible', old: isOld(r) }))
      .sort((a, b) => (a.confidence !== b.confidence ? (a.confidence === 'high' ? -1 : 1) : a.old !== b.old ? (a.old ? 1 : -1) : String(b.date).localeCompare(String(a.date))))
      .slice(0, 5);

    const checked = sourcesChecked.length > 0;
    const hasRecall = recalls.length > 0;
    const strong = recalls.some((r) => r.confidence === 'high');
    const onlyOld = hasRecall && recalls.every((r) => r.old);
    const summary = hasRecall
      ? (strong ? 'A recall notice lists this product. Read it and check your batch or lot.' : onlyOld ? `An older recall notice (${String(recalls[0].date).slice(0, 4)}) matches this brand and product name. It probably does not apply to a product bought today, but check the batch or lot on your pack.` : 'A recall notice may match this product (same brand and product name). Check the batch or lot on your pack.')
      : checked ? `No recall notice found in: ${sourcesChecked.join(', ')}. This is not a guarantee.` : 'The recall lists could not be reached right now.';

    const body = { checked, hasRecall, found: hasRecall, onlyOld, summary, recalls, sourcesChecked, sourcesFailed, checkedAt: new Date().toISOString() };
    if (debug) body.debug = explain;
    if (checked && !debug) {
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=21600' } })));
    }
    return json(body, 200, { 'x-cache': 'miss' });
  },
};
