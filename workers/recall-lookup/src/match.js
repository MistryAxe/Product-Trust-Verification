// Matching rules: kept in one small file so they are easy to read and test.
// The rule of thumb is "better to say nothing than to accuse the wrong product".

const STOP = new Set(('the and with for from your our this that are was were has have not but you all any can her his its out use new one two ' +
  'product products range pack packs size sizes original classic fresh natural premium plus extra free low fat full large small medium mini big best ' +
  'great taste flavour flavor each item items brand recall recalled notice').split(' '));
const UNIT = /^\d+(ml|l|g|kg|mg|oz|lb|pcs|pc|cl|gm|cm|mm|m)?$/;

export function tokens(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && /[a-z]/.test(t) && !STOP.has(t) && !UNIT.test(t));
}

// "0077890241516", "077890241516" and "77890241516" are the same product: compare without leading zeros.
export function coreOf(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '');
}
export function barcodeCores(code) {
  const core = coreOf(code);
  return core.length >= 7 && core.length <= 14 ? [core] : [];
}

// Finds barcodes written inside free text in any common style: 077890241516, 0-31604-02793-3, #10074865110140.
export function textHasBarcode(text, cores) {
  if (!cores || !cores.length) return false;
  const runs = String(text || '').match(/\d[\d\- ]{5,22}\d/g) || [];
  for (const run of runs) {
    const digits = run.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 14 && cores.includes(coreOf(digits))) return true;
  }
  return false;
}

// Same brand AND at least one product word. (Without a brand, three product words are needed.)
export function nameMatch({ brand, name }, text) {
  const hay = new Set(tokens(text));
  const brandTokens = tokens(brand);
  const nameTokens = tokens(name).filter((t) => !brandTokens.includes(t));
  const needBrand = brandTokens.length <= 2 ? brandTokens.length : 2;
  const brandHits = brandTokens.filter((t) => hay.has(t));
  const nameHits = nameTokens.filter((t) => hay.has(t));
  if (brandTokens.length && brandHits.length >= needBrand && nameHits.length >= 1) return { ok: true, matched: [...brandHits, ...nameHits] };
  if (!brandTokens.length && nameHits.length >= 3) return { ok: true, matched: nameHits };
  return { ok: false, matched: [] };
}

export function batchMentioned(text, batch) {
  const wanted = String(batch || '').trim().toLowerCase();
  if (wanted.length < 4) return false;
  return String(text || '').toLowerCase().includes(wanted);
}
