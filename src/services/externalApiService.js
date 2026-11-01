import { API_CONFIG } from '../config/api';
import { fetchWithTimeout, isTimeoutError, withDeadline } from '../utils/netFetch';

const barcodeCache = new Map();
const BARCODE_CACHE_MS = 60 * 60 * 1000;

async function requestJson(url, options = {}) {
  if (!url) throw new Error('External API endpoint is not configured.');
  const response = await fetchWithTimeout(url, { timeoutMs: 9000, ...options });
  const bodyText = await response.text();
  let payload = {};
  try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch (_) { payload = { message: bodyText }; }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `External API request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

function cleanTag(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutLanguage = raw.includes(':') ? raw.split(':').slice(1).join(':') : raw;
  return withoutLanguage
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeGrade(value) {
  const grade = normalizeText(value).toUpperCase();
  return ['UNKNOWN', 'N/A', 'NA', 'NOT APPLICABLE', 'NOT-APPLICABLE'].includes(grade) ? '' : grade;
}

function normalizeTagList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanTag).filter(Boolean);
}

function normalizeBarcode(value = '') {
  return String(value || '').replace(/\D/g, '').trim();
}

function barcodeVariants(value = '') {
  const barcode = normalizeBarcode(value);
  const variants = [barcode];
  if (barcode.length === 12) variants.push(`0${barcode}`);
  if (barcode.length === 13 && barcode.startsWith('0')) variants.push(barcode.slice(1));
  return [...new Set(variants.filter(Boolean))];
}

export function extractWebUrlFromScanData(value = '') {
  const raw = String(value || '').trim();
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch (_) {}
  return '';
}

const ELECTRONICS_TERMS = [
  'electronics', 'electronic', 'smartphone', 'mobile phone', 'cell phone', 'phone', 'tablet', 'laptop',
  'computer', 'monitor', 'television', 'tv', 'charger', 'adapter', 'power bank', 'powerbank', 'cable',
  'headphone', 'headphones', 'earphone', 'earphones', 'earbuds', 'speaker', 'keyboard', 'mouse', 'router',
  'modem', 'camera', 'printer', 'scanner', 'memory card', 'flash drive', 'usb drive', 'hard drive', 'ssd',
  'battery', 'smartwatch', 'watch', 'console', 'controller', 'remote control', 'microphone', 'projector'
];


const EQUIPMENT_TERMS = [
  'equipment', 'machine', 'machinery', 'industrial', 'industrial supplies', 'tools', 'tool', 'hardware', 'home improvement', 'power tool', 'hand tool', 'drill', 'grinder', 'sander',
  'saw', 'welder', 'welding', 'compressor', 'generator', 'pump', 'motor', 'valve', 'bearing', 'gearbox',
  'inverter', 'ups', 'transformer', 'breaker', 'circuit breaker', 'contactor', 'relay', 'sensor', 'meter',
  'multimeter', 'clamp meter', 'oscilloscope', 'instrument', 'caliper', 'micrometer', 'thermometer',
  'pressure gauge', 'test equipment', 'safety equipment', 'medical equipment', 'ladder', 'hoist', 'jack', 'torque wrench', 'spanner', 'socket set', 'toolbox',
  'vacuum cleaner', 'microwave', 'refrigerator', 'fridge', 'washing machine', 'heater', 'fan', 'kettle',
  'air conditioner', 'aircon', 'battery charger', 'car battery', 'automotive part', 'brake pad', 'spark plug',
  'filter', 'tyre', 'tire', 'laboratory equipment', 'microscope', 'centrifuge', 'scale', 'weighing scale'
];

const EQUIPMENT_SUBTYPES = [
  ['Power tool', ['drill', 'grinder', 'sander', 'saw', 'power tool', 'welder', 'welding']],
  ['Industrial equipment', ['industrial', 'machine', 'machinery', 'compressor', 'generator', 'pump', 'motor', 'valve', 'gearbox', 'hoist']],
  ['Electrical equipment', ['inverter', 'ups', 'transformer', 'breaker', 'circuit breaker', 'contactor', 'relay', 'meter']],
  ['Measuring instrument', ['multimeter', 'clamp meter', 'oscilloscope', 'instrument', 'caliper', 'micrometer', 'thermometer', 'pressure gauge']],
  ['Home appliance', ['vacuum cleaner', 'microwave', 'refrigerator', 'fridge', 'washing machine', 'heater', 'fan', 'kettle', 'air conditioner', 'aircon']],
  ['Automotive equipment', ['car battery', 'automotive part', 'brake pad', 'spark plug', 'filter', 'tyre', 'tire', 'jack']],
  ['Laboratory equipment', ['laboratory equipment', 'microscope', 'centrifuge', 'scale', 'weighing scale']],
  ['Hand tool', ['torque wrench', 'spanner', 'socket set', 'toolbox', 'hand tool']],
];

const STATIONERY_TERMS = [
  'stationery', 'office supply', 'office supplies', 'pen', 'pencil', 'marker', 'highlighter', 'notebook',
  'exercise book', 'writing pad', 'memo pad', 'paper', 'copy paper', 'printer paper', 'stapler', 'staples',
  'eraser', 'rubber', 'ruler', 'glue', 'glue stick', 'scissors', 'folder', 'file', 'binder', 'envelope',
  'label', 'labels', 'calculator', 'sharpener', 'crayon', 'crayons', 'paint', 'paint brush', 'whiteboard',
  'clipboard', 'toner', 'ink cartridge', 'cartridge', 'desk accessory', 'school supply', 'school supplies'
];

const FOOD_TERMS = [
  'food', 'beverage', 'drink', 'juice', 'water', 'milk', 'coffee', 'tea', 'snack', 'grocery', 'cereal',
  'chocolate', 'sweet', 'candy', 'bread', 'cheese', 'yogurt', 'yoghurt', 'meat', 'sauce', 'fruit', 'vegetable'
];

function includesAny(text = '', terms = []) {
  const haystack = String(text || '').toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function classifyProductKind(product = {}) {
  const declared = String(product.productType || '').toLowerCase();
  const haystack = [
    product.name, product.genericName, product.brand, product.category, product.description, product.model,
    product.packaging, product.labels, declared,
  ].filter(Boolean).join(' ');

  if (declared === 'food' || includesAny(haystack, FOOD_TERMS) || product.usdaMatch || meaningful(product.ingredientsText) || Object.keys(product.nutriments || {}).length > 0) return 'food';
  if (declared === 'beauty') return 'beauty';
  if (declared === 'petfood') return 'pet';
  if (includesAny(haystack, STATIONERY_TERMS)) return 'stationery';
  if (includesAny(haystack, EQUIPMENT_TERMS)) return 'equipment';
  if (includesAny(haystack, ELECTRONICS_TERMS)) return 'electronics';
  if (includesAny(haystack, ['book', 'isbn', 'textbook', 'novel'])) return 'book';
  return 'general';
}

function classifyEquipmentType(product = {}) {
  const haystack = [product.name, product.genericName, product.brand, product.category, product.description, product.model]
    .filter(Boolean).join(' ').toLowerCase();
  const match = EQUIPMENT_SUBTYPES.find(([, terms]) => terms.some((term) => haystack.includes(term)));
  return match?.[0] || (product.productClass === 'equipment' ? 'General equipment' : '');
}

function likelyFoodRecord(offRaw, upcRaw) {
  const declared = normalizeText(offRaw?.product_type).toLowerCase();
  if (declared === 'food') return true;
  const haystack = [
    offRaw?.product_name, offRaw?.generic_name, offRaw?.brands, offRaw?.categories,
    upcRaw?.title, upcRaw?.description, upcRaw?.brand, upcRaw?.category,
  ].filter(Boolean).join(' ');
  return includesAny(haystack, FOOD_TERMS);
}

function tokenSet(value = '') {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

function tokenSimilarity(left = '', right = '') {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((token) => b.has(token)).length;
  return common / Math.max(a.size, b.size);
}


// ---------------------------------------------------------------------------
// Relevance checks.
// A web page may only describe a scanned product if it PROVES it is about that
// product: it must contain the scanned barcode, or (when the brand and name are
// already known from a reliable source or the label) clearly match them.
// Anything else is discarded. Without this, a barcode that no shop lists makes
// the search return random pages (a dictionary, a cornhole shop...) and the
// app used to copy their title, brand and picture as if they were the product.
// ---------------------------------------------------------------------------
function stripLeadingZeros(value = '') {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '');
}

function sameGtin(left = '', right = '') {
  const a = stripLeadingZeros(left);
  const b = stripLeadingZeros(right);
  return Boolean(a) && a === b;
}

// True when the text contains one of the barcodes as a complete number
// (not as part of a longer number). Spaces/hyphens inside a number are ignored.
function mentionedBarcode(text = '', variants = []) {
  const raw = String(text || '');
  if (!raw || !variants.length) return false;
  const squeezed = raw.replace(/(\d)[ -](?=\d)/g, '$1');
  return variants.some((variant) => {
    if (!variant || variant.length < 8) return false;
    const pattern = new RegExp(`(^|\\D)${variant}(\\D|$)`);
    return pattern.test(raw) || pattern.test(squeezed);
  });
}

// Share of the wanted words that appear in the text (0..1).
function wordCoverage(wanted = '', text = '') {
  const need = tokenSet(wanted);
  if (!need.size) return 0;
  const have = tokenSet(text);
  return [...need].filter((token) => have.has(token)).length / need.size;
}

/**
 * Keep only the search results (and fetched pages) that prove they match.
 * context.barcodes  - scanned barcode variants
 * context.identity  - { brand, name, model } when already known
 * Each kept item is tagged evidence: 'barcode' (page lists this exact code) or
 * 'identity' (brand and name match, but the page does not show the barcode).
 */
function acceptWebEvidence(results = [], pages = [], context = {}) {
  const barcodes = Array.isArray(context.barcodes) ? context.barcodes : [];
  const identity = context.identity || {};
  const identityText = [identity.brand, identity.name, identity.model].filter(Boolean).join(' ');
  const brandTokens = [...tokenSet(identity.brand || '')];
  const keptResults = [];
  const keptPages = [];

  results.forEach((result) => {
    const page = pages.find((item) => item?.url && item.url === result.link) || null;
    // The page is about a DIFFERENT barcode: never use it.
    if (page?.gtinConflict) return;

    const barcodeHit = barcodes.length > 0 && (
      mentionedBarcode(`${result.title} ${result.snippet} ${result.link}`, barcodes)
      || page?.mentionsBarcode === true
      || (page?.gtin && barcodes.some((code) => sameGtin(code, page.gtin)))
    );

    let evidence = barcodeHit ? 'barcode' : '';
    if (!evidence && identityText) {
      const text = `${page?.name || ''} ${result.title || ''} ${result.snippet || ''}`;
      const wanted = tokenSet(identityText);
      const coverage = wordCoverage(identityText, text);
      const brandOk = !brandTokens.length || brandTokens.some((token) => tokenSet(text).has(token));
      const enough = wanted.size === 1 ? coverage >= 1 : coverage >= 0.6;
      if (enough && brandOk) evidence = 'identity';
    }
    if (!evidence) return;

    keptResults.push({ ...result, evidence });
    if (page) keptPages.push({ ...page, evidence });
  });

  keptResults.sort((a, b) => (a.evidence === 'barcode' ? 0 : 1) - (b.evidence === 'barcode' ? 0 : 1));
  keptPages.sort((a, b) => (a.evidence === 'barcode' ? 0 : 1) - (b.evidence === 'barcode' ? 0 : 1));
  return { results: keptResults, pages: keptPages, rejected: results.length - keptResults.length };
}

export function extractGtinFromScanData(value = '') {
  const raw = String(value || '').trim();
  const digitsOnly = raw.replace(/\D/g, '');
  if (/^\d{8,14}$/.test(raw)) return raw;

  const explicitPatterns = [
    /\(01\)(\d{14})/,
    /(?:^|[^0-9])01(\d{14})(?:[^0-9]|$)/,
    /\/01\/(\d{14})(?:[/?#]|$)/,
    /[?&](?:gtin|gtin14|01)=(\d{14})(?:&|$)/i,
  ];
  for (const pattern of explicitPatterns) {
    const match = raw.match(pattern);
    if (match?.[1] && validateGtin(match[1]).valid) return match[1];
  }

  if (/^\d{8,14}$/.test(digitsOnly) && validateGtin(digitsOnly).valid) return digitsOnly;
  return '';
}

export function validateGtin(barcode) {
  const digits = normalizeBarcode(barcode);
  if (![8, 12, 13, 14].includes(digits.length)) {
    return { valid: false, type: `GTIN-${digits.length || '?'}`, reason: 'Unsupported GTIN length' };
  }
  const body = digits.slice(0, -1).split('').map(Number).reverse();
  const sum = body.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  const expected = (10 - (sum % 10)) % 10;
  const actual = Number(digits.at(-1));
  return {
    valid: expected === actual,
    type: digits.length === 12 ? 'UPC-A / GTIN-12' : `GTIN-${digits.length}`,
    expectedCheckDigit: expected,
    actualCheckDigit: actual,
  };
}

function meaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function assignIfMissing(target, key, value, source, fieldSources) {
  if (!meaningful(target[key]) && meaningful(value)) {
    target[key] = value;
    fieldSources[key] = source;
  }
}

function normalizeOffNutrients(nutriments = {}) {
  return nutriments && typeof nutriments === 'object' ? { ...nutriments } : {};
}

function getUsdaNutrient(food, names = []) {
  const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const wanted = names.map((name) => name.toLowerCase());
  const hit = nutrients.find((entry) => {
    const label = String(entry?.nutrientName || entry?.nutrient?.name || '').toLowerCase();
    return wanted.some((name) => label === name || label.includes(name));
  });
  if (!hit) return null;
  const value = Number(hit?.value ?? hit?.amount);
  if (!Number.isFinite(value)) return null;
  return { value, unit: String(hit?.unitName || hit?.nutrient?.unitName || '').toLowerCase() };
}

function buildUsdaNutrients(food) {
  const result = {};
  const put = (key, hit, defaultUnit = '') => {
    if (!hit) return;
    result[`${key}_100g`] = hit.value;
    result[`${key}_unit`] = hit.unit || defaultUnit;
  };

  const energyKcal = getUsdaNutrient(food, ['energy']);
  if (energyKcal) {
    const isKj = energyKcal.unit.includes('kj');
    if (isKj) {
      result['energy-kj_100g'] = energyKcal.value;
      result['energy-kj_unit'] = 'kJ';
      result['energy-kcal_100g'] = Math.round((energyKcal.value / 4.184) * 10) / 10;
      result['energy-kcal_unit'] = 'kcal';
    } else {
      result['energy-kcal_100g'] = energyKcal.value;
      result['energy-kcal_unit'] = 'kcal';
      result['energy-kj_100g'] = Math.round((energyKcal.value * 4.184) * 10) / 10;
      result['energy-kj_unit'] = 'kJ';
    }
  }

  put('fat', getUsdaNutrient(food, ['total lipid (fat)', 'total fat']), 'g');
  put('saturated-fat', getUsdaNutrient(food, ['fatty acids, total saturated', 'saturated fat']), 'g');
  put('carbohydrates', getUsdaNutrient(food, ['carbohydrate, by difference', 'carbohydrate']), 'g');
  put('sugars', getUsdaNutrient(food, ['sugars, total including nlea', 'total sugars', 'sugars, total']), 'g');
  put('proteins', getUsdaNutrient(food, ['protein']), 'g');
  put('fiber', getUsdaNutrient(food, ['fiber, total dietary', 'dietary fiber']), 'g');
  put('cholesterol', getUsdaNutrient(food, ['cholesterol']), 'mg');

  const sodium = getUsdaNutrient(food, ['sodium, na', 'sodium']);
  if (sodium) {
    result.sodium_100g = sodium.value;
    result.sodium_unit = sodium.unit || 'mg';
    const sodiumMg = sodium.unit.includes('g') && !sodium.unit.includes('mg') ? sodium.value * 1000 : sodium.value;
    result.salt_100g = Math.round(((sodiumMg / 1000) * 2.5) * 1000) / 1000;
    result.salt_unit = 'g';
  }
  return result;
}

function mergeNutrients(base = {}, extra = {}, sourceName, nutrientSources) {
  const merged = { ...base };
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (!meaningful(merged[key]) && meaningful(value)) {
      merged[key] = value;
      if (/_100g$/.test(key)) nutrientSources[key] = sourceName;
    }
  });
  return merged;
}

// Search the web for a barcode with two different wordings at the same time,
// keeping only pages that prove they are about this exact barcode.
async function fetchBarcodeWebResearch(barcode, variants, identity = null) {
  const context = { barcodes: variants, identity: identity || undefined };
  const alt = variants.find((item) => item !== barcode);
  const queries = [
    alt ? `"${barcode}" OR "${alt}"` : `"${barcode}"`,
    `${barcode} barcode product South Africa`,
  ];
  const sets = await Promise.all(queries.map((query) => fetchSerpWebResearch(query, context)));
  const results = [];
  const pages = [];
  const seenLinks = new Set();
  const seenPages = new Set();
  let rejectedCount = 0;
  sets.forEach((set) => {
    rejectedCount += Number(set?.rejectedCount || 0);
    (set?.results || []).forEach((item) => { if (!seenLinks.has(item.link)) { seenLinks.add(item.link); results.push(item); } });
    (set?.pages || []).forEach((page) => { if (!seenPages.has(page.url)) { seenPages.add(page.url); pages.push(page); } });
  });
  results.sort((a, b) => (a.evidence === 'barcode' ? 0 : 1) - (b.evidence === 'barcode' ? 0 : 1));
  return { query: queries[0], results, pages, rejectedCount };
}

async function fetchOpenFoodFactsV2(barcode) {
  const fields = [
    'code','product_name','generic_name','brands','categories','quantity','serving_size','image_front_url','image_url',
    'image_nutrition_url','image_ingredients_url','ingredients_text','allergens_tags','traces_tags','additives_tags','nutriments',
    'nutrition_grades','nutriscore_grade','ecoscore_grade','countries','manufacturing_places','origins','labels','nova_group',
    'packaging','packaging_text','stores','purchase_places','emb_codes','url','product_type','completeness','last_modified_t'
  ].join(',');
  const url = `${API_CONFIG.openFoodFactsBaseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?product_type=all&fields=${encodeURIComponent(fields)}`;
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': API_CONFIG.openFoodFactsUserAgent },
      timeoutMs: 9000,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.status === 1 ? payload.product : null;
  } catch (_) {
    return null;
  }
}

function mergeOffVersions(primary, fallback) {
  if (!primary) return fallback || null;
  if (!fallback) return primary;
  const merged = { ...primary };
  const keys = [
    'product_name','generic_name','brands','categories','quantity','serving_size','image_front_url','image_url',
    'image_nutrition_url','image_ingredients_url','ingredients_text','allergens_tags','traces_tags','additives_tags',
    'nutrition_grades','nutriscore_grade','ecoscore_grade','countries','manufacturing_places','origins','labels','nova_group',
    'packaging','packaging_text','stores','purchase_places','emb_codes','url','product_type','completeness','last_modified_t'
  ];
  keys.forEach((key) => {
    if (!meaningful(merged[key]) && meaningful(fallback[key])) merged[key] = fallback[key];
  });
  merged.nutriments = { ...(fallback.nutriments || {}), ...(primary.nutriments || {}) };
  return merged;
}

async function fetchOpenFoodFacts(barcode) {
  const fields = [
    'code','product_name','generic_name','brands','categories','categories_tags','quantity','product_quantity','product_quantity_unit',
    'serving_size','serving_quantity','serving_quantity_unit','image_front_url','image_url','image_nutrition_url','image_ingredients_url',
    'ingredients_text','allergens','allergens_tags','traces','traces_tags','additives_tags','nutriments','nutrient_levels','nutrition_grades','nutriscore_grade',
    'ecoscore_grade','countries','countries_tags','manufacturing_places','origins','origins_tags','labels','labels_tags','nova_group','packaging','packaging_text',
    'packagings','stores','purchase_places','emb_codes','url','product_type','complete','completeness','last_modified_t'
  ].join(',');
  const url = `${API_CONFIG.openFoodFactsBaseUrl}/api/v3/product/${encodeURIComponent(barcode)}?product_type=all&fields=${encodeURIComponent(fields)}`;
  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': API_CONFIG.openFoodFactsUserAgent },
      timeoutMs: 9000,
    });
  } catch (error) {
    if (isTimeoutError(error)) throw error;
    throw new Error(`Open Food Facts could not be reached. ${error?.message || ''}`.trim());
  }
  if (response.status === 404) return null;
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`Open Food Facts rate limit reached.${retryAfter ? ` Please wait about ${retryAfter} seconds.` : ' Please wait about a minute.'}`);
  }
  if (!response.ok) throw new Error(`Open Food Facts request failed with status ${response.status}.`);
  const data = await response.json();
  return data?.product || null;
}

async function fetchUsdaByBarcode(barcode) {
  if (!API_CONFIG.usdaFdcApiKey) return null;
  const params = new URLSearchParams({
    api_key: API_CONFIG.usdaFdcApiKey,
    query: barcode,
    pageSize: '50',
    dataType: 'Branded',
    sortBy: 'fdcId',
    sortOrder: 'desc',
  });
  let payload;
  try {
    payload = await requestJson(`${API_CONFIG.usdaFdcBaseUrl}/foods/search?${params.toString()}`);
  } catch (_) {
    return null;
  }
  const foods = Array.isArray(payload?.foods) ? payload.foods : [];
  const accepted = new Set(barcodeVariants(barcode));
  const exactMatches = foods.filter((food) => accepted.has(normalizeBarcode(food?.gtinUpc)));
  const exact = exactMatches.sort((a, b) => Number(b?.fdcId || 0) - Number(a?.fdcId || 0))[0];
  if (!exact?.fdcId) return exact || null;
  try {
    const details = await requestJson(`${API_CONFIG.usdaFdcBaseUrl}/food/${encodeURIComponent(exact.fdcId)}?api_key=${encodeURIComponent(API_CONFIG.usdaFdcApiKey)}`);
    return { ...exact, ...details, foodNutrients: details?.foodNutrients || exact?.foodNutrients || [] };
  } catch (_) {
    return exact;
  }
}

async function fetchUpcItemDb(barcode) {
  for (const variant of barcodeVariants(barcode)) {
    const url = `${API_CONFIG.upcItemDbBaseUrl}/lookup?upc=${encodeURIComponent(variant)}`;
    try {
      const payload = await requestJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (items[0]) return items[0];
    } catch (_) {}
  }
  return null;
}

async function searchUpcItemDb(queryText = '') {
  const query = String(queryText || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (query.length < 4) return null;
  const url = `${API_CONFIG.upcItemDbBaseUrl}/search?s=${encodeURIComponent(query)}`;
  try {
    const payload = await requestJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) return null;
    const best = items
      .map((item) => ({ item, score: wordCoverage(query, [item?.title, item?.brand, item?.category, item?.description].filter(Boolean).join(' ')) }))
      .sort((a, b) => b.score - a.score)[0];
    // A keyword search always returns *something*. Only accept it when most of
    // the words we searched for really are in the match.
    return best && best.score >= 0.6 ? best.item : null;
  } catch (_) {
    return null;
  }
}

function safePublicUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return '';
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

function extractPublicUrlsFromText(text = '') {
  const matches = String(text || '').match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/[^\s<>'"]*)?/gi) || [];
  const urls = matches.map((raw) => {
    const cleaned = String(raw || '').replace(/[),.;]+$/, '');
    const normalized = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    return safePublicUrl(normalized);
  }).filter(Boolean);
  return [...new Set(urls)].slice(0, 4);
}

function extractLabelFacts(text = '') {
  const rawLines = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const facts = [];
  const add = (label, value) => {
    const cleanLabel = String(label || '').replace(/[|:]+$/g, '').replace(/\s+/g, ' ').trim();
    const cleanValue = String(value || '').replace(/^[:|\-]+/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanLabel || !cleanValue || cleanLabel.length < 2 || cleanLabel.length > 42 || cleanValue.length > 80) return;
    if (/^(ingredients?|composition|nutrition|nutritional|information|product|warning|directions?|storage)$/i.test(cleanLabel)) return;
    const key = `${cleanLabel.toLowerCase()}|${cleanValue.toLowerCase()}`;
    if (!facts.some((item) => item.key === key)) facts.push({ key, label: cleanLabel, value: cleanValue });
  };

  rawLines.forEach((line) => {
    const markdown = line.match(/^\|?\s*([^|]{2,42})\s*\|\s*([^|]{1,80})\s*\|?$/);
    if (markdown) return add(markdown[1], markdown[2]);
    const colon = line.match(/^([A-Za-z][A-Za-z0-9 /()%+._-]{1,40})\s*[:=]\s*(.{1,80})$/);
    if (colon) return add(colon[1], colon[2]);
    const numeric = line.match(/^([A-Za-z][A-Za-z /()%+._-]{1,32})\s+(<?-?\d+(?:[.,]\d+)?\s*(?:mg\/?l|mg|g|kg|ml|cl|l|%|kcal|kj|v|a|w|kw|hz|rpm|bar|psi|kpa|mpa|ah|mah|wh|kwh|°c)?)$/i);
    if (numeric) add(numeric[1], numeric[2]);
  });
  return facts.slice(0, 30).map(({ label, value }) => ({ label, value }));
}

function decodeHtmlText(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html = '', key = '') {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match?.[1]) return decodeHtmlText(match[1]);
  }
  return '';
}

function findProductJsonLd(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findProductJsonLd(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  const type = value['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item || '').toLowerCase() === 'product')) return value;
  if (value['@graph']) return findProductJsonLd(value['@graph']);
  return null;
}

function schemaScalar(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return normalizeText(String(value));
  if (Array.isArray(value)) return value.map(schemaScalar).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const raw = value.value ?? value.name ?? value.description ?? value.text ?? '';
    const unit = value.unitText || value.unitCode || '';
    const text = schemaScalar(raw);
    return text && unit ? `${text} ${unit}` : text;
  }
  return '';
}

function productAdditionalProperties(productLd = {}) {
  const items = Array.isArray(productLd?.additionalProperty) ? productLd.additionalProperty : [];
  const result = {};
  items.forEach((item) => {
    const key = normalizeText(item?.name || item?.propertyID).toLowerCase();
    const value = schemaScalar(item?.value);
    if (key && value && !result[key]) result[key] = value;
  });
  return result;
}

async function fetchPublicProductMetadata(pageUrl, options = {}) {
  const url = safePublicUrl(pageUrl);
  if (!url) return null;
  try {
    const response = await fetchWithTimeout(url, { method: 'GET', headers: { Accept: 'text/html,application/xhtml+xml' }, timeoutMs: 6000 });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 1200000);
    const barcodes = Array.isArray(options?.barcodes) ? options.barcodes : [];
    let productLd = null;
    const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts.slice(0, 20)) {
      try {
        const parsed = JSON.parse(script[1].trim());
        productLd = findProductJsonLd(parsed);
        if (productLd) break;
      } catch (_) {}
    }
    const title = metaContent(html, 'og:title') || decodeHtmlText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const description = metaContent(html, 'og:description') || metaContent(html, 'description');
    const imageUrl = metaContent(html, 'og:image');
    const brand = typeof productLd?.brand === 'string' ? productLd.brand : productLd?.brand?.name || '';
    const manufacturer = typeof productLd?.manufacturer === 'string' ? productLd.manufacturer : productLd?.manufacturer?.name || '';
    const image = Array.isArray(productLd?.image) ? productLd.image[0] : (typeof productLd?.image === 'string' ? productLd.image : productLd?.image?.url || imageUrl);
    const extra = productAdditionalProperties(productLd || {});
    const width = schemaScalar(productLd?.width || extra.width);
    const height = schemaScalar(productLd?.height || extra.height);
    const depth = schemaScalar(productLd?.depth || extra.depth || extra.length);
    const dimensions = [width, height, depth].filter(Boolean).join(' × ');
    const countryOrigin = schemaScalar(productLd?.countryOfOrigin || productLd?.countryOfAssembly || extra['country of origin']);
    const weight = schemaScalar(productLd?.weight || extra.weight || extra['net weight']);
    const size = schemaScalar(productLd?.size || extra.size || extra.capacity);
    const material = schemaScalar(productLd?.material || extra.material);
    const color = schemaScalar(productLd?.color || extra.colour || extra.color);
    const model = schemaScalar(productLd?.model || productLd?.mpn || extra.model || extra['model number']);
    const sku = schemaScalar(productLd?.sku || extra.sku || extra['item number']);
    return {
      url,
      name: normalizeText(productLd?.name) || title,
      description: normalizeText(productLd?.description) || description,
      brand: normalizeText(brand),
      manufacturerName: normalizeText(manufacturer),
      category: normalizeText(productLd?.category),
      sku,
      model,
      gtin: normalizeText(productLd?.gtin14 || productLd?.gtin13 || productLd?.gtin12 || productLd?.gtin8 || productLd?.gtin),
      mentionsBarcode: barcodes.length > 0 && mentionedBarcode(html, barcodes),
      // The page states a barcode and it is not the one that was scanned.
      gtinConflict: (() => {
        const stated = normalizeBarcode(productLd?.gtin14 || productLd?.gtin13 || productLd?.gtin12 || productLd?.gtin8 || productLd?.gtin || '');
        return barcodes.length > 0 && stated.length >= 8 && !barcodes.some((code) => sameGtin(code, stated));
      })(),
      imageUrl: normalizeText(image),
      countries: countryOrigin,
      origins: countryOrigin,
      material,
      color,
      size,
      weight,
      dimensions,
      netContent: schemaScalar(extra['net content'] || extra.quantity || extra.volume),
      warranty: schemaScalar(productLd?.warranty || extra.warranty),
      additionalProperties: extra,
    };
  } catch (_) {
    return null;
  }
}

async function fetchSerpWebResearch(queryText = '', context = {}) {
  if (!API_CONFIG.serpApiKey) return null;
  const query = String(queryText || '').trim().replace(/\s+/g, ' ').slice(0, 220);
  if (!query) return null;
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: API_CONFIG.serpApiKey,
    gl: 'za',
    hl: 'en',
    num: '5',
    safe: 'active',
  });
  try {
    const payload = await requestJson(`${API_CONFIG.serpApiBaseUrl}?${params.toString()}`);
    const results = (Array.isArray(payload?.organic_results) ? payload.organic_results : [])
      .slice(0, 5)
      .map((item) => ({
        title: normalizeText(item?.title),
        link: safePublicUrl(item?.link),
        snippet: normalizeText(item?.snippet),
        source: normalizeText(item?.source) || normalizeText(item?.displayed_link),
      }))
      .filter((item) => item.title && item.link);
    const pages = (await Promise.all(results.slice(0, 4).map((item) => fetchPublicProductMetadata(item.link, { barcodes: context.barcodes || [] }))))
      .filter(Boolean);
    // Only results that prove they are about this product survive.
    const accepted = acceptWebEvidence(results, pages, context);
    return { query, results: accepted.results, pages: accepted.pages, rejectedCount: accepted.rejected };
  } catch (_) {
    return null;
  }
}

function bestWebMetadata(webResearch = {}) {
  const pages = Array.isArray(webResearch?.pages) ? webResearch.pages : [];
  const first = webResearch?.results?.[0] || null;
  const merged = {};
  const fields = [
    'name','description','brand','manufacturerName','category','sku','model','imageUrl','countries','origins',
    'material','color','size','weight','dimensions','netContent','warranty'
  ];
  fields.forEach((field) => {
    const page = pages.find((item) => meaningful(item?.[field]));
    merged[field] = page?.[field] || '';
  });
  merged.name = merged.name || first?.title || '';
  merged.description = merged.description || first?.snippet || '';
  merged.sourceUrl = pages.find((item) => item?.url)?.url || first?.link || '';

  const factMap = new Map();
  pages.forEach((page) => {
    Object.entries(page?.additionalProperties || {}).forEach(([label, value]) => {
      const cleanLabel = normalizeText(label);
      const cleanValue = schemaScalar(value);
      if (!cleanLabel || !cleanValue) return;
      const key = cleanLabel.toLowerCase();
      if (!factMap.has(key)) factMap.set(key, { label: cleanLabel, value: cleanValue });
    });
  });
  merged.additionalFacts = [...factMap.values()].slice(0, 30);
  return merged;
}

function normalizeExternalProduct(barcode, offRaw, usdaRaw, upcRaw, webResearch = null) {
  const fieldSources = {};
  const nutrientSources = {};
  const gtin = validateGtin(barcode);
  const raw = offRaw || {};
  const offSource = normalizeText(raw.product_type).toLowerCase() === 'food' ? 'Open Food Facts' : 'Open Facts';
  const usdaSource = 'USDA FoodData Central';
  const upcSource = 'UPCitemdb';
  const webSource = 'Web research';

  const product = {
    id: `external-${barcode}`,
    external: true,
    source: offRaw ? 'open_facts' : usdaRaw ? 'usda_fdc' : upcRaw ? 'upcitemdb' : 'external',
    sourceName: offRaw ? offSource : usdaRaw ? usdaSource : upcRaw ? upcSource : 'External source',
    barcode,
    name: normalizeText(raw.product_name),
    genericName: normalizeText(raw.generic_name),
    brand: normalizeText(raw.brands),
    category: normalizeText(raw.categories),
    productType: normalizeText(raw.product_type) || (usdaRaw ? 'food' : ''),
    description: '',
    model: '',
    color: '',
    size: '',
    dimensions: '',
    weight: '',
    sku: '',
    productClass: '',
    equipmentType: '',
    partNumber: '',
    serialNumber: '',
    batchNumber: '',
    expiry: '',
    manufactureDate: '',
    distributedBy: '',
    ratedVoltage: '',
    ratedCurrent: '',
    ratedPower: '',
    frequency: '',
    phase: '',
    speedRpm: '',
    pressureRating: '',
    capacity: '',
    ipRating: '',
    certificationMarks: '',
    warranty: '',
    material: '',
    netContent: normalizeText(raw.quantity),
    servingSize: normalizeText(raw.serving_size),
    imageUrl: normalizeText(raw.image_front_url) || normalizeText(raw.image_url),
    nutritionImageUrl: normalizeText(raw.image_nutrition_url),
    ingredientsImageUrl: normalizeText(raw.image_ingredients_url),
    ingredientsText: normalizeText(raw.ingredients_text),
    allergens: normalizeTagList(raw.allergens_tags),
    traces: normalizeTagList(raw.traces_tags),
    additives: normalizeTagList(raw.additives_tags),
    nutriments: normalizeOffNutrients(raw.nutriments),
    nutritionGrade: normalizeGrade(raw.nutriscore_grade || raw.nutrition_grades),
    ecoScore: normalizeGrade(raw.ecoscore_grade),
    countries: normalizeText(raw.countries),
    manufacturingPlaces: normalizeText(raw.manufacturing_places),
    origins: normalizeText(raw.origins),
    labels: normalizeText(raw.labels),
    novaGroup: raw.nova_group ?? null,
    packaging: normalizeText(raw.packaging) || normalizeText(raw.packaging_text),
    stores: normalizeText(raw.stores),
    purchasePlaces: normalizeText(raw.purchase_places),
    traceabilityCode: normalizeText(raw.emb_codes),
    sourceUrl: normalizeText(raw.url) || (offRaw ? `${API_CONFIG.openFoodFactsBaseUrl}/product/${barcode}` : upcRaw ? `https://www.upcitemdb.com/upc/${barcode}` : ''),
    manufacturerId: '',
    manufacturerName: '',
    serialTrackingEnabled: false,
    active: true,
    gtin,
    completeness: Number(raw.completeness || 0) || 0,
    lastExternalUpdate: raw.last_modified_t ? new Date(Number(raw.last_modified_t) * 1000).toISOString() : '',
    fieldSources,
    nutrientSources,
    sourcesUsed: [],
    usdaMatch: null,
    webResearch: null,
    lookupStatus: 'identified',
  };

  Object.keys(product).forEach((key) => {
    if (meaningful(product[key]) && !['fieldSources','nutrientSources','sourcesUsed','gtin','usdaMatch'].includes(key)) fieldSources[key] = offRaw ? offSource : '';
  });
  Object.keys(product.nutriments || {}).filter((key) => /_100g$/.test(key)).forEach((key) => { nutrientSources[key] = offSource; });

  if (offRaw) product.sourcesUsed.push({ id: 'open_food_facts', name: offSource, matched: true, url: product.sourceUrl });

  if (usdaRaw) {
    product.sourcesUsed.push({ id: 'usda_fdc', name: usdaSource, matched: true, fdcId: usdaRaw.fdcId });
    product.usdaMatch = {
      fdcId: usdaRaw.fdcId || '',
      gtinUpc: usdaRaw.gtinUpc || '',
      description: usdaRaw.description || '',
      brandOwner: usdaRaw.brandOwner || '',
      brandName: usdaRaw.brandName || '',
      ingredients: usdaRaw.ingredients || '',
      marketCountry: usdaRaw.marketCountry || '',
      dataType: usdaRaw.dataType || '',
    };
    assignIfMissing(product, 'name', usdaRaw.description, usdaSource, fieldSources);
    assignIfMissing(product, 'brand', usdaRaw.brandName || usdaRaw.brandOwner, usdaSource, fieldSources);
    assignIfMissing(product, 'manufacturerName', usdaRaw.brandOwner, usdaSource, fieldSources);
    assignIfMissing(product, 'ingredientsText', usdaRaw.ingredients, usdaSource, fieldSources);
    assignIfMissing(product, 'countries', usdaRaw.marketCountry, usdaSource, fieldSources);
    assignIfMissing(product, 'category', usdaRaw.brandedFoodCategory, usdaSource, fieldSources);
    assignIfMissing(product, 'netContent', usdaRaw.packageWeight, usdaSource, fieldSources);
    if (!meaningful(product.servingSize) && meaningful(usdaRaw.servingSize)) {
      product.servingSize = `${usdaRaw.servingSize}${usdaRaw.servingSizeUnit ? ` ${usdaRaw.servingSizeUnit}` : ''}`;
      fieldSources.servingSize = usdaSource;
    }
    product.nutriments = mergeNutrients(product.nutriments, buildUsdaNutrients(usdaRaw), usdaSource, nutrientSources);
  }

  if (upcRaw) {
    product.sourcesUsed.push({ id: 'upcitemdb', name: upcSource, matched: true });
    assignIfMissing(product, 'name', upcRaw.title, upcSource, fieldSources);
    assignIfMissing(product, 'brand', upcRaw.brand, upcSource, fieldSources);
    assignIfMissing(product, 'category', upcRaw.category, upcSource, fieldSources);
    assignIfMissing(product, 'description', upcRaw.description, upcSource, fieldSources);
    assignIfMissing(product, 'model', upcRaw.model, upcSource, fieldSources);
    assignIfMissing(product, 'color', upcRaw.color, upcSource, fieldSources);
    assignIfMissing(product, 'size', upcRaw.size, upcSource, fieldSources);
    assignIfMissing(product, 'dimensions', upcRaw.dimension, upcSource, fieldSources);
    assignIfMissing(product, 'weight', upcRaw.weight, upcSource, fieldSources);
    assignIfMissing(product, 'sku', upcRaw.ean || upcRaw.upc || '', upcSource, fieldSources);
    if (!product.imageUrl && Array.isArray(upcRaw.images) && upcRaw.images[0]) {
      product.imageUrl = upcRaw.images[0];
      fieldSources.imageUrl = upcSource;
    }
    if (!product.productType) {
      product.productType = 'product';
      fieldSources.productType = upcSource;
    }
  }

  if (webResearch?.results?.length) {
    const meta = bestWebMetadata(webResearch);
    product.webResearch = webResearch;
    product.sourcesUsed.push({ id: 'web_research', name: webSource, matched: true, url: meta.sourceUrl || '' });
    assignIfMissing(product, 'name', meta.name, webSource, fieldSources);
    assignIfMissing(product, 'description', meta.description, webSource, fieldSources);
    assignIfMissing(product, 'brand', meta.brand, webSource, fieldSources);
    assignIfMissing(product, 'manufacturerName', meta.manufacturerName, webSource, fieldSources);
    assignIfMissing(product, 'category', meta.category, webSource, fieldSources);
    assignIfMissing(product, 'sku', meta.sku, webSource, fieldSources);
    assignIfMissing(product, 'model', meta.model, webSource, fieldSources);
    assignIfMissing(product, 'imageUrl', meta.imageUrl, webSource, fieldSources);
    assignIfMissing(product, 'countries', meta.countries, webSource, fieldSources);
    assignIfMissing(product, 'origins', meta.origins, webSource, fieldSources);
    assignIfMissing(product, 'material', meta.material, webSource, fieldSources);
    assignIfMissing(product, 'color', meta.color, webSource, fieldSources);
    assignIfMissing(product, 'size', meta.size, webSource, fieldSources);
    assignIfMissing(product, 'weight', meta.weight, webSource, fieldSources);
    assignIfMissing(product, 'dimensions', meta.dimensions, webSource, fieldSources);
    assignIfMissing(product, 'netContent', meta.netContent, webSource, fieldSources);
    assignIfMissing(product, 'warranty', meta.warranty, webSource, fieldSources);
    assignIfMissing(product, 'sourceUrl', meta.sourceUrl, webSource, fieldSources);
    if (Array.isArray(meta.additionalFacts) && meta.additionalFacts.length) product.webFacts = meta.additionalFacts;
  }

  product.productClass = classifyProductKind(product);
  product.equipmentType = classifyEquipmentType(product);
  fieldSources.productClass = 'Product Trust classification';
  if (product.equipmentType) fieldSources.equipmentType = 'Product Trust classification';
  fieldSources.barcode = 'Scanned barcode';
  if (!product.name) product.name = product.genericName || 'Product';

  const structuredSources = [!!offRaw, !!usdaRaw, !!upcRaw].filter(Boolean).length;
  const webDomains = new Set((webResearch?.results || []).map((item) => {
    try { return new URL(item.link).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }).filter(Boolean));
  // Only pages that actually list the scanned barcode count as barcode evidence.
  const barcodeDomains = new Set((webResearch?.results || []).filter((item) => item.evidence === 'barcode').map((item) => {
    try { return new URL(item.link).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }).filter(Boolean));
  const hasCoreIdentity = meaningful(product.name) && meaningful(product.brand);
  const exactBarcodeEvidence = structuredSources > 0;
  product.structuredSourceCount = structuredSources;
  product.webEvidenceCount = webDomains.size;
  product.webBarcodeEvidenceCount = barcodeDomains.size;
  product.identityConfidence = gtin.valid && exactBarcodeEvidence && (structuredSources >= 2 || hasCoreIdentity)
    ? 'high'
    : gtin.valid && exactBarcodeEvidence
      ? 'medium'
      : gtin.valid && barcodeDomains.size >= 2
        ? 'medium'
        : 'low';
  product.identityEvidenceCount = [gtin.valid, !!offRaw, !!usdaRaw, !!upcRaw, hasCoreIdentity, webDomains.size > 0].filter(Boolean).length;
  product.identityEvidenceSummary = structuredSources >= 2
    ? `${structuredSources} structured product records agree with the scanned GTIN.`
    : exactBarcodeEvidence
      ? 'An exact structured barcode record was found for this GTIN.'
      : barcodeDomains.size >= 2
        ? `${barcodeDomains.size} different websites list this exact barcode for this product. This is web evidence, not proof from the manufacturer.`
        : barcodeDomains.size === 1
          ? 'One website lists this exact barcode for this product. It has not been confirmed by a second source, so treat it as unconfirmed.'
          : webDomains.size > 0
            ? 'These details match the brand and name, but the pages did not show the barcode itself. Treat them as unconfirmed.'
            : 'The available evidence is not strong enough for a confident identity decision.';

  const completenessFields = [
    product.name, product.brand, product.category, product.model, product.partNumber, product.size, product.dimensions, product.weight, product.netContent, product.countries,
    product.manufacturingPlaces, product.origins, product.packaging, product.stores,
    product.purchasePlaces, product.traceabilityCode, product.ingredientsText,
    product.nutritionGrade, product.ecoScore,
    product.nutriments?.['energy-kcal_100g'] ?? product.nutriments?.['energy-kj_100g'],
    product.nutriments?.fat_100g, product.nutriments?.['saturated-fat_100g'],
    product.nutriments?.carbohydrates_100g, product.nutriments?.sugars_100g,
    product.nutriments?.proteins_100g, product.nutriments?.salt_100g,
  ];
  product.dataCompletenessPercent = Math.round((completenessFields.filter(meaningful).length / completenessFields.length) * 100);

  return product;
}

function numberFromLabel(value = '') {
  const match = String(value || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function mergeLabelNutrition(product, nutrition, sourceName) {
  const mapping = {
    energy: ['energy-kcal_100g', 'kcal'],
    fat: ['fat_100g', 'g'],
    saturatedFat: ['saturated-fat_100g', 'g'],
    carbohydrates: ['carbohydrates_100g', 'g'],
    sugars: ['sugars_100g', 'g'],
    protein: ['proteins_100g', 'g'],
    fibre: ['fiber_100g', 'g'],
    salt: ['salt_100g', 'g'],
    sodium: ['sodium_100g', 'mg'],
  };
  Object.entries(mapping).forEach(([field, [key, defaultUnit]]) => {
    if (meaningful(product.nutriments?.[key])) return;
    const rawValue = nutrition?.[field];
    const value = numberFromLabel(rawValue);
    if (!Number.isFinite(value)) return;
    product.nutriments[key] = value;
    const unitMatch = String(rawValue || '').match(/\b(kcal|kj|mg|g)\b/i);
    product.nutriments[`${key.replace(/_100g$/, '')}_unit`] = unitMatch?.[1] || defaultUnit;
    product.nutrientSources[key] = sourceName;
  });
}

async function enrichFromReferenceLabelImages(product, shouldStop = () => false) {
  if (!API_CONFIG.ocrSpaceApiKey) return product;
  const sourceName = 'Product label image via OCR.Space';
  const urls = [];
  if (!meaningful(product.ingredientsText) && product.ingredientsImageUrl) urls.push(product.ingredientsImageUrl);
  const keyNutrients = ['energy-kcal_100g', 'fat_100g', 'carbohydrates_100g', 'sugars_100g', 'proteins_100g', 'salt_100g'];
  const missingNutrition = keyNutrients.filter((key) => !meaningful(product.nutriments?.[key])).length;
  if (missingNutrition >= 3 && product.nutritionImageUrl && product.nutritionImageUrl !== product.ingredientsImageUrl) urls.push(product.nutritionImageUrl);
  for (const url of urls.slice(0, 2)) {
    try {
      const result = await ocrSpaceRequest({ imageUrl: url });
      if (shouldStop()) break;
      const fields = parseProductLabel(result.rawText);
      assignIfMissing(product, 'ingredientsText', fields.ingredientsText, sourceName, product.fieldSources);
      assignIfMissing(product, 'origins', fields.countryOfOrigin, sourceName, product.fieldSources);
      assignIfMissing(product, 'manufacturerName', fields.manufacturerText, sourceName, product.fieldSources);
      assignIfMissing(product, 'netContent', fields.netContent, sourceName, product.fieldSources);
      assignIfMissing(product, 'model', fields.modelNumber, sourceName, product.fieldSources);
      assignIfMissing(product, 'partNumber', fields.partNumber, sourceName, product.fieldSources);
      assignIfMissing(product, 'serialNumber', fields.serialNumber, sourceName, product.fieldSources);
      assignIfMissing(product, 'batchNumber', fields.batchNumber, sourceName, product.fieldSources);
      assignIfMissing(product, 'expiry', fields.expiry, sourceName, product.fieldSources);
      assignIfMissing(product, 'manufactureDate', fields.manufactureDate, sourceName, product.fieldSources);
      assignIfMissing(product, 'distributedBy', fields.distributedBy, sourceName, product.fieldSources);
      assignIfMissing(product, 'ratedVoltage', fields.voltage, sourceName, product.fieldSources);
      assignIfMissing(product, 'ratedCurrent', fields.current, sourceName, product.fieldSources);
      assignIfMissing(product, 'ratedPower', fields.power, sourceName, product.fieldSources);
      assignIfMissing(product, 'frequency', fields.frequency, sourceName, product.fieldSources);
      assignIfMissing(product, 'phase', fields.phase, sourceName, product.fieldSources);
      assignIfMissing(product, 'speedRpm', fields.speedRpm, sourceName, product.fieldSources);
      assignIfMissing(product, 'pressureRating', fields.pressureRating, sourceName, product.fieldSources);
      assignIfMissing(product, 'capacity', fields.capacity, sourceName, product.fieldSources);
      assignIfMissing(product, 'ipRating', fields.ipRating, sourceName, product.fieldSources);
      assignIfMissing(product, 'certificationMarks', fields.certificationMarks, sourceName, product.fieldSources);
      mergeLabelNutrition(product, fields.nutrition, sourceName);
    } catch (_) {}
  }
  return product;
}

export async function lookupBarcodeExternally(barcode, options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  // quick: only the product databases (used when a registered product just needs a second opinion).
  const quick = options?.quick === true;
  // The whole lookup has a time limit. When it runs out, the customer gets whatever was found so far
  // instead of waiting on a slow server. (Before, one scan could wait close to two minutes.)
  const budgetMs = Number(options?.budgetMs) > 0 ? Number(options.budgetMs) : (quick ? 6000 : 15000);
  const startedAt = Date.now();
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!/^\d{8,14}$/.test(normalizedBarcode)) {
    return { found: false, reason: 'invalid_barcode', barcode: normalizedBarcode, source: 'external' };
  }

  const cacheKey = quick ? `${normalizedBarcode}|quick` : normalizedBarcode;
  const cached = barcodeCache.get(normalizedBarcode) || (quick ? barcodeCache.get(cacheKey) : null);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < BARCODE_CACHE_MS) return cached.value;

  const variants = barcodeVariants(normalizedBarcode);
  const state = { offRaw: null, offError: null, upcRaw: null, usdaRaw: null, webResearch: null, timedOut: false };

  // Step 1: ask every database AT THE SAME TIME (they used to be asked one after another).
  const databases = async () => {
    const openFacts = (async () => {
      for (const variant of variants) {
        try { state.offRaw = await fetchOpenFoodFacts(variant); } catch (error) { state.offError = error; }
        if (state.offRaw || isTimeoutError(state.offError)) break;
      }
      if (state.offRaw) {
        const nutritionMissing = !state.offRaw?.nutriments || Object.keys(state.offRaw.nutriments || {}).length < 4;
        const identityMissing = !normalizeText(state.offRaw.categories) || !normalizeText(state.offRaw.countries);
        if (nutritionMissing || identityMissing) {
          let legacy = null;
          for (const variant of variants) {
            legacy = await fetchOpenFoodFactsV2(variant);
            if (legacy) break;
          }
          state.offRaw = mergeOffVersions(state.offRaw, legacy);
        }
      }
    })();
    const retail = fetchUpcItemDb(normalizedBarcode).then((value) => { state.upcRaw = value; }).catch(() => {});
    const usda = (async () => {
      for (const variant of variants) {
        try {
          const raw = await fetchUsdaByBarcode(variant);
          if (raw) { state.usdaRaw = raw; break; }
        } catch (_) { /* a slow or missing source never blocks the others */ }
      }
    })();
    await Promise.allSettled([openFacts, retail, usda]);
  };

  // Step 2: search the web only when no database knows the barcode, or the database record is missing
  // its basics (a complete database record is not second-guessed). Skipped in quick mode.
  const webSearch = async () => {
    const noStructuredRecord = !state.offRaw && !state.usdaRaw && !state.upcRaw;
    const missingCoreIdentity = !normalizeText(state.offRaw?.brands) || !normalizeText(state.offRaw?.product_name) || !normalizeText(state.offRaw?.categories);
    if (!quick && API_CONFIG.serpApiKey && (noStructuredRecord || missingCoreIdentity)) {
      state.webResearch = await fetchBarcodeWebResearch(normalizedBarcode, variants);
    }
  };

  await withDeadline((async () => { await databases(); await webSearch(); })(), Math.round(budgetMs * 0.75), () => { state.timedOut = true; });
  const { offRaw, offError, upcRaw, usdaRaw, webResearch } = state; // what was found in time

  if (!offRaw && !usdaRaw && !upcRaw && !webResearch?.results?.length) {
    if (offError && !API_CONFIG.serpApiKey && !state.timedOut) throw offError;
    const value = { found: false, reason: state.timedOut ? 'timeout' : 'not_found', barcode: normalizedBarcode, source: 'external', timedOut: state.timedOut };
    if (!state.timedOut) barcodeCache.set(cacheKey, { savedAt: Date.now(), value });
    return value;
  }

  const product = normalizeExternalProduct(normalizedBarcode, offRaw, usdaRaw, upcRaw, webResearch);
  recomputeProductCompleteness(product);

  // Recall check: starts now and runs at the same time as the steps below. It has its own limit (4.5 seconds at
  // most), so a slow recall service delays the product page by a few seconds at worst, and is then reported as
  // "could not check". (Registered products do their own check: skipRecalls.)
  const recallTask = (API_CONFIG.recallLookupUrl && !state.timedOut && options?.skipRecalls !== true)
    ? checkProductRecalls(
      { barcode: normalizedBarcode, name: product.name, brand: product.brand || product.manufacturerName },
      { timeoutMs: Math.max(1500, Math.min(4500, budgetMs - (Date.now() - startedAt))) },
    )
    : Promise.resolve(null);

  // Step 3 (full lookups only): one more focused web search if the profile is still thin AND there is time left.
  const remaining = budgetMs - (Date.now() - startedAt);
  if (!quick && API_CONFIG.serpApiKey && product.dataCompletenessPercent < 85 && remaining > 4000) {
    let stopped = false;
    const richQuery = [
      `"${normalizedBarcode}"`,
      product.brand,
      product.name,
      product.model,
      product.category,
      'manufacturer specifications ingredients origin packaging',
    ].filter(Boolean).join(' ');
    await withDeadline((async () => {
      const richerWebResearch = await fetchSerpWebResearch(richQuery, {
        barcodes: variants,
        identity: { brand: product.brand, name: product.name, model: product.model },
      });
      if (!stopped) {
        mergeWebResearchIntoProduct(product, richerWebResearch);
        recomputeProductCompleteness(product);
      }
    })().catch(() => {}), remaining, () => { stopped = true; state.timedOut = true; });
    stopped = true;
  }

  const recallCheck = await recallTask;
  if (recallCheck) product.externalRecallCheck = recallCheck;

  // Step 4 (only when asked for): read the printed label photos with OCR. It is slow, so it is NOT part
  // of a normal scan. "Find More Product Details" and "Photograph the Label" do this instead.
  if (options?.withLabelOcr === true && !quick) {
    let stopped = false;
    await withDeadline(Promise.resolve(enrichFromReferenceLabelImages(product, () => stopped)).catch(() => product), 12000, () => { stopped = true; });
    stopped = true;
    recomputeProductCompleteness(product);
  }

  const value = {
    found: true,
    source: 'universal_product_lookup',
    providerName: product.sourcesUsed.map((source) => source.name).join(' + '),
    product,
    partial: state.timedOut,
  };
  // A lookup that ran out of time is not remembered, so the next try can finish the job.
  if (!state.timedOut) barcodeCache.set(cacheKey, { savedAt: Date.now(), value });
  return value;
}

export function createUnidentifiedExternalProduct(barcode = '') {
  const normalizedBarcode = normalizeBarcode(barcode);
  const product = normalizeExternalProduct(normalizedBarcode, null, null, null, null);
  product.name = 'Scanned product';
  product.lookupStatus = 'needs_label';
  product.identityConfidence = 'low';
  product.identityEvidenceSummary = 'The barcode was captured. Scan the physical label to add the product name, brand, batch, expiry, ingredients or technical details printed on the package.';
  product.fieldSources.name = 'Product Trust';
  return product;
}

export async function lookupUrlProductExternally(value = '') {
  const url = safePublicUrl(value);
  if (!url) return { found: false, reason: 'invalid_url' };
  const metadata = await fetchPublicProductMetadata(url);
  if (!metadata) return { found: false, reason: 'page_unavailable', url };
  const product = normalizeExternalProduct('', null, null, null, { query: url, results: [{ title: metadata.name || url, link: url, snippet: metadata.description || '', source: new URL(url).hostname }], pages: [metadata] });
  product.barcode = '';
  product.gtin = { valid: false, type: 'Web URL', reason: 'No GTIN was encoded in this QR code' };
  product.identifierType = 'web_url';
  product.lookupStatus = 'web_reference';
  product.identityConfidence = 'low';
  product.identityEvidenceSummary = 'The QR code resolves to a public web page. This can supply product context, but it does not by itself prove the physical item is authentic.';
  product.fieldSources.barcode = '';
  recomputeProductCompleteness(product);
  return { found: true, source: 'web_url', providerName: 'Web reference', product };
}


async function searchOpenFactsDomain(baseUrl, queryText, productType = '') {
  const query = String(queryText || '').trim();
  if (!query) return [];
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
  });
  try {
    const payload = await requestJson(`${baseUrl}/cgi/search.pl?${params.toString()}`);
    return (Array.isArray(payload?.products) ? payload.products : [])
      .filter((item) => item?.code || item?._id)
      .map((item) => ({ ...item, code: String(item.code || item._id || ''), product_type: item.product_type || productType }));
  } catch (_) {
    return [];
  }
}

