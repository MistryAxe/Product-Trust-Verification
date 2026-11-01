import React, { useEffect, useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, ProductThumb, StatusPill, InfoRow, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { RecallNotice } from '../../components/product/RecallNotice';
import { apiConfigured } from '../../config/api';
import { enrichExternalProductFromLabel, extractProductLabelExternally } from '../../services/externalApiService';
import { isProductSaved, removeSavedProduct, saveProduct } from '../../services/productService';
import { gs1StatusLabel } from '../../services/gs1Service';
import { analyseIngredientText, analyseProductAllergens } from '../../services/ingredientService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { rememberScreenState, startingScreenState } from '../../utils/screenMemory';

const tabs = [
  ['overview', 'Overview'],
  ['details', 'Details'],
  ['safety', 'Safety'],
  ['sources', 'Sources'],
];

function friendlySource(source = '') {
  const value = String(source || '');
  if (!value) return '';
  if (/open food facts/i.test(value)) return 'Open Food Facts';
  if (/usda/i.test(value)) return 'USDA food data';
  if (/upc/i.test(value)) return 'Product database';
  if (/serp|web research|google/i.test(value)) return 'Web research';
  if (/label|ocr/i.test(value)) return 'Physical label';
  if (/product trust/i.test(value)) return 'Product Trust';
  if (/gs1/i.test(value)) return 'Barcode owner record';
  return value;
}

export default function ExternalProductScreen({ uid, product: initialProduct, profile, gs1Verification, go, setReportProduct, onProductEnriched, onOpenIntelligence, arrivedByBack = false }) {
  const [product, setProduct] = useState(initialProduct);
  const [labelOcr, setLabelOcr] = useState(initialProduct?.labelEvidence || null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const tabKey = initialProduct?.barcode || initialProduct?.name || 'result';
  const [tab, setTabState] = useState(() => startingScreenState('externalProduct', tabKey, arrivedByBack, 'overview'));
  const setTab = (next) => { rememberScreenState('externalProduct', tabKey, next); setTabState(next); };

  useEffect(() => {
    if (!uid) return;
    isProductSaved(uid, initialProduct).then(setSaved).catch(() => {});
  }, [uid, initialProduct?.id, initialProduct?.barcode]);

  const toggleSaved = async () => {
    if (!uid) return;
    try {
      if (saved) await removeSavedProduct(uid, product);
      else await saveProduct(uid, product);
      setSaved(!saved);
    } catch (error) {
      Alert.alert('Unable to update saved products', friendlyFirebaseError(error));
    }
  };

  const nutrients = product.nutriments || {};
  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
  const sourceFor = (field, nutrient = false) => nutrient ? (product.nutrientSources?.[field] || '') : (product.fieldSources?.[field] || '');
  const nutrientValue = (key, unitKey = '') => {
    const value = nutrients[key];
    if (value === undefined || value === null || value === '') return '';
    const base = key.replace(/_100g$/, '').replace(/_serving$/, '');
    const unit = (unitKey && nutrients[unitKey]) || nutrients[`${base}_unit`] || '';
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const isFoodLike = product.productClass === 'food' || product.productType === 'food' || !!product.usdaMatch || !!product.ingredientsText || Object.keys(nutrients).length > 0;
  const hasNutritionData = ['energy-kcal_100g', 'fat_100g', 'saturated-fat_100g', 'carbohydrates_100g', 'sugars_100g', 'proteins_100g', 'fiber_100g', 'salt_100g'].some((key) => hasValue(nutrients[key]));
  const isElectronics = product.productClass === 'electronics';
  const isStationery = product.productClass === 'stationery';
  const isEquipment = product.productClass === 'equipment';
  const isTechnical = isElectronics || isEquipment;
  const hasTechnicalDetails = [product.equipmentType, product.partNumber, product.ratedVoltage, product.ratedCurrent, product.ratedPower, product.frequency, product.phase, product.speedRpm, product.pressureRating, product.capacity, product.ipRating, product.certificationMarks, product.warranty].some(hasValue);
  const hasPhysicalDetails = [product.batchNumber, product.expiry, product.manufactureDate, product.serialNumber, product.distributedBy].some(hasValue);
  const hasOriginDetails = [product.countries, product.manufacturingPlaces, product.origins, product.packaging, product.labels, product.stores, product.purchasePlaces, product.traceabilityCode, product.material].some(hasValue);

  const safety = analyseProductAllergens(product, profile?.allergens || [], profile?.customAllergens || []);
  const ocrAllergens = labelOcr?.fields?.ingredientsText ? analyseIngredientText(labelOcr.fields.ingredientsText, profile?.allergens || [], profile?.customAllergens || []) : [];
  const detectedAllergens = [...new Set([...(safety.detected || []), ...ocrAllergens])];
  const hasSafetyProfile = profile?.allergyProfileComplete === true || profile?.noKnownAllergies === true || safety.hasProfile;
  const gtinValid = product.gtin?.valid === true;
  const structuredSourceCount = Number(product.structuredSourceCount || 0);
  const webEvidenceCount = Number(product.webEvidenceCount || 0);
  const gs1Status = gs1Verification?.status || '';
  const highIdentityConfidence = product.identityConfidence === 'high';

  const trust = ['not_found', 'needs_label'].includes(product.lookupStatus)
    ? { title: 'We could not identify this product', text: 'No reliable record matches this barcode, so Product Trust is not guessing. Photograph the printed label (brand and product name) and we will search for it, or search by name yourself.', color: C.cyan, bg: C.cyanBg, icon: 'help-circle-outline' }
    : product.identifierType === 'web_url'
      ? { title: 'Product page found', text: 'This QR code links to a public product page. We found useful information, but the physical item may still need a label or packaging check.', color: C.cyan, bg: C.cyanBg, icon: 'globe-outline' }
      : !gtinValid
        ? { title: 'Barcode needs review', text: 'The scanned product code does not pass the normal barcode check. Check the physical label before trusting the result.', color: C.danger, bg: C.dangerBg, icon: 'warning-outline' }
        : gs1Status === 'mismatch'
          ? { title: 'Product details do not match', text: 'The barcode ownership information conflicts with the product details we found. Treat this item with caution.', color: C.danger, bg: C.dangerBg, icon: 'warning-outline' }
          : gs1Status === 'verified' || structuredSourceCount >= 2 || highIdentityConfidence
            ? { title: 'Product identity verified', text: 'The product identity is supported by matching information from reliable records. The physical item can still be checked using its label, batch or serial details.', color: C.success, bg: C.successBg, icon: 'shield-checkmark-outline' }
            : structuredSourceCount === 0
              ? { title: 'Listed on a website, not confirmed', text: 'A website lists this barcode for this product, but no product database confirms it. Check the label on the pack before relying on these details.', color: C.cyan, bg: C.cyanBg, icon: 'globe-outline' }
              : { title: 'Product identity found', text: 'We found a matching product record. More supporting information can improve confidence.', color: C.cyan, bg: C.cyanBg, icon: 'shield-half-outline' };

  const report = () => {
    setReportProduct({ id: '', name: product.name || 'Scanned product', barcode: product.barcode || '', manufacturerId: '', brand: product.brand || '', category: product.category || '' });
    go('report');
  };

  const scanLabel = async () => {
    if (!apiConfigured('ocrSpaceApiKey')) return Alert.alert('Automatic label reading is not ready', 'You can still use the available product information. Automatic label reading can be connected later.');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera permission required', 'Allow camera access to read the physical product label.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.68, base64: true, allowsEditing: true, aspect: [3, 4] });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return Alert.alert('Image unavailable', 'The image could not be prepared for label reading.');
    setBusy(true);
    try {
      const ocr = await extractProductLabelExternally({ imageBase64: asset.base64 });
      setLabelOcr(ocr);
      const enriched = await enrichExternalProductFromLabel(product, ocr);
      setProduct(enriched);
      if (onProductEnriched) await onProductEnriched(enriched);
      if (saved && uid) await saveProduct(uid, enriched);
    } catch (error) {
      Alert.alert('Label reading incomplete', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  const openUrl = async (url) => {
    try { await Linking.openURL(url); }
    catch (_) { Alert.alert('Unable to open link', 'The source could not be opened on this device.'); }
  };

  const SourceRow = ({ label, value, field, nutrient = false, last = false }) => {
    if (!hasValue(value)) return null;
    const source = friendlySource(sourceFor(field, nutrient));
    return (
      <View style={[styles.infoRow, !last && styles.infoBorder]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoValueWrap}>
          <Text selectable style={styles.infoValue}>{String(value)}</Text>
          {source ? <Text style={styles.dataSourceText}>Found from: {source}</Text> : null}
        </View>
      </View>
    );
  };

  const DetectedRow = ({ label, value, last = false }) => hasValue(value) ? <InfoRow label={label} value={value} last={last} /> : null;
  const searchOnline = () => {
    const query = [product.barcode, product.brand, product.name, product.model].filter(Boolean).join(' ');
    openUrl(`https://www.google.com/search?q=${encodeURIComponent(query || 'product')}`);
  };

  return (
    <Screen>
      <TopBar title="Product Check" onBack={() => go('back')} right={<TouchableOpacity onPress={toggleSaved} style={styles.iconButton}><Icon name={saved ? 'heart' : 'heart-outline'} color={saved ? C.danger : C.text} /></TouchableOpacity>} />
      <RestorableScrollView screenKey={`externalProduct:${product.barcode || product.name || 'result'}:${tab}`} contentContainerStyle={styles.pagePad}>
        <View style={styles.productHero}>
          <ProductThumb size={104} imageUrl={product.imageUrl || ''} />
          <Text style={styles.productName}>{product.name || 'Scanned product'}</Text>
          <Text style={styles.bodySoft}>{product.brand || product.category || 'Product information found'}</Text>
        </View>

        <RecallNotice check={product.externalRecallCheck} />

        <View style={[styles.notice, { backgroundColor: trust.bg }]}>
          <Icon name={trust.icon} color={trust.color} />
          <View style={{ flex: 1 }}><Text style={[styles.darkNoticeTitle, { color: trust.color }]}>{trust.title}</Text><Text style={styles.darkNoticeText}>{trust.text}</Text></View>
        </View>

        {['not_found', 'needs_label'].includes(product.lookupStatus) ? (
          <View style={{ marginBottom: 12 }}>
            <PrimaryButton title={busy ? 'Reading label…' : 'Photograph the Label'} icon="camera-outline" onPress={scanLabel} disabled={busy} />
            <SecondaryButton title="Search by Name" icon="search-outline" color={C.cyan} onPress={() => go('search')} />
            <SecondaryButton title="Report This Product" icon="flag-outline" color={C.danger} onPress={report} />
          </View>
        ) : null}

        <View style={styles.resultTabs}>
          {tabs.map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.resultTab, tab === key && styles.resultTabActive]} onPress={() => setTab(key)}>
              <Text style={[styles.resultTabText, tab === key && styles.resultTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'overview' ? (
          <>
            <Text style={styles.sectionTitle}>At a glance</Text>
            <View style={styles.cardPad}>
              <InfoRow label="Product code" value={product.barcode || 'QR link'} />
              <InfoRow label="Confidence" value={(product.identityConfidence || 'low').replace(/^./, (c) => c.toUpperCase())} />
              <InfoRow label="Places checked" value={`${Math.max(1, structuredSourceCount + webEvidenceCount)} found`} />
              <InfoRow label="Details found" value={`${product.dataCompletenessPercent || 0}%`} last />
            </View>
            <Text style={styles.sectionTitle}>Main details</Text>
            <View style={styles.cardPad}>
              <SourceRow label="Product name" value={product.name} field="name" />
              <SourceRow label="Brand" value={product.brand} field="brand" />
              <SourceRow label="Manufacturer" value={product.manufacturerName} field="manufacturerName" />
              <SourceRow label="Category" value={product.category} field="category" />
              <SourceRow label="Quantity" value={product.netContent} field="netContent" last />
            </View>
            <View style={styles.buttonStack}>
              <SecondaryButton title="See More Product Details" icon="sparkles-outline" color={C.primary} onPress={onOpenIntelligence} />
              <SecondaryButton title="Compare Product Quality" icon="git-compare-outline" color={C.primary} onPress={() => go('compare')} />
            </View>
          </>
        ) : null}

        {tab === 'details' ? (
          <>
            <Text style={styles.sectionTitle}>Product details</Text>
            <View style={styles.cardPad}>
              <SourceRow label="Product code" value={product.barcode} field="barcode" />
              <SourceRow label="Product name" value={product.name} field="name" />
              <SourceRow label="Brand" value={product.brand} field="brand" />
              <SourceRow label="Manufacturer" value={product.manufacturerName} field="manufacturerName" />
              <SourceRow label="Category" value={product.category} field="category" />
              <SourceRow label="Description" value={product.description} field="description" />
              {!isFoodLike ? <SourceRow label="Model" value={product.model} field="model" /> : null}
              {!isFoodLike ? <SourceRow label="SKU / item code" value={product.sku} field="sku" /> : null}
              {!isFoodLike ? <SourceRow label="Colour" value={product.color} field="color" /> : null}
              {!isFoodLike ? <SourceRow label="Size" value={product.size} field="size" /> : null}
              {!isFoodLike ? <SourceRow label="Dimensions" value={product.dimensions} field="dimensions" /> : null}
              {!isFoodLike ? <SourceRow label="Weight" value={product.weight} field="weight" /> : null}
              <SourceRow label="Quantity" value={product.netContent} field="netContent" last />
            </View>

            {isTechnical && hasTechnicalDetails ? <>
              <Text style={styles.sectionTitle}>{isEquipment ? 'Equipment details' : 'Specifications'}</Text>
              <View style={styles.cardPad}>
                {isEquipment ? <SourceRow label="Equipment type" value={product.equipmentType} field="equipmentType" /> : null}
                <SourceRow label="Part number" value={product.partNumber} field="partNumber" />
                <SourceRow label="Voltage" value={product.ratedVoltage} field="ratedVoltage" />
                <SourceRow label="Current" value={product.ratedCurrent} field="ratedCurrent" />
                <SourceRow label="Power" value={product.ratedPower} field="ratedPower" />
                <SourceRow label="Frequency" value={product.frequency} field="frequency" />
                <SourceRow label="Phase" value={product.phase} field="phase" />
                <SourceRow label="Rated speed" value={product.speedRpm} field="speedRpm" />
                <SourceRow label="Pressure rating" value={product.pressureRating} field="pressureRating" />
                <SourceRow label="Capacity" value={product.capacity} field="capacity" />
                <SourceRow label="Protection rating" value={product.ipRating} field="ipRating" />
                <SourceRow label="Certification marks" value={product.certificationMarks} field="certificationMarks" />
                <SourceRow label="Warranty" value={product.warranty} field="warranty" last />
              </View>
            </> : null}

            {hasPhysicalDetails ? <>
              <Text style={styles.sectionTitle}>Physical package details</Text>
              <View style={styles.cardPad}>
                <SourceRow label="Batch / lot" value={product.batchNumber} field="batchNumber" />
                <SourceRow label="Expiry / best before" value={product.expiry} field="expiry" />
                <SourceRow label="Manufacture date" value={product.manufactureDate} field="manufactureDate" />
                <SourceRow label="Serial number" value={product.serialNumber} field="serialNumber" />
                <SourceRow label="Distributor / importer" value={product.distributedBy} field="distributedBy" last />
              </View>
            </> : null}

            {hasOriginDetails ? <>
              <Text style={styles.sectionTitle}>Origin & packaging</Text>
              <View style={styles.cardPad}>
                <SourceRow label="Country / market" value={product.countries} field="countries" />
                <SourceRow label="Made in" value={product.manufacturingPlaces || product.origins} field="manufacturingPlaces" />
                <SourceRow label="Packaging" value={product.packaging} field="packaging" />
                <SourceRow label="Labels / certifications" value={product.labels} field="labels" />
                <SourceRow label="Material" value={product.material} field="material" />
                <SourceRow label="Stores" value={product.stores} field="stores" last />
              </View>
            </> : null}

            {Array.isArray(product.webFacts) && product.webFacts.length ? <>
              <Text style={styles.sectionTitle}>More product details</Text>
              <View style={styles.cardPad}>{product.webFacts.slice(0, 30).map((fact, index) => <InfoRow key={`${fact.label}-${index}`} label={fact.label} value={fact.value} last={index === Math.min(product.webFacts.length, 30) - 1} />)}</View>
            </> : null}

            {isFoodLike && (hasNutritionData || hasValue(product.nutritionGrade) || hasValue(product.novaGroup)) ? <>
              <Text style={styles.sectionTitle}>Nutrition</Text>
              <View style={styles.cardPad}>
                <SourceRow label="Nutrition grade" value={product.nutritionGrade} field="nutritionGrade" />
                <SourceRow label="Energy / 100 g or ml" value={nutrientValue('energy-kcal_100g', 'energy-kcal_unit')} field="energy-kcal_100g" nutrient />
                <SourceRow label="Fat / 100 g or ml" value={nutrientValue('fat_100g')} field="fat_100g" nutrient />
                <SourceRow label="Saturated fat / 100 g or ml" value={nutrientValue('saturated-fat_100g')} field="saturated-fat_100g" nutrient />
                <SourceRow label="Carbohydrates / 100 g or ml" value={nutrientValue('carbohydrates_100g')} field="carbohydrates_100g" nutrient />
                <SourceRow label="Sugars / 100 g or ml" value={nutrientValue('sugars_100g')} field="sugars_100g" nutrient />
                <SourceRow label="Protein / 100 g or ml" value={nutrientValue('proteins_100g')} field="proteins_100g" nutrient />
                <SourceRow label="Fibre / 100 g or ml" value={nutrientValue('fiber_100g')} field="fiber_100g" nutrient />
                <SourceRow label="Salt / 100 g or ml" value={nutrientValue('salt_100g')} field="salt_100g" nutrient last />
              </View>
            </> : null}

            {isFoodLike && hasValue(product.ingredientsText) ? <><Text style={styles.sectionTitle}>Ingredients</Text><View style={styles.cardPad}><Text style={styles.body}>{product.ingredientsText}</Text></View></> : null}
          </>
        ) : null}

        {tab === 'safety' ? (
          <>
            {isFoodLike ? <>
              <Text style={styles.sectionTitle}>Your food safety check</Text>
              {!hasSafetyProfile ? (
                <TouchableOpacity style={styles.darkNotice} onPress={() => go('allergySetup')} activeOpacity={0.86}><Icon name="nutrition-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Set your allergy profile</Text><Text style={styles.darkNoticeText}>Add your allergies so food checks can warn you.</Text></View><Icon name="chevron-forward" color={C.primary} /></TouchableOpacity>
              ) : profile?.noKnownAllergies ? (
                <View style={styles.notice}><Icon name="person-circle-outline" color={C.primary} /><Text style={styles.noticeText}>Your profile says you have no known food allergies. Always check the physical product label.</Text></View>
              ) : detectedAllergens.length ? (
                <View style={[styles.notice, { backgroundColor: C.dangerBg }]}><Icon name="warning-outline" color={C.danger} /><View style={{ flex: 1 }}><Text style={[styles.darkNoticeTitle, { color: C.danger }]}>Allergy warning</Text><Text style={styles.darkNoticeText}>This product matches your saved allergies: {detectedAllergens.join(', ')}. Check the physical label before use.</Text></View></View>
              ) : safety.hasProductAllergenData ? (
                <View style={[styles.notice, { backgroundColor: C.successBg }]}><Icon name="checkmark-circle-outline" color={C.success} /><Text style={styles.noticeText}>No saved allergy match was found in the available product information. Always check the physical label.</Text></View>
              ) : (
                <View style={styles.darkNotice}><Icon name="scan-outline" color={C.primary} /><Text style={styles.darkNoticeText}>Scan the physical ingredient label to strengthen this check.</Text></View>
              )}
            </> : null}

            <Text style={styles.sectionTitle}>Check the physical label</Text>
            <View style={styles.darkNotice}><Icon name="scan-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Read label details</Text><Text style={styles.darkNoticeText}>Take a clear photo of the printed label to add batch, expiry, serial, model, origin, ingredients or rating information.</Text></View></View>
            <SecondaryButton title={busy ? 'Reading label…' : 'Scan Label Details'} icon="text-outline" color={C.primary} onPress={scanLabel} />

            {labelOcr ? <>
              <Text style={styles.sectionTitle}>Information read from the label</Text>
              <View style={styles.cardPad}>
                <DetectedRow label="Batch / lot" value={labelOcr?.fields?.batchNumber} />
                <DetectedRow label="Expiry" value={labelOcr?.fields?.expiry} />
                <DetectedRow label="Serial number" value={labelOcr?.fields?.serialNumber} />
                <DetectedRow label="Model" value={labelOcr?.fields?.modelNumber} />
                <DetectedRow label="Part number" value={labelOcr?.fields?.partNumber} />
                <DetectedRow label="SKU / item number" value={labelOcr?.fields?.sku} />
                {isTechnical ? <DetectedRow label="Voltage" value={labelOcr?.fields?.voltage} /> : null}
                {isTechnical ? <DetectedRow label="Current" value={labelOcr?.fields?.current} /> : null}
                {isTechnical ? <DetectedRow label="Power" value={labelOcr?.fields?.power} /> : null}
                {isTechnical ? <DetectedRow label="Frequency" value={labelOcr?.fields?.frequency} /> : null}
                {isTechnical ? <DetectedRow label="Protection rating" value={labelOcr?.fields?.ipRating} /> : null}
                <DetectedRow label="Country of origin" value={labelOcr?.fields?.countryOfOrigin} />
                <DetectedRow label="Manufacturer" value={labelOcr?.fields?.manufacturerText} />
                <DetectedRow label="Distributor / importer" value={labelOcr?.fields?.distributedBy} />
                {isFoodLike ? <DetectedRow label="Ingredients" value={labelOcr?.fields?.ingredientsText} last /> : null}
                {ocrAllergens.length ? <Text style={styles.validationError}>Saved allergy match: {ocrAllergens.join(', ')}</Text> : null}
              </View>
            </> : null}

            <SecondaryButton title="Report This Product" icon="flag-outline" color={C.danger} onPress={report} />
          </>
        ) : null}

        {tab === 'sources' ? (
          <>
            <Text style={styles.sectionTitle}>Where the information came from</Text>
            <View style={styles.cardPad}>
              <InfoRow label="Product records found" value={`${structuredSourceCount}`} />
              <InfoRow label="Public pages found" value={`${webEvidenceCount}`} />
              {gs1Verification ? <InfoRow label="Barcode owner" value={gs1StatusLabel(gs1Verification.status)} /> : null}
              {hasValue(gs1Verification?.licensedCompany) ? <InfoRow label="Registered company" value={gs1Verification.licensedCompany} /> : null}
              <InfoRow label="Confidence" value={(product.identityConfidence || 'low').replace(/^./, (c) => c.toUpperCase())} last />
              {(product.sourcesUsed || []).length ? <View style={[styles.tagWrap, { marginTop: 14 }]}>{product.sourcesUsed.map((source) => <StatusPill key={source.id || source.name} text={friendlySource(source.name)} color={C.primary} bg={C.primaryBg} />)}</View> : null}
            </View>

            {product.webResearch?.results?.length ? <>
              <Text style={styles.sectionTitle}>Public product pages</Text>
              <View style={styles.cardPad}>
                {product.webResearch.results.slice(0, 4).map((item, index) => <TouchableOpacity key={`${item.link}-${index}`} style={[styles.sourceLinkRow, index < Math.min(product.webResearch.results.length, 4) - 1 && styles.infoBorder]} onPress={() => openUrl(item.link)}>
                  <View style={{ flex: 1 }}><Text style={styles.smallStrong}>{item.title}</Text>{item.snippet ? <Text style={styles.bodySoft} numberOfLines={3}>{item.snippet}</Text> : null}</View><Icon name="open-outline" color={C.primary} size={18} />
                </TouchableOpacity>)}
              </View>
            </> : null}
            <SecondaryButton title="Find More Information Online" icon="globe-outline" color={C.cyan} onPress={searchOnline} />
          </>
        ) : null}

        <View style={styles.resultBottomActions}>
          <PrimaryButton title="Scan Another Product" icon="scan-outline" onPress={() => go('scan')} />
        </View>
      </RestorableScrollView>
      <PortalNav role="customer" screen="scan" go={go} />
    </Screen>
  );
}
