function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function nutrient(product, key) {
  const raw = product?.nutriments?.[key];
  return numberValue(raw);
}

function productKind(product = {}) {
  if (product.productClass) return String(product.productClass).toLowerCase();
  if (product.ingredientsText || Object.keys(product.nutriments || {}).length) return 'food';
  return 'general';
}

function completenessScore(product = {}) {
  const direct = numberValue(product.dataCompletenessPercent);
  if (direct !== null) return clamp(direct);
  const fields = [
    product.name, product.brand || product.manufacturerName, product.category, product.description,
    product.barcode, product.countries || product.country, product.netContent || product.size,
    product.imageUrl, product.model, product.material, product.warranty,
  ];
  const present = fields.filter(hasValue).length;
  return Math.round((present / fields.length) * 100);
}

function sourceCount(product = {}) {
  const explicit = numberValue(product.structuredSourceCount);
  if (explicit !== null) return explicit;
  return Array.isArray(product.sourcesUsed) ? product.sourcesUsed.length : 0;
}

function identityDimension(product = {}) {
  const status = String(product.scanStatus || product.identityStatus || '').toLowerCase();
  const gs1 = String(product.scanGs1Status || product.gs1Status || '').toLowerCase();
  const gtinValid = product?.gtin?.valid;
  const confidence = String(product.identityConfidence || '').toLowerCase();
  const sources = sourceCount(product);

  if (['invalid_gtin', 'gs1_mismatch', 'high_risk'].includes(status) || gs1 === 'mismatch') {
    return { score: 5, detail: 'A scan or GS1 identity check recorded a serious identifier mismatch.' };
  }
  if (gs1 === 'verified') return { score: 100, detail: 'Cached GS1 evidence verifies the identifier ownership.' };
  if (status === 'identity_verified') return { score: 96, detail: 'The scan history records independently verified product identity evidence.' };
  if (status === 'partner_match' || product.manufacturerId) return { score: 92, detail: 'The product matches a Product Trust manufacturer record.' };
  if (confidence === 'high') return { score: 88, detail: 'Independent sources provide high-confidence identity evidence.' };
  if (sources >= 3) return { score: 86, detail: `${sources} structured/public sources support the product identity.` };
  if (sources >= 2) return { score: 78, detail: `${sources} structured/public sources support the product identity.` };
  if (gtinValid === true) return { score: 68, detail: 'The barcode has a valid GTIN check digit, but ownership evidence is limited.' };
  if (hasValue(product.barcode)) return { score: 52, detail: 'A barcode is available, but stronger ownership/identity evidence is not stored.' };
  return { score: null, detail: 'No comparable identity evidence is available.' };
}

function safetyDimension(product = {}) {
  if (product.scanHasRecall === true || product.hasRecall === true) {
    return { score: 0, detail: 'The saved verification record indicates a matching active recall.' };
  }
  const stage = String(product.scanVerificationStage || product.verificationStage || '').toLowerCase();
  const risk = String(product.scanRisk || product.risk || '').toLowerCase();
  if (stage === 'verified' && product.scanHasRecall === false) {
    return { score: risk === 'high' ? 20 : 100, detail: risk === 'high' ? 'Verification completed but recorded a high-risk outcome.' : 'Verification completed with no matching Product Trust recall.' };
  }
  if (risk === 'high') return { score: 20, detail: 'The scan history records a high-risk verification outcome.' };
  if (risk === 'mostly_verified') return { score: 82, detail: 'Most verification checks passed in the saved scan.' };
  if (risk === 'low') return { score: 92, detail: 'The saved verification result records a low-risk outcome.' };
  return { score: null, detail: 'Recall/safety verification has not been completed for this saved comparison record.' };
}

function transparencyDimension(product = {}) {
  const kind = productKind(product);
  const common = [product.description, product.countries || product.country, product.manufacturingPlaces || product.origins, product.packaging, product.traceabilityCode];
  const category = kind === 'food'
    ? [product.ingredientsText, product.allergens, product.traces, product.nutriments]
    : kind === 'equipment' || kind === 'electronics'
      ? [product.model, product.partNumber || product.sku, product.certificationMarks, product.warranty]
      : [product.model || product.sku, product.material, product.dimensions || product.size, product.warranty];
  const fields = [...common, ...category];
  const present = fields.filter(hasValue).length;
  if (!present) return { score: null, detail: 'No transparency/specification fields are available.' };
  return {
    score: Math.round((present / fields.length) * 100),
    detail: `${present} of ${fields.length} useful transparency/specification groups are populated.`,
  };
}