export async function searchProductsExternally(queryText = '') {
  const search = String(queryText || '').trim();
  if (!search) return [];
  if (/^\d{8,14}$/.test(search.replace(/\D/g, ''))) {
    const result = await lookupBarcodeExternally(search);
    return result?.found && result?.product ? [result.product] : [];
  }

  const [food, beauty, general] = await Promise.all([
    searchOpenFactsDomain('https://world.openfoodfacts.org', search, 'food'),
    searchOpenFactsDomain('https://world.openbeautyfacts.org', search, 'beauty'),
    searchOpenFactsDomain('https://world.openproductsfacts.org', search, 'product'),
  ]);

  const seen = new Set();
  const structured = [...food, ...beauty, ...general].filter((item) => {
    const code = normalizeBarcode(item.code);
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  }).slice(0, 12);

  const products = structured.map((raw) => {
    const barcode = normalizeBarcode(raw.code);
    const product = normalizeExternalProduct(barcode, raw, null, null, null);
    product.productClass = classifyProductKind(product);
    product.equipmentType = classifyEquipmentType(product);
    recomputeProductCompleteness(product);
    return product;
  });

  if (API_CONFIG.serpApiKey) {
    const webResearch = await fetchSerpWebResearch(`${search} product South Africa`, { identity: { name: search } });
    const pages = Array.isArray(webResearch?.pages) ? webResearch.pages : [];
    pages.slice(0, 4).forEach((page, index) => {
      const pageGtin = normalizeBarcode(page.gtin || '');
      if (pageGtin && seen.has(pageGtin)) return;
      const webProduct = normalizeExternalProduct(pageGtin, null, null, null, {
        query: search,
        results: [{
          title: page.name || webResearch?.results?.[index]?.title || search,
          link: page.url || webResearch?.results?.[index]?.link || '',
          snippet: page.description || webResearch?.results?.[index]?.snippet || '',
          source: (() => { try { return new URL(page.url || '').hostname; } catch (_) { return 'Web research'; } })(),
        }],
        pages: [page],
      });
      webProduct.id = pageGtin ? `external-${pageGtin}` : `external-search-${index}-${search.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`;
      webProduct.barcode = pageGtin;
      webProduct.gtin = pageGtin ? validateGtin(pageGtin) : { valid: false, type: 'Web product reference', reason: 'No GTIN available in this search result' };
      webProduct.identifierType = pageGtin ? 'gtin' : 'web_search';
      webProduct.lookupStatus = 'web_reference';
      webProduct.productClass = classifyProductKind(webProduct);
      webProduct.equipmentType = classifyEquipmentType(webProduct);
      recomputeProductCompleteness(webProduct);
      products.push(webProduct);
      if (pageGtin) seen.add(pageGtin);
    });
  }

  const term = search.toLowerCase();
  return products
    .filter((product) => [product.name, product.brand, product.category, product.description, product.model, product.sku]
      .filter(Boolean).join(' ').toLowerCase().includes(term) || products.length <= 5)
    .slice(0, 16);
}

