import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, LoadingBlock, EmptyState, CompareRow, RestorableScrollView } from '../../components/common';
import { getRecentScanProducts } from '../../services/productService';
import { compareProductQuality } from '../../services/qualityComparisonService';

import { PortalNav } from '../../components/navigation';
function value(product, keys, fallback = '—') {
  for (const key of keys) {
    const parts = key.split('.');
    let current = product;
    for (const part of parts) current = current?.[part];
    if (current !== undefined && current !== null && String(current).trim() !== '') return String(current);
  }
  return fallback;
}

function nutrient(product, key) {
  const n = product?.nutriments || {};
  const v = n[key];
  if (v === undefined || v === null || v === '') return '—';
  const base = key.replace(/_100g$/, '');
  return `${v}${n[`${base}_unit`] ? ` ${n[`${base}_unit`]}` : ''}`;
}

function kind(product = {}) {
  if (product.productClass) return String(product.productClass).toLowerCase();
  if (product.ingredientsText || Object.keys(product.nutriments || {}).length) return 'food';
  return 'general';
}

function scoreColor(score) {
  if (score == null) return C.textFaint;
  if (score >= 80) return C.success;
  if (score >= 65) return C.cyan;
  if (score >= 45) return C.cyan;
  return C.danger;
}

function ScorePanel({ label, product, profile }) {
  const color = scoreColor(profile.score);
  return (
    <View style={styles.qualityScorePanel}>
      <Text style={styles.qualityProductLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.qualityProductName}>{product?.name || 'Scanned product'}</Text>
      <Text style={[styles.qualityScoreNumber, { color }]}>{profile.score == null ? '—' : `${profile.score}`}</Text>
      <Text style={styles.qualityScoreSuffix}>{profile.score == null ? 'More evidence needed' : '/ 100 quality & trust'}</Text>
      <View style={styles.qualityBarTrack}>
        <View style={[styles.qualityBarFill, { width: `${profile.score || 0}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.qualityConfidence}>Evidence confidence {profile.confidence}%</Text>
    </View>
  );
}

function QualityDimensionRow({ dimensionA, dimensionB }) {
  const label = dimensionA?.label || dimensionB?.label || 'Quality dimension';
  const aScore = dimensionA?.score;
  const bScore = dimensionB?.score;
  return (
    <View style={styles.qualityDimensionCard}>
      <Text style={styles.qualityDimensionTitle}>{label}</Text>
      <View style={styles.qualityDimensionScores}>
        <View style={styles.qualityDimensionSide}>
          <Text style={[styles.qualityDimensionScore, { color: scoreColor(aScore) }]}>{aScore == null ? '—' : aScore}</Text>
          <Text style={styles.qualityDimensionDetail}>{dimensionA?.detail || 'No comparable evidence.'}</Text>
        </View>
        <View style={styles.qualityDimensionDivider} />
        <View style={styles.qualityDimensionSide}>
          <Text style={[styles.qualityDimensionScore, { color: scoreColor(bScore) }]}>{bScore == null ? '—' : bScore}</Text>
          <Text style={styles.qualityDimensionDetail}>{dimensionB?.detail || 'No comparable evidence.'}</Text>
        </View>
      </View>
    </View>
  );
}

function ComparisonInsight({ item }) {
  const icon = item.winner === 'a' ? 'arrow-back-circle-outline' : item.winner === 'b' ? 'arrow-forward-circle-outline' : 'information-circle-outline';
  return (
    <View style={styles.qualityInsightRow}>
      <Icon name={icon} size={18} color={C.primary} />
      <Text style={styles.qualityInsightText}>{item.text}</Text>
    </View>
  );
}

export default function CompareScreen({ uid, go, initialProduct }) {
  const [products, setProducts] = useState([]);
  const [aIndex, setAIndex] = useState(0);
  const [bIndex, setBIndex] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentScanProducts(uid).then((items) => {
      const rows = [...items];
      if (initialProduct) {
        const found = rows.findIndex((p) => (p.barcode && p.barcode === initialProduct.barcode) || p.id === initialProduct.id);
        if (found < 0) rows.unshift(initialProduct);
      }
      setProducts(rows);
      if (initialProduct) {
        const idx = rows.findIndex((p) => (p.barcode && p.barcode === initialProduct.barcode) || p.id === initialProduct.id);
        if (idx >= 0) setAIndex(idx);
        if (rows.length > 1 && idx === 1) setBIndex(0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid, initialProduct?.id, initialProduct?.barcode]);

  const a = products[aIndex];
  const b = products[bIndex];
  const sameKind = a && b && kind(a) === kind(b);
  const sharedKind = sameKind ? kind(a) : 'mixed';
  const quality = useMemo(() => (a && b ? compareProductQuality(a, b) : null), [a, b]);

  const rows = useMemo(() => {
    if (!a || !b) return [];
    const common = [
      ['Brand', value(a, ['brand', 'manufacturerName']), value(b, ['brand', 'manufacturerName'])],
      ['Category', value(a, ['category']), value(b, ['category'])],
      ['Product type', value(a, ['productClass', 'productType']), value(b, ['productClass', 'productType'])],
      ['Identity confidence', value(a, ['identityConfidence'], a.manufacturerId ? 'Manufacturer registered' : '—'), value(b, ['identityConfidence'], b.manufacturerId ? 'Manufacturer registered' : '—')],
      ['Data coverage', a.dataCompletenessPercent != null ? `${a.dataCompletenessPercent}%` : '—', b.dataCompletenessPercent != null ? `${b.dataCompletenessPercent}%` : '—'],
      ['Independent sources', String(a.structuredSourceCount ?? a.sourcesUsed?.length ?? '—'), String(b.structuredSourceCount ?? b.sourcesUsed?.length ?? '—')],
      ['Country / market', value(a, ['countries', 'country']), value(b, ['countries', 'country'])],
      ['Net content / size', value(a, ['netContent', 'size', 'capacity']), value(b, ['netContent', 'size', 'capacity'])],
    ];

    let categoryRows = [];
    if (sharedKind === 'food') {
      categoryRows = [
        ['Nutri-Score', value(a, ['nutritionGrade']), value(b, ['nutritionGrade'])],
        ['NOVA processing group', value(a, ['novaGroup']), value(b, ['novaGroup'])],
        ['Eco-Score', value(a, ['ecoScore']), value(b, ['ecoScore'])],
        ['Energy / 100 g or ml', nutrient(a, 'energy-kcal_100g'), nutrient(b, 'energy-kcal_100g')],
        ['Sugars / 100 g or ml', nutrient(a, 'sugars_100g'), nutrient(b, 'sugars_100g')],
        ['Saturated fat / 100 g or ml', nutrient(a, 'saturated-fat_100g'), nutrient(b, 'saturated-fat_100g')],
        ['Salt / 100 g or ml', nutrient(a, 'salt_100g'), nutrient(b, 'salt_100g')],
        ['Protein / 100 g or ml', nutrient(a, 'proteins_100g'), nutrient(b, 'proteins_100g')],
        ['Fibre / 100 g or ml', nutrient(a, 'fiber_100g'), nutrient(b, 'fiber_100g')],
        ['Ingredients', a.ingredientsText ? 'Available' : '—', b.ingredientsText ? 'Available' : '—'],
        ['Allergen / traces data', (a.allergens?.length || a.traces?.length) ? 'Available' : '—', (b.allergens?.length || b.traces?.length) ? 'Available' : '—'],
      ];
    } else if (sharedKind === 'equipment' || sharedKind === 'electronics') {
      categoryRows = [
        ['Model', value(a, ['model']), value(b, ['model'])],
        ['Part number', value(a, ['partNumber', 'sku']), value(b, ['partNumber', 'sku'])],
        ['Rated voltage', value(a, ['ratedVoltage']), value(b, ['ratedVoltage'])],
        ['Rated current', value(a, ['ratedCurrent']), value(b, ['ratedCurrent'])],
        ['Rated power', value(a, ['ratedPower']), value(b, ['ratedPower'])],
        ['Frequency', value(a, ['frequency']), value(b, ['frequency'])],
        ['Protection rating', value(a, ['ipRating']), value(b, ['ipRating'])],
        ['Certification marks', value(a, ['certificationMarks']), value(b, ['certificationMarks'])],
        ['Warranty', value(a, ['warranty']), value(b, ['warranty'])],
        ['Material', value(a, ['material']), value(b, ['material'])],
      ];
    } else if (sharedKind === 'stationery') {
      categoryRows = [
        ['Model / SKU', value(a, ['model', 'sku', 'partNumber']), value(b, ['model', 'sku', 'partNumber'])],
        ['Dimensions', value(a, ['dimensions', 'size']), value(b, ['dimensions', 'size'])],
        ['Material', value(a, ['material']), value(b, ['material'])],
        ['Warranty', value(a, ['warranty']), value(b, ['warranty'])],
        ['Description', value(a, ['description']), value(b, ['description'])],
      ];
    } else {
      categoryRows = [
        ['Model / SKU', value(a, ['model', 'sku', 'partNumber']), value(b, ['model', 'sku', 'partNumber'])],
        ['Material', value(a, ['material']), value(b, ['material'])],
        ['Dimensions / size', value(a, ['dimensions', 'size']), value(b, ['dimensions', 'size'])],
        ['Weight', value(a, ['weight']), value(b, ['weight'])],
        ['Warranty', value(a, ['warranty']), value(b, ['warranty'])],
      ];
    }

    return [...common, ...categoryRows].filter(([, left, right]) => left !== '—' || right !== '—');
  }, [a, b, sharedKind]);

  if (loading) return <Screen><TopBar title="Quality Compare" onBack={() => go('back')} /><LoadingBlock text="Loading your scanned products…" /><PortalNav role="customer" screen="compare" go={go} /></Screen>;
  if (products.length < 2) return <Screen><TopBar title="Quality Compare" onBack={() => go('back')} /><EmptyState title="Scan two products first" text="Quality comparison uses products from your Scan History and Saved Products. Scan at least two products and return here." action="Scan Product" onAction={() => go('scan')} /><PortalNav role="customer" screen="compare" go={go} /></Screen>;

  const cycle = (index, setter, direction, otherIndex) => {
    let next = (index + direction + products.length) % products.length;
    if (products.length > 1 && next === otherIndex) next = (next + direction + products.length) % products.length;
    setter(next);
  };
  const qualityDimsA = Object.fromEntries((quality?.a?.dimensions || []).map((d) => [d.key, d]));
  const qualityDimsB = Object.fromEntries((quality?.b?.dimensions || []).map((d) => [d.key, d]));
  const dimensionKeys = [...new Set([...(quality?.a?.dimensions || []).map((d) => d.key), ...(quality?.b?.dimensions || []).map((d) => d.key)])];
  const winnerColor = quality?.winner === 'none' ? C.cyan : C.primary;

  return (
    <Screen>
      <TopBar title="Quality Compare" onBack={() => go('back')} />
      <RestorableScrollView screenKey="compare" contentContainerStyle={styles.pagePad}>
        <Text style={styles.compareIntro}>Select two scanned or saved products to compare their documented quality, trust and safety evidence.</Text>

        <View style={styles.comparePickers}>
          {[['Product A', a, aIndex, setAIndex], ['Product B', b, bIndex, setBIndex]].map(([label, p, idx, setter]) => (
            <View key={label} style={styles.pickerCard}>
              <Text style={styles.comparePickerLabel}>{label}</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={() => cycle(idx, setter, -1, label === 'Product A' ? bIndex : aIndex)} style={styles.smallIconButton}><Icon name="chevron-back" size={18} /></TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text numberOfLines={2} style={[styles.rowTitle, { textAlign: 'center' }]}>{p.name || 'Scanned product'}</Text>
                  <Text numberOfLines={2} style={[styles.rowSub, { textAlign: 'center' }]}>{p.brand || p.category || p.barcode || 'Product evidence'}</Text>
                </View>
                <TouchableOpacity onPress={() => cycle(idx, setter, 1, label === 'Product A' ? bIndex : aIndex)} style={styles.smallIconButton}><Icon name="chevron-forward" size={18} /></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {quality ? (
          <>
            <View style={styles.qualitySummaryCard}>
              <View style={styles.qualityWinnerHeader}>
                <Icon name={quality.winner === 'none' ? 'analytics-outline' : 'trophy-outline'} size={24} color={winnerColor} />
                <Text style={[styles.qualityWinnerTitle, { color: winnerColor }]}>{quality.headline}</Text>
                <Text style={styles.qualityWinnerText}>{quality.explanation}</Text>
              </View>
              <View style={styles.qualityScoresRow}>
                <ScorePanel label="Product A" product={a} profile={quality.a} />
                <ScorePanel label="Product B" product={b} profile={quality.b} />
              </View>
            </View>

            {!quality.sameKind ? (
              <View style={styles.compareContextCard}>
                <Icon name="information-circle-outline" color={C.cyan} />
                <Text style={styles.compareContextText}>These products are from different categories, so Product Trust compares evidence and trust without declaring an overall quality winner.</Text>
              </View>
            ) : null}

            <View style={styles.sectionHeading}><Text style={styles.h3}>Quality dimensions</Text></View>
            {dimensionKeys.map((key) => <QualityDimensionRow key={key} dimensionA={qualityDimsA[key]} dimensionB={qualityDimsB[key]} />)}

            {quality.insights.length ? (
              <View style={styles.cardPad}>
                <Text style={[styles.h3, { marginBottom: 12 }]}>What stands out</Text>
                {quality.insights.map((item, index) => <ComparisonInsight key={`${item.winner}-${index}`} item={item} />)}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.sectionHeading}><Text style={styles.h3}>Side-by-side product facts</Text></View>
        {rows.map(([label, left, right]) => <CompareRow key={label} label={label} a={left} b={right} />)}

        <Text style={styles.compareFootnote}>Quality & Trust is an evidence score, not a laboratory test. Missing evidence lowers confidence rather than being invented.</Text>
      </RestorableScrollView>
      <PortalNav role="customer" screen="compare" go={go} />
    </Screen>
  );
}