function nutritionDimension(product = {}) {
  const grade = String(product.nutritionGrade || '').trim().toUpperCase();
  const gradeScores = { A: 95, B: 82, C: 67, D: 48, E: 28 };
  if (gradeScores[grade] != null) {
    return { score: gradeScores[grade], detail: `Nutri-Score ${grade} is used as the strongest available nutrition indicator.` };
  }

  const sugar = nutrient(product, 'sugars_100g');
  const salt = nutrient(product, 'salt_100g');
  const satFat = nutrient(product, 'saturated-fat_100g');
  const fiber = nutrient(product, 'fiber_100g');
  const protein = nutrient(product, 'proteins_100g');
  const values = [sugar, salt, satFat, fiber, protein].filter((v) => v !== null);
  if (values.length < 2) return { score: null, detail: 'Not enough per-100 g/ml nutrition values are available for a useful comparison.' };

  let score = 68;
  if (sugar !== null) score += sugar <= 5 ? 10 : sugar <= 10 ? 4 : sugar > 22.5 ? -16 : -5;
  if (salt !== null) score += salt <= 0.3 ? 9 : salt > 1.5 ? -12 : 0;
  if (satFat !== null) score += satFat <= 1.5 ? 6 : satFat > 5 ? -10 : 0;
  if (fiber !== null) score += fiber >= 6 ? 8 : fiber >= 3 ? 4 : 0;
  if (protein !== null) score += protein >= 10 ? 5 : protein >= 5 ? 2 : 0;
  return {
    score: clamp(Math.round(score)),
    detail: 'App heuristic from available per-100 g/ml sugars, salt, saturated fat, fibre and protein. It is not a dietary recommendation.',
  };
}

function ingredientTransparencyDimension(product = {}) {
  const ingredients = hasValue(product.ingredientsText);
  const allergens = hasValue(product.allergens) || hasValue(product.traces);
  const additives = hasValue(product.additives);
  if (!ingredients && !allergens && !additives) return { score: null, detail: 'Ingredient and allergen evidence is not available.' };
  const score = (ingredients ? 60 : 0) + (allergens ? 30 : 0) + (additives ? 10 : 0);
  return { score, detail: `Ingredients ${ingredients ? 'available' : 'missing'}; allergen/traces ${allergens ? 'available' : 'missing'}; additive data ${additives ? 'available' : 'missing'}.` };
}

function processingDimension(product = {}) {
  const group = numberValue(product.novaGroup);
  if (group === null || group < 1 || group > 4) return { score: null, detail: 'No NOVA processing group is available.' };
  const scores = { 1: 95, 2: 80, 3: 58, 4: 32 };
  return { score: scores[group], detail: `NOVA group ${group} is available as a processing indicator.` };
}

const TECH_FIELDS = ['model', 'partNumber', 'sku', 'ratedVoltage', 'ratedCurrent', 'ratedPower', 'frequency', 'phase', 'speedRpm', 'pressureRating', 'capacity', 'ipRating'];

function technicalSpecDimension(product = {}) {
  const present = TECH_FIELDS.filter((key) => hasValue(product[key])).length;
  if (!present) return { score: null, detail: 'No comparable technical ratings/specifications are available.' };
  return { score: Math.round((present / TECH_FIELDS.length) * 100), detail: `${present} of ${TECH_FIELDS.length} technical specification fields are available.` };
}

function certificationDimension(product = {}) {
  const cert = hasValue(product.certificationMarks);
  const ip = hasValue(product.ipRating);
  if (!cert && !ip) return { score: null, detail: 'No certification/protection evidence is stored.' };
  return { score: cert && ip ? 100 : cert ? 82 : 68, detail: cert && ip ? 'Certification marks and an IP protection rating are both available.' : cert ? 'Certification marks are available.' : 'An IP protection rating is available.' };
}