function recomputeProductCompleteness(product) {
  const fields = product.productClass === 'food'
    ? [
        product.name, product.brand, product.category, product.netContent, product.countries,
        product.manufacturingPlaces, product.origins, product.packaging, product.ingredientsText,
        product.nutritionGrade,
        product.nutriments?.['energy-kcal_100g'] ?? product.nutriments?.['energy-kj_100g'],
        product.nutriments?.fat_100g, product.nutriments?.['saturated-fat_100g'],
        product.nutriments?.carbohydrates_100g, product.nutriments?.sugars_100g,
        product.nutriments?.proteins_100g, product.nutriments?.salt_100g,
      ]
    : product.productClass === 'equipment'
      ? [
          product.name, product.brand, product.category, product.equipmentType, product.description,
          product.model, product.partNumber, product.ratedVoltage, product.ratedPower, product.frequency,
          product.capacity, product.certificationMarks, product.countries, product.manufacturingPlaces,
          product.origins, product.imageUrl,
        ]
      : [
          product.name, product.brand, product.category, product.description, product.model,
          product.color, product.size, product.dimensions, product.weight, product.netContent,
          product.countries, product.manufacturingPlaces, product.origins, product.packaging, product.imageUrl,
        ];
  product.dataCompletenessPercent = Math.round((fields.filter(meaningful).length / fields.length) * 100);
  return product;
}