function supportDimension(product = {}) {
  const warranty = hasValue(product.warranty);
  const material = hasValue(product.material);
  const security = hasValue(product.securityFeatures);
  if (!warranty && !material && !security) return { score: null, detail: 'No warranty/material/security evidence is available.' };
  const score = (warranty ? 55 : 0) + (material ? 25 : 0) + (security ? 20 : 0);
  return { score, detail: `${warranty ? 'Warranty' : 'No warranty'}${material ? ', material' : ''}${security ? ', security features' : ''} evidence is stored.` };
}

function detailDimension(product = {}) {
  const fields = ['model', 'sku', 'partNumber', 'description', 'material', 'dimensions', 'size', 'weight', 'netContent', 'warranty', 'certificationMarks'];
  const present = fields.filter((key) => hasValue(product[key])).length;
  if (!present) return { score: null, detail: 'No detailed quality/specification evidence is available.' };
  return { score: Math.round((present / fields.length) * 100), detail: `${present} of ${fields.length} detailed specification fields are available.` };
}

function dataEvidenceDimension(product = {}) {
  const completeness = completenessScore(product);
  const sources = sourceCount(product);
  const sourceBonus = Math.min(15, sources * 5);
  const score = clamp(Math.round(completeness * 0.85 + sourceBonus));
  return { score, detail: `${completeness}% data coverage${sources ? ` across ${sources} structured/public source${sources === 1 ? '' : 's'}` : ''}.` };
}

function dimension(key, label, weight, result) {
  return { key, label, weight, score: result?.score == null ? null : clamp(Math.round(result.score)), detail: result?.detail || '' };
}

export function buildQualityProfile(product = {}) {
  const kind = productKind(product);
  const dimensions = [
    dimension('identity', 'Identity & traceability', 20, identityDimension(product)),
    dimension('safety', 'Safety & recall evidence', 20, safetyDimension(product)),
    dimension('evidence', 'Data evidence quality', 15, dataEvidenceDimension(product)),
    dimension('transparency', 'Product transparency', 10, transparencyDimension(product)),
  ];

  if (kind === 'food') {
    dimensions.push(dimension('nutrition', 'Nutrition profile', 20, nutritionDimension(product)));
    dimensions.push(dimension('ingredients', 'Ingredient transparency', 10, ingredientTransparencyDimension(product)));
    dimensions.push(dimension('processing', 'Processing profile', 5, processingDimension(product)));
  } else if (kind === 'equipment' || kind === 'electronics') {
    dimensions.push(dimension('technical', 'Technical specification quality', 20, technicalSpecDimension(product)));
    dimensions.push(dimension('certification', 'Certification & protection', 10, certificationDimension(product)));
    dimensions.push(dimension('support', 'Warranty / durability evidence', 5, supportDimension(product)));
  } else {
    dimensions.push(dimension('details', 'Specification detail', 25, detailDimension(product)));
    dimensions.push(dimension('support', 'Warranty / material evidence', 10, supportDimension(product)));
  }

  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const assessed = dimensions.filter((item) => item.score !== null);
  const assessedWeight = assessed.reduce((sum, item) => sum + item.weight, 0);
  const weighted = assessed.reduce((sum, item) => sum + item.score * item.weight, 0);
  const score = assessedWeight ? Math.round(weighted / assessedWeight) : null;
  const confidence = totalWeight ? Math.round((assessedWeight / totalWeight) * 100) : 0;

  return {
    kind,
    score,
    confidence,
    dimensions,
    completeness: completenessScore(product),
    sources: sourceCount(product),
  };
}

function betterFoodFacts(a, b) {
  const insights = [];
  const compareLower = (key, label) => {
    const av = nutrient(a, key); const bv = nutrient(b, key);
    if (av === null || bv === null || av === bv) return;
    const winner = av < bv ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} has lower ${label} per 100 g/ml (${Math.min(av, bv)} vs ${Math.max(av, bv)}).` });
  };
  const compareHigher = (key, label) => {
    const av = nutrient(a, key); const bv = nutrient(b, key);
    if (av === null || bv === null || av === bv) return;
    const winner = av > bv ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} has higher ${label} per 100 g/ml (${Math.max(av, bv)} vs ${Math.min(av, bv)}).` });
  };
  compareLower('sugars_100g', 'sugars');
  compareLower('salt_100g', 'salt');
  compareLower('saturated-fat_100g', 'saturated fat');
  compareHigher('fiber_100g', 'fibre');
  compareHigher('proteins_100g', 'protein');
  return insights.slice(0, 4);
}