export function mergeLabelEvidenceIntoProduct(product, labelResult) {
  const next = JSON.parse(JSON.stringify(product || {}));
  next.fieldSources = { ...(next.fieldSources || {}) };
  next.nutrientSources = { ...(next.nutrientSources || {}) };
  next.nutriments = { ...(next.nutriments || {}) };
  next.sourcesUsed = Array.isArray(next.sourcesUsed) ? [...next.sourcesUsed] : [];
  const fields = labelResult?.fields || {};
  const sourceName = 'Physical label OCR';
  const mappings = [
    ['serialNumber', fields.serialNumber], ['batchNumber', fields.batchNumber], ['expiry', fields.expiry],
    ['manufactureDate', fields.manufactureDate], ['distributedBy', fields.distributedBy],
    ['model', fields.modelNumber], ['partNumber', fields.partNumber],
    ['sku', fields.sku], ['ratedVoltage', fields.voltage], ['ratedCurrent', fields.current],
    ['ratedPower', fields.power], ['frequency', fields.frequency], ['phase', fields.phase],
    ['speedRpm', fields.speedRpm], ['pressureRating', fields.pressureRating], ['capacity', fields.capacity],
    ['ipRating', fields.ipRating], ['certificationMarks', fields.certificationMarks],
    ['countries', fields.countryOfOrigin], ['manufacturingPlaces', fields.manufacturerText],
    ['netContent', fields.netContent], ['ingredientsText', fields.ingredientsText],
  ];
  mappings.forEach(([key, value]) => assignIfMissing(next, key, value, sourceName, next.fieldSources));
  mergeLabelNutrition(next, fields.nutrition || {}, sourceName);
  next.labelEvidence = {
    rawText: labelResult?.rawText || '',
    fields,
    providerName: labelResult?.providerName || 'OCR.Space',
    capturedAt: new Date().toISOString(),
  };
  next.labelFacts = Array.isArray(fields.labelFacts) ? fields.labelFacts : (next.labelFacts || []);
  next.labelUrls = Array.isArray(fields.publicUrls) ? fields.publicUrls : (next.labelUrls || []);
  if (!next.sourcesUsed.some((item) => item.id === 'physical_label_ocr')) {
    next.sourcesUsed.push({ id: 'physical_label_ocr', name: 'Physical label OCR', matched: true });
  }
  next.productClass = classifyProductKind(next);
  next.equipmentType = classifyEquipmentType(next);
  next.fieldSources.productClass = 'Product Trust classification';
  if (next.equipmentType) next.fieldSources.equipmentType = 'Product Trust classification';
  return recomputeProductCompleteness(next);
}

function buildLabelResearchQuery(product, labelResult) {
  const raw = String(labelResult?.rawText || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Za-z0-9&.+\- ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 4 && line.length <= 90)
    .filter((line) => !/^(ingredients?|nutrition|composition|warning|storage|directions?|batch|expiry|serial|barcode)$/i.test(line));
  const identity = [product?.brand, product?.name, product?.model, product?.partNumber].filter(Boolean).join(' ');
  return [identity, ...raw.slice(0, 5)].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function mergeUpcRetailProduct(product, upcRaw, sourceName = 'UPCitemdb keyword search') {
  if (!upcRaw) return product;
  const next = product;
  const fs = next.fieldSources || (next.fieldSources = {});
  assignIfMissing(next, 'name', upcRaw.title, sourceName, fs);
  assignIfMissing(next, 'brand', upcRaw.brand, sourceName, fs);
  assignIfMissing(next, 'category', upcRaw.category, sourceName, fs);
  assignIfMissing(next, 'description', upcRaw.description, sourceName, fs);
  assignIfMissing(next, 'model', upcRaw.model, sourceName, fs);
  assignIfMissing(next, 'color', upcRaw.color, sourceName, fs);
  assignIfMissing(next, 'size', upcRaw.size, sourceName, fs);
  assignIfMissing(next, 'dimensions', upcRaw.dimension, sourceName, fs);
  assignIfMissing(next, 'weight', upcRaw.weight, sourceName, fs);
  if (!next.imageUrl && Array.isArray(upcRaw.images) && upcRaw.images[0]) {
    next.imageUrl = upcRaw.images[0];
    fs.imageUrl = sourceName;
  }
  if (!next.sourcesUsed.some((item) => item.id === 'upcitemdb_keyword')) {
    next.sourcesUsed.push({ id: 'upcitemdb_keyword', name: 'UPCitemdb keyword search', matched: true });
  }
  return next;
}

function mergeWebResearchIntoProduct(product, webResearch) {
  if (!webResearch?.results?.length) return product;
  const next = product;
  const fs = next.fieldSources || (next.fieldSources = {});
  const meta = bestWebMetadata(webResearch);
  next.webResearch = webResearch;
  assignIfMissing(next, 'name', meta.name, 'Web research', fs);
  assignIfMissing(next, 'description', meta.description, 'Web research', fs);
  assignIfMissing(next, 'brand', meta.brand, 'Web research', fs);
  assignIfMissing(next, 'manufacturerName', meta.manufacturerName, 'Web research', fs);
  assignIfMissing(next, 'category', meta.category, 'Web research', fs);
  assignIfMissing(next, 'sku', meta.sku, 'Web research', fs);
  assignIfMissing(next, 'model', meta.model, 'Web research', fs);
  assignIfMissing(next, 'imageUrl', meta.imageUrl, 'Web research', fs);
  assignIfMissing(next, 'countries', meta.countries, 'Web research', fs);
  assignIfMissing(next, 'origins', meta.origins, 'Web research', fs);
  assignIfMissing(next, 'material', meta.material, 'Web research', fs);
  assignIfMissing(next, 'color', meta.color, 'Web research', fs);
  assignIfMissing(next, 'size', meta.size, 'Web research', fs);
  assignIfMissing(next, 'weight', meta.weight, 'Web research', fs);
  assignIfMissing(next, 'dimensions', meta.dimensions, 'Web research', fs);
  assignIfMissing(next, 'netContent', meta.netContent, 'Web research', fs);
  assignIfMissing(next, 'warranty', meta.warranty, 'Web research', fs);
  assignIfMissing(next, 'sourceUrl', meta.sourceUrl, 'Web research', fs);
  if (Array.isArray(meta.additionalFacts) && meta.additionalFacts.length) {
    const existing = Array.isArray(next.webFacts) ? next.webFacts : [];
    const seen = new Set(existing.map((fact) => String(fact?.label || '').toLowerCase()));
    next.webFacts = [...existing, ...meta.additionalFacts.filter((fact) => {
      const key = String(fact?.label || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })].slice(0, 30);
  }
  if (!next.sourcesUsed.some((item) => item.id === 'web_research')) {
    next.sourcesUsed.push({ id: 'web_research', name: 'Web research', matched: true, url: meta.sourceUrl || '' });
  }
  const domains = new Set((webResearch.results || []).map((item) => {
    try { return new URL(item.link).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }).filter(Boolean));
  next.webEvidenceCount = domains.size;
  return next;
}

export async function enrichExternalProductFromLabel(product, labelResult) {
  const next = mergeLabelEvidenceIntoProduct(product, labelResult);
  const labelUrls = Array.isArray(labelResult?.fields?.publicUrls) ? labelResult.fields.publicUrls : [];
  if (labelUrls.length) {
    const pages = (await Promise.all(labelUrls.slice(0, 3).map((url) => fetchPublicProductMetadata(url)))).filter(Boolean);
    const results = pages.map((page) => ({
      title: page.name || page.url,
      link: page.url,
      snippet: page.description || '',
      source: (() => { try { return new URL(page.url).hostname; } catch (_) { return ''; } })(),
    }));
    if (results.length) mergeWebResearchIntoProduct(next, { query: 'URLs printed on physical label', results, pages });
  }
  const query = buildLabelResearchQuery(next, labelResult);
  // What the label itself says is the reference every web page must match.
  const labelContext = {
    barcodes: barcodeVariants(next.barcode || ''),
    identity: { brand: next.brand, name: next.name === 'Scanned product' ? '' : next.name, model: next.model },
  };
  if (query) {
    const upcCandidate = await searchUpcItemDb(query);
    mergeUpcRetailProduct(next, upcCandidate);
    if (API_CONFIG.serpApiKey && (!meaningful(next.brand) || !meaningful(next.category) || next.lookupStatus === 'not_found' || next.dataCompletenessPercent < 70)) {
      let webResearch = null;
      if (labelUrls.length) {
        try {
          const domain = new URL(labelUrls[0]).hostname.replace(/^www\./, '');
          webResearch = await fetchSerpWebResearch(`site:${domain} ${query}`, labelContext);
        } catch (_) {}
      }
      if (!webResearch?.results?.length && next.barcode) webResearch = await fetchSerpWebResearch(`"${next.barcode}" ${query}`, labelContext);
      if (!webResearch?.results?.length) webResearch = await fetchSerpWebResearch(query, labelContext);
      mergeWebResearchIntoProduct(next, webResearch);
    }
  }
  next.lookupStatus = meaningful(next.name) && next.name !== 'Unidentified product' ? 'identified' : next.lookupStatus;
  next.productClass = classifyProductKind(next);
  next.equipmentType = classifyEquipmentType(next);
  next.fieldSources.productClass = 'Product Trust classification';
  if (next.equipmentType) next.fieldSources.equipmentType = 'Product Trust classification';
  return recomputeProductCompleteness(next);
}


function mergeProductEvidence(baseProduct = {}, freshProduct = {}) {
  const next = JSON.parse(JSON.stringify(baseProduct || {}));
  next.fieldSources = { ...(freshProduct?.fieldSources || {}), ...(next.fieldSources || {}) };
  next.nutrientSources = { ...(freshProduct?.nutrientSources || {}), ...(next.nutrientSources || {}) };

  const preserve = new Set([
    'id', 'external', 'manufacturerId', 'manufacturerName', 'name', 'brand', 'category', 'barcode',
    'batchNumber', 'expiry', 'manufactureDate', 'serialNumber', 'distributedBy', 'packagingReferenceUrl',
    'securityFeatures', 'packagingDescription', 'serialTrackingEnabled', 'labelEvidence',
  ]);

  Object.entries(freshProduct || {}).forEach(([key, value]) => {
    if (!meaningful(value)) return;
    if (key === 'sourcesUsed' || key === 'webFacts' || key === 'webResearch' || key === 'nutriments' || key === 'fieldSources' || key === 'nutrientSources') return;
    if (!meaningful(next[key]) || !preserve.has(key)) next[key] = value;
  });

  next.nutriments = { ...(freshProduct?.nutriments || {}), ...(next.nutriments || {}) };

  const sourceMap = new Map();
  [...(freshProduct?.sourcesUsed || []), ...(next.sourcesUsed || [])].forEach((source) => {
    const key = source?.id || source?.name;
    if (key && !sourceMap.has(key)) sourceMap.set(key, source);
  });
  next.sourcesUsed = [...sourceMap.values()];

  const factMap = new Map();
  [...(next.webFacts || []), ...(freshProduct?.webFacts || [])].forEach((fact) => {
    const key = String(fact?.label || '').trim().toLowerCase();
    if (key && meaningful(fact?.value) && !factMap.has(key)) factMap.set(key, fact);
  });
  next.webFacts = [...factMap.values()].slice(0, 50);

  if (freshProduct?.webResearch?.results?.length) {
    const existing = Array.isArray(next.webResearch?.results) ? next.webResearch.results : [];
    const seen = new Set(existing.map((item) => item?.link).filter(Boolean));
    const mergedResults = [...existing];
    freshProduct.webResearch.results.forEach((item) => {
      if (item?.link && !seen.has(item.link)) { seen.add(item.link); mergedResults.push(item); }
    });
    next.webResearch = {
      ...(freshProduct.webResearch || {}),
      ...(next.webResearch || {}),
      results: mergedResults.slice(0, 15),
    };
  }

  return next;
}

function intelligenceQueries(product = {}) {
  const exact = product.barcode ? `"${product.barcode}"` : '';
  const identity = [product.brand, product.name, product.model, product.partNumber].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const kind = classifyProductKind(product);
  const queries = [];
  if (exact) queries.push(`${exact} ${identity} manufacturer product specifications`);
  if (identity) queries.push(`"${identity}" product manufacturer specifications country origin packaging`);
  if (kind === 'food' && identity) queries.push(`"${identity}" ingredients nutrition allergens additives`);
  else if ((kind === 'electronics' || kind === 'equipment') && identity) queries.push(`"${identity}" datasheet specifications certification warranty manual`);
  else if (identity) queries.push(`"${identity}" materials dimensions warranty specifications`);
  return [...new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 3);
}

function normalizeExternalRecallPayload(payload) {
  if (!payload) return null;
  const arrays = [payload?.recalls, payload?.results, payload?.items, payload?.data].find(Array.isArray);
  const matches = (Array.isArray(payload) ? payload : (arrays || [])).map((item) => (typeof item === 'string' ? { title: item } : item)).filter(Boolean);
  const explicitMatch = payload?.recalled === true || payload?.found === true || payload?.match === true || payload?.hasRecall === true;
  return {
    // A service that says it could not check anything (checked:false) must not look like "no recall found".
    checked: payload?.checked !== false,
    hasMatch: explicitMatch || matches.length > 0,
    matches: matches.slice(0, 10),
    summary: normalizeText(payload?.summary || payload?.message || payload?.status || ''),
    sourcesChecked: Array.isArray(payload?.sourcesChecked) ? payload.sourcesChecked.map(String) : [],
    sourcesFailed: Array.isArray(payload?.sourcesFailed) ? payload.sourcesFailed.map(String) : [],
  };
}

export async function deepenExternalProductIntelligence(inputProduct = {}, options = {}) {
  const startedAt = Date.now();
  const budgetMs = Number(options?.budgetMs) > 0 ? Number(options.budgetMs) : 30000;
  const progress = typeof options?.onProgress === 'function' ? options.onProgress : () => {};
  const before = Number(inputProduct?.dataCompletenessPercent || 0);
  const registeredProduct = inputProduct?.external !== true && Boolean(inputProduct?.manufacturerId || inputProduct?.manufacturerName);
  let product = JSON.parse(JSON.stringify(inputProduct || {}));
  product.fieldSources = product.fieldSources || {};
  product.sourcesUsed = Array.isArray(product.sourcesUsed) ? product.sourcesUsed : [];
  if (registeredProduct && !product.sourcesUsed.some((source) => source?.id === 'product_trust_manufacturer')) {
    product.sourcesUsed.unshift({ id: 'product_trust_manufacturer', name: 'Product Trust manufacturer record', matched: true });
    ['name','brand','manufacturerName','category','barcode','netContent','country','countries','origins','packaging','model','partNumber','ratedVoltage','ratedCurrent','ratedPower','frequency','phase','capacity','ipRating','certificationMarks','warranty'].forEach((field) => {
      if (meaningful(product[field])) product.fieldSources[field] = product.fieldSources[field] || 'Product Trust manufacturer record';
    });
  }
  const barcode = normalizeBarcode(product.barcode || '');
  const webSearchAvailable = Boolean(API_CONFIG.serpApiKey);

  // The search is time-boxed. Every request has its own limit AND the whole
  // search has a budget, so the customer always gets an answer in well under a
  // minute instead of waiting on a slow server. Once the budget is spent,
  // anything that arrives late is ignored (state.stopped) and we return what
  // has been confirmed so far.
  const state = { stopped: false, timedOut: false, failedSteps: [], queries: [] };
  const shouldStop = () => state.stopped;
  const hasExternalSources = product.sourcesUsed.some((source) => source?.id !== 'product_trust_manufacturer');

  const run = async () => {
    // Only look the barcode up again when no public record has been found yet.
    // Otherwise the scan already did this and repeating it just wastes time.
    if (barcode && !hasExternalSources) {
      progress('Checking product databases…');
      try {
        // This step gets its own smaller limit so a slow database can never
        // use up the whole budget and starve the web-research steps below.
        const refreshed = await withDeadline(
          lookupBarcodeExternally(barcode, { forceRefresh: true, budgetMs: 8000 }),
          Math.min(10000, Math.round(budgetMs / 2)),
          () => null,
        );
        if (!state.stopped && refreshed?.found && refreshed?.product) product = mergeProductEvidence(product, refreshed.product);
      } catch (_) {
        state.failedSteps.push('databases');
      }
    }
    if (state.stopped) return;

    progress('Searching public sources…');
    state.queries = intelligenceQueries(product);
    const identityQuery = [product.brand, product.name, product.model, product.partNumber].filter(Boolean).join(' ').trim();
    const tasks = [];

    if (webSearchAvailable) {
      state.queries.slice(0, 2).forEach((query) => {
        tasks.push((async () => {
          const webResearch = await fetchSerpWebResearch(query, {
            barcodes: barcodeVariants(barcode),
            identity: { brand: product.brand, name: product.name, model: product.model },
          });
          if (!state.stopped) mergeWebResearchIntoProduct(product, webResearch);
        })());
      });
    }
    if (identityQuery) {
      tasks.push((async () => {
        const found = await searchUpcItemDb(identityQuery);
        if (!state.stopped) mergeUpcRetailProduct(product, found, 'UPCitemdb deep product search');
      })());
    }
    tasks.push(enrichFromReferenceLabelImages(product, shouldStop));
    if (API_CONFIG.recallLookupUrl && barcode) {
      tasks.push((async () => {
        const check = await checkProductRecalls({ barcode, name: product.name, brand: product.brand || product.manufacturerName, batch: product.batchNumber || '' }, { timeoutMs: 6000 });
        if (!state.stopped && check) product.externalRecallCheck = check;
      })());
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((result) => { if (result.status === 'rejected') state.failedSteps.push('source'); });
  };

  await withDeadline(run(), budgetMs, () => { state.stopped = true; state.timedOut = true; });
  state.stopped = true;

  progress('Putting the details together…');
  product.productClass = classifyProductKind(product);
  product.equipmentType = classifyEquipmentType(product);
  product.fieldSources = product.fieldSources || {};
  product.fieldSources.productClass = product.fieldSources.productClass || 'Product Trust classification';
  if (product.equipmentType) product.fieldSources.equipmentType = product.fieldSources.equipmentType || 'Product Trust classification';
  recomputeProductCompleteness(product);

  const after = Number(product.dataCompletenessPercent || 0);
  product.productIntelligence = {
    searchedAt: new Date().toISOString(),
    mode: 'deep',
    completenessBefore: before,
    completenessAfter: after,
    informationGain: Math.max(0, after - before),
    queriesRun: state.queries,
    sourceCount: Array.isArray(product.sourcesUsed) ? product.sourcesUsed.length : 0,
    webReferenceCount: Array.isArray(product.webResearch?.results) ? product.webResearch.results.length : 0,
    recallChecked: Boolean(product.externalRecallCheck?.checked),
    timedOut: state.timedOut,
    webSearchAvailable,
    failedSteps: state.failedSteps.length,
    elapsedMs: Date.now() - startedAt,
  };
  return product;
}

export function compareRegisteredProductWithExternal(registered, external) {
  if (!registered || !external) return null;
  const overlap = (a, b) => {
    const left = tokenSet(a);
    const right = tokenSet(b);
    if (!left.size || !right.size) return null;
    const common = [...left].filter((token) => right.has(token)).length;
    return common / Math.max(left.size, right.size);
  };

  const barcodeMatch = String(registered.barcode || '') === String(external.barcode || '');
  const brandScore = overlap(registered.brand || registered.manufacturerName, external.brand);
  const nameScore = overlap(registered.name, external.name);
  const brandMatch = brandScore == null ? null : brandScore >= 0.5;
  const nameMatch = nameScore == null ? null : nameScore >= 0.45;
  const observed = [barcodeMatch, brandMatch, nameMatch].filter((value) => value !== null);
  const consistent = observed.length ? observed.every(Boolean) : null;

  return {
    source: external.sourcesUsed?.map((source) => source.name).join(' + ') || external.sourceName || 'External source',
    found: true,
    consistent,
    barcodeMatch,
    brandMatch,
    nameMatch,
    externalProduct: external,
    detail: consistent === true
      ? 'The manufacturer record is consistent with the independent external product identity evidence.'
      : consistent === false
        ? 'One or more external identity fields do not match the manufacturer record.'
        : 'External product evidence was found, but there was not enough comparable information for a consistency decision.',
  };
}

export async function lookupRecallsExternally({ barcode = '', batchNumber = '', name = '', brand = '' }) {
  const params = new URLSearchParams();
  if (barcode) params.set('barcode', barcode);
  if (batchNumber) params.set('batch', batchNumber);
  // Recall notices rarely print barcodes, so the product's name and brand are what finds most of them.
  if (name) params.set('name', String(name).slice(0, 80));
  if (brand) params.set('brand', String(brand).slice(0, 60));
  const base = API_CONFIG.recallLookupUrl;
  const url = base ? `${base}${base.includes('?') ? '&' : '?'}${params.toString()}` : '';
  return requestJson(url, { timeoutMs: 4500 });
}

// The one way the app checks recalls. Returns null when no recall service is set up, and an honest
// "could not check" result when the service is unreachable. It NEVER turns "could not check" into "no recall".
export async function checkProductRecalls({ barcode = '', name = '', brand = '', batch = '' } = {}, { timeoutMs = 4500 } = {}) {
  if (!API_CONFIG.recallLookupUrl) return null;
  const code = normalizeBarcode(barcode || '');
  const validCode = /^\d{8,14}$/.test(code) ? code : '';
  if (!validCode && !normalizeText(brand) && !normalizeText(name)) return null;
  const unavailable = { checked: false, hasMatch: false, matches: [], sourcesChecked: [], sourcesFailed: [], summary: 'The recall check could not be completed right now.' };
  try {
    const payload = await withDeadline(
      lookupRecallsExternally({ barcode: validCode, batchNumber: batch, name, brand }).catch(() => null),
      timeoutMs,
      () => null,
    );
    return payload ? normalizeExternalRecallPayload(payload) : unavailable;
  } catch (_) {
    return unavailable;
  }
}
function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[;,]+$/, '');
  }
  return '';
}

function extractIngredients(text = '') {
  const compact = String(text || '').replace(/\r/g, '');
  const match = compact.match(/(?:ingredients?|composition)\s*[:\-]?\s*([\s\S]{10,1400})/i);
  if (!match?.[1]) return '';
  return match[1]
    .split(/\n(?:nutrition|nutritional|allergen|warning|storage|directions?|manufactured|distributed|barcode|net\s*weight|best\s*before|expiry|exp\b)/i)[0]
    .replace(/\s*\n\s*/g, ' ')
    .trim()
    .slice(0, 1200);
}

function parseProductLabel(text = '') {
  const raw = String(text || '').replace(/\r/g, '');
  const nutrient = (labelPattern) => firstMatch(raw, [
    new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]?\\s*([0-9]+(?:[.,][0-9]+)?\\s*(?:g|mg|kcal|kj)?)`, 'im'),
  ]);
  const lineValue = (labelPattern, valuePattern = '[A-Z0-9][A-Z0-9._\\/-]{2,}') => firstMatch(raw, [
    new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:#\\-]?\\s*(${valuePattern})(?=\\s*$|\\n)`, 'im'),
  ]);
  const standalonePack = firstMatch(raw, [
    /(?:^|\n)\s*([0-9]{2,5}(?:[.,][0-9]+)?\s*(?:ml|cl|l|litres?|liters?|g|kg|oz|lb))\s*(?=$|\n)/im,
  ]);
  return {
    batchNumber: lineValue('batch(?:\\s*(?:no|number))?|lot(?:\\s*(?:no|number))?|lot\\s*#|b\\/n'),
    expiry: firstMatch(raw, [
      /(?:^|\n)\s*(?:exp(?:iry|ires|iration)?|best\s*before|bbe|use\s*by)\s*[:#\-]?\s*([0-9A-Z]{1,4}[.\/\-][0-9A-Z]{1,4}(?:[.\/\-][0-9A-Z]{2,4})?)/im,
      /(?:^|\n)\s*(?:exp(?:iry|ires|iration)?|best\s*before|bbe|use\s*by)\s*[:#\-]?\s*([0-9]{4}[.\/\-][0-9]{1,2}(?:[.\/\-][0-9]{1,2})?)/im,
    ]),
    manufactureDate: firstMatch(raw, [/(?:^|\n)\s*(?:mfg|mfd|manufactured(?:\s*on)?|production\s*date)\s*[:#\-]?\s*([0-9A-Z]{1,4}[.\/\-][0-9A-Z]{1,4}(?:[.\/\-][0-9A-Z]{2,4})?)/im]),
    serialNumber: lineValue('serial(?:\\s*(?:no|number))?|s\\/n|sn'),
    modelNumber: lineValue('model(?:\\s*(?:no|number))?|model\\s*#'),
    partNumber: lineValue('part(?:\\s*(?:no|number))?|p\\/n|pn'),
    sku: lineValue('sku|item(?:\\s*(?:no|number))?'),
    voltage: firstMatch(raw, [/(?:^|\n)\s*(?:(?:input|output|voltage)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:v|volts)(?:\s*[~\-]\s*[0-9]+(?:[.,][0-9]+)?\s*(?:v|volts))?)/im]),
    power: firstMatch(raw, [/(?:^|\n)\s*(?:(?:power|rated\s*power|input\s*power)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:w|watts|kw|kilowatts))/im]),
    current: firstMatch(raw, [/(?:^|\n)\s*(?:(?:current|rated\s*current|input)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:a|amps|amperes))/im]),
    frequency: firstMatch(raw, [/(?:^|\n)\s*(?:(?:frequency|freq)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:hz|khz))/im]),
    phase: firstMatch(raw, [/(?:^|\n)\s*(?:phase|phases?)\s*[:\-]?\s*(single(?:\s*phase)?|three(?:\s*phase)?|3\s*ph|1\s*ph)/im, /\b(1\s*ph|3\s*ph)\b/i]),
    speedRpm: firstMatch(raw, [/(?:^|\n)\s*(?:(?:speed|rotation|rated\s*speed)\s*[:\-]?\s*)?([0-9]{2,6}\s*(?:rpm|r\/min|min-1))/im]),
    pressureRating: firstMatch(raw, [/(?:^|\n)\s*(?:(?:pressure|working\s*pressure|rated\s*pressure|max\.?\s*pressure)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:bar|kpa|mpa|psi))/im]),
    capacity: firstMatch(raw, [/(?:^|\n)\s*(?:(?:capacity|volume|tank)\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ml|l|litres?|liters?|kg|g|ah|mah|wh|kwh))/im]),
    ipRating: firstMatch(raw, [/\b(IP[0-6X][0-9XK])\b/i]),
    certificationMarks: [...new Set((raw.match(/\b(?:CE|UKCA|UL|CSA|SABS|IEC|RoHS|EAC)\b/gi) || []).map((item) => item.toUpperCase()))].join(', '),
    ingredientsText: extractIngredients(raw),
    countryOfOrigin: firstMatch(raw, [
      /(?:^|\n)\s*(?:country\s*of\s*origin|origin)\s*[:\-]?\s*([A-Za-z][A-Za-z ,.'&-]{2,60})/im,
      /(?:^|\n)\s*(?:made\s+in|product\s+of)\s+([A-Za-z][A-Za-z ,.'&-]{2,60})/im,
    ]),
    manufacturerText: firstMatch(raw, [/(?:^|\n)\s*(?:manufactured|made|produced|bottled|packed)\s+by\s*[:\-]?\s*([^\n]{3,120})/im, /(?:^|\n)\s*bottled\s+at\s+source\s*[:\-]?\s*([^\n]{3,120})/im]),
    distributedBy: firstMatch(raw, [/(?:^|\n)\s*(?:distributed|imported)\s+by\s*[:\-]?\s*([^\n]{3,120})/im]),
    netContent: firstMatch(raw, [/(?:net\s*(?:content|weight|wt)|volume)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:ml|l|cl|g|kg|oz|lb))/i]) || standalonePack,
    publicUrls: extractPublicUrlsFromText(raw),
    labelFacts: extractLabelFacts(raw),
    nutrition: {
      energy: nutrient('energy'),
      fat: nutrient('(?:total\\s+)?fat'),
      saturatedFat: nutrient('satur(?:ated|ates)\\s*(?:fat)?'),
      carbohydrates: nutrient('carbohydrates?'),
      sugars: nutrient('(?:of\\s+which\\s+)?sugars?'),
      protein: nutrient('protein'),
      salt: nutrient('salt'),
      sodium: nutrient('sodium'),
      fibre: nutrient('fib(?:re|er)'),
    },
  };
}