function betterTechnicalFacts(a, b) {
  const insights = [];
  const aSpecs = TECH_FIELDS.filter((key) => hasValue(a[key])).length;
  const bSpecs = TECH_FIELDS.filter((key) => hasValue(b[key])).length;
  if (aSpecs !== bSpecs) {
    const winner = aSpecs > bSpecs ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} has the more complete technical specification record (${Math.max(aSpecs, bSpecs)} vs ${Math.min(aSpecs, bSpecs)} populated ratings).` });
  }
  if (hasValue(a.certificationMarks) !== hasValue(b.certificationMarks)) {
    const winner = hasValue(a.certificationMarks) ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} includes certification-mark evidence.` });
  }
  if (hasValue(a.warranty) !== hasValue(b.warranty)) {
    const winner = hasValue(a.warranty) ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} includes warranty evidence.` });
  }
  if (hasValue(a.ipRating) !== hasValue(b.ipRating)) {
    const winner = hasValue(a.ipRating) ? 'a' : 'b';
    insights.push({ winner, text: `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} includes an IP protection rating.` });
  }
  return insights.slice(0, 4);
}

export function compareProductQuality(a = {}, b = {}) {
  const aProfile = buildQualityProfile(a);
  const bProfile = buildQualityProfile(b);
  const sameKind = aProfile.kind === bProfile.kind;
  const aScore = aProfile.score;
  const bScore = bProfile.score;
  const delta = aScore !== null && bScore !== null ? Math.abs(aScore - bScore) : null;

  let winner = 'none';
  let headline = 'Evidence is too limited for a quality winner';
  let explanation = 'Scan or enrich both products further to improve the comparison.';

  if (!sameKind) {
    headline = 'Compare products in the same category for a quality winner';
    explanation = 'Product Trust can still compare trust and evidence coverage, but a phone and a drink, for example, should not receive a single “better quality” verdict.';
  } else if (aScore !== null && bScore !== null && aProfile.confidence >= 40 && bProfile.confidence >= 40) {
    if (delta >= 7) {
      winner = aScore > bScore ? 'a' : 'b';
      headline = `${winner === 'a' ? a.name || 'Product A' : b.name || 'Product B'} has the stronger evidence-based quality profile`;
      explanation = `The score is ${Math.max(aScore, bScore)} vs ${Math.min(aScore, bScore)}, with evidence confidence of ${winner === 'a' ? aProfile.confidence : bProfile.confidence}%.`;
    } else {
      headline = 'Quality profiles are very close';
      explanation = `The evidence-based scores differ by only ${delta} point${delta === 1 ? '' : 's'}. Review the dimension-by-dimension comparison before choosing.`;
    }
  }

  const insights = sameKind && aProfile.kind === 'food'
    ? betterFoodFacts(a, b)
    : sameKind && ['equipment', 'electronics'].includes(aProfile.kind)
      ? betterTechnicalFacts(a, b)
      : [];

  const commonInsights = [];
  if (aProfile.completeness !== bProfile.completeness) {
    const iw = aProfile.completeness > bProfile.completeness ? 'a' : 'b';
    commonInsights.push({ winner: iw, text: `${iw === 'a' ? a.name || 'Product A' : b.name || 'Product B'} has more complete product data (${Math.max(aProfile.completeness, bProfile.completeness)}% vs ${Math.min(aProfile.completeness, bProfile.completeness)}%).` });
  }
  if (aProfile.sources !== bProfile.sources && (aProfile.sources || bProfile.sources)) {
    const iw = aProfile.sources > bProfile.sources ? 'a' : 'b';
    commonInsights.push({ winner: iw, text: `${iw === 'a' ? a.name || 'Product A' : b.name || 'Product B'} is supported by more structured/public sources (${Math.max(aProfile.sources, bProfile.sources)} vs ${Math.min(aProfile.sources, bProfile.sources)}).` });
  }

  return {
    sameKind,
    kind: sameKind ? aProfile.kind : 'mixed',
    a: aProfile,
    b: bProfile,
    winner,
    headline,
    explanation,
    insights: [...insights, ...commonInsights].slice(0, 5),
  };
}