function imageSizeBytes(base64 = '') {
  const cleaned = String(base64 || '').replace(/^data:image\/[^;]+;base64,/, '').replace(/\s/g, '');
  return Math.ceil((cleaned.length * 3) / 4);
}

async function ocrSpaceRequest({ imageBase64 = '', imageUrl = '', engine = '3', table = true }) {
  if (!API_CONFIG.ocrSpaceApiKey) {
    throw new Error('OCR.Space API key is not configured. Add EXPO_PUBLIC_OCR_SPACE_API_KEY to your .env file.');
  }
  if (!imageBase64 && !imageUrl) throw new Error('An image is required for OCR.');

  if (imageBase64 && imageSizeBytes(imageBase64) > 1024 * 1024) {
    throw new Error('This photo is larger than the OCR.Space free-plan 1 MB image limit. Retake the photo closer to the label or at a lower camera quality.');
  }

  const form = new FormData();
  if (imageBase64) {
    const dataUri = String(imageBase64).startsWith('data:image/')
      ? String(imageBase64)
      : `data:image/jpeg;base64,${String(imageBase64)}`;
    form.append('base64Image', dataUri);
  } else {
    form.append('url', String(imageUrl));
  }
  form.append('language', 'auto');
  form.append('OCREngine', String(engine));
  form.append('scale', 'true');
  form.append('isTable', table ? 'true' : 'false');
  form.append('detectOrientation', 'true');
  form.append('isOverlayRequired', 'false');

  let response;
  try {
    response = await fetchWithTimeout(API_CONFIG.ocrSpaceBaseUrl, {
      method: 'POST',
      headers: { apikey: API_CONFIG.ocrSpaceApiKey },
      body: form,
      timeoutMs: 20000,
    });
  } catch (error) {
    if (isTimeoutError(error)) throw new Error('OCR.Space took too long to read the image.');
    throw new Error(`OCR.Space could not be reached. ${error?.message || ''}`.trim());
  }

  const rawText = await response.text();
  let payload = {};
  try { payload = rawText ? JSON.parse(rawText) : {}; } catch (_) { payload = { ErrorMessage: rawText }; }
  if (!response.ok) throw new Error(`OCR.Space request failed with status ${response.status}.`);

  const apiErrors = Array.isArray(payload?.ErrorMessage)
    ? payload.ErrorMessage.filter(Boolean).join(' ')
    : String(payload?.ErrorMessage || payload?.ErrorDetails || '').trim();
  if (payload?.IsErroredOnProcessing || Number(payload?.OCRExitCode || 0) >= 3) {
    throw new Error(apiErrors || 'OCR.Space could not process this image.');
  }

  const parsedText = (payload?.ParsedResults || [])
    .map((item) => String(item?.ParsedText || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!parsedText) throw new Error(apiErrors || 'No readable text was detected. Try a closer, well-lit photo of the label.');
  return { rawText: parsedText, payload };
}

export async function extractProductLabelExternally({ imageBase64 = '', imageUrl = '' }) {
  let result = await ocrSpaceRequest({ imageBase64, imageUrl, engine: '3', table: true });
  let fields = parseProductLabel(result.rawText);
  const useful = Object.values(fields).filter((value) => value && typeof value !== 'object').length;
  if (result.rawText.length < 80 || useful < 2) {
    try {
      const fallback = await ocrSpaceRequest({ imageBase64, imageUrl, engine: '2', table: true });
      if (fallback.rawText.length > result.rawText.length) {
        result = fallback;
        fields = parseProductLabel(result.rawText);
      }
    } catch (_) {}
  }
  return {
    success: true,
    provider: 'ocr_space',
    providerName: 'OCR.Space',
    rawText: result.rawText,
    fields,
    note: 'OCR can misread printed text. Review detected values before verification.',
  };
}

function jaccard(leftSet, rightSet) {
  if (!leftSet.size || !rightSet.size) return null;
  const common = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? (common / union) * 100 : null;
}

function coverage(expected, observed) {
  const left = tokenSet(expected);
  const right = tokenSet(observed);
  if (!left.size) return null;
  return ([...left].filter((token) => right.has(token)).length / left.size) * 100;
}

function weightedAverage(parts) {
  const available = parts.filter((part) => Number.isFinite(part.value));
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return null;
  return available.reduce((sum, part) => sum + (part.value * part.weight), 0) / totalWeight;
}

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

export async function comparePackagingExternally({
  scannedImageBase64 = '',
  scannedImageUrl = '',
  referenceImageUrl = '',
  expectedSecurityFeatures = '',
  expectedProductName = '',
  expectedBrand = '',
  expectedPackagingDescription = '',
}) {
  if (!referenceImageUrl) throw new Error('The manufacturer has not supplied an official packaging reference image URL.');

  const [reference, scanned] = await Promise.all([
    ocrSpaceRequest({ imageUrl: referenceImageUrl }),
    ocrSpaceRequest({ imageBase64: scannedImageBase64, imageUrl: scannedImageUrl }),
  ]);

  const referenceTextMatch = jaccard(tokenSet(reference.rawText), tokenSet(scanned.rawText));
  const expectedIdentity = [expectedProductName, expectedBrand, expectedPackagingDescription].filter(Boolean).join(' ');
  const identityCoverage = coverage(expectedIdentity, scanned.rawText);
  const securityCoverage = coverage(expectedSecurityFeatures, scanned.rawText);
  const score = weightedAverage([
    { value: referenceTextMatch, weight: 60 },
    { value: identityCoverage, weight: 25 },
    { value: securityCoverage, weight: 15 },
  ]);

  return {
    success: true,
    provider: 'ocr_space_local_compare',
    providerName: 'OCR.Space + Product Trust local comparison',
    similarityScore: rounded(score),
    components: {
      referenceText: rounded(referenceTextMatch),
      identity: rounded(identityCoverage),
      securityText: rounded(securityCoverage),
    },
    detected: {
      referenceText: reference.rawText,
      scannedText: scanned.rawText,
    },
    warning: 'Free mode compares packaging text and declared security wording. It is supporting evidence only and does not perform full visual computer-vision matching.',
  };
}
