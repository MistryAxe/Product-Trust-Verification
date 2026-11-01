import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, ProductThumb, StatusPill, InfoRow, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { RecallNotice } from '../../components/product/RecallNotice';
import { BrandLogo } from '../../components/common';
import { getManufacturerBrand } from '../../services/brandService';
import { apiConfigured } from '../../config/api';
import { comparePackagingExternally, extractProductLabelExternally } from '../../services/externalApiService';
import { gs1StatusLabel } from '../../services/gs1Service';
import { analyseIngredientText, analyseProductAllergens } from '../../services/ingredientService';
import { isProductSaved, removeSavedProduct, saveProduct, saveScan, verifyProduct } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function ProductScreen({ uid, product, profile, externalEvidence, gs1Verification, currentScanId, go, onVerified, setReportProduct, onOpenIntelligence }) {
  const [makerBrand, setMakerBrand] = useState(null);
  const [batchNumber, setBatchNumber] = useState('');
  useEffect(() => { let on = true; getManufacturerBrand(product?.manufacturerId).then((b) => { if (on) setMakerBrand(b); }); return () => { on = false; }; }, [product?.manufacturerId]);
  const [serialNumber, setSerialNumber] = useState('');
  const [printedExpiry, setPrintedExpiry] = useState('');
  const [labelOcr, setLabelOcr] = useState(null);
  const [packagingEvidence, setPackagingEvidence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    isProductSaved(uid, product.id).then(setSaved).catch(() => {});
  }, [uid, product.id]);

  const captureForOcr = async () => {
    if (!apiConfigured('ocrSpaceApiKey')) {
      return Alert.alert('Automatic label reading is not ready', 'Automatic label reading can be connected later. You can still enter the printed details manually.');
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera permission required', 'Allow camera access to read the batch, expiry and serial from the product label.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.42, base64: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return Alert.alert('Image unavailable', 'The captured image could not be prepared for label reading.');
    setBusy(true);
    try {
      const ocr = await extractProductLabelExternally({ imageBase64: asset.base64 });
      setLabelOcr(ocr);
      if (ocr?.fields?.batchNumber) setBatchNumber(ocr.fields.batchNumber);
      if (ocr?.fields?.expiry) setPrintedExpiry(ocr.fields.expiry);
      if (ocr?.fields?.serialNumber && product.serialTrackingEnabled) setSerialNumber(ocr.fields.serialNumber);
      Alert.alert('Label read', 'Any detected batch, expiry and serial values have been filled in. Review them before verification.');
    } catch (error) {
      Alert.alert('Label reading failed', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const comparePackaging = async () => {
    if (!product.packagingReferenceUrl) {
      return Alert.alert('No reference image', 'This manufacturer has not supplied an official packaging reference image for this product.');
    }
    if (!apiConfigured('ocrSpaceApiKey')) {
      return Alert.alert('Packaging comparison is not ready', 'Automatic packaging comparison can be connected later.');
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera permission required', 'Allow camera access to compare the product packaging.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.42, base64: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return Alert.alert('Image unavailable', 'The captured image could not be prepared for comparison.');
    setBusy(true);
    try {
      const evidence = await comparePackagingExternally({
        scannedImageBase64: asset.base64,
        referenceImageUrl: product.packagingReferenceUrl,
        expectedSecurityFeatures: product.securityFeatures || '',
        expectedProductName: product.name || '',
        expectedBrand: product.brand || product.manufacturerName || '',
        expectedPackagingDescription: product.packagingDescription || '',
      });
      setPackagingEvidence(evidence);
      Alert.alert('Packaging comparison complete', `${Math.round(Number(evidence?.similarityScore || 0))}% packaging evidence match. Free mode compares label text and declared security wording; it is supporting evidence, not standalone proof of authenticity.`);
    } catch (error) {
      Alert.alert('Packaging comparison failed', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const runVerification = async () => {
    setBusy(true);
    try {
      const result = await verifyProduct(product, {
        batchNumber,
        serialNumber,
        printedExpiry,
        externalEvidence,
        packagingEvidence,
        gs1Verification,
      });
      await saveScan(uid, product, result, currentScanId || '');
      onVerified(result);
      go('verification');
    } catch (error) {
      Alert.alert('Verification failed', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleSaved = async () => {
    try {
      if (saved) await removeSavedProduct(uid, product.id);
      else await saveProduct(uid, product);
      setSaved(!saved);
    } catch (error) {
      Alert.alert('Unable to update saved products', friendlyFirebaseError(error));
    }
  };

  const evidenceColor = externalEvidence?.consistent === true ? C.success : externalEvidence?.consistent === false ? C.danger : C.cyan;
  const evidenceBg = externalEvidence?.consistent === true ? C.successBg : externalEvidence?.consistent === false ? C.dangerBg : C.surface2;
  const isFoodLike = product.productClass === 'food' || product.productType === 'food' || !!product.usdaMatch || !!product.ingredientsText || Object.keys(product.nutriments || {}).length > 0;
  const isEquipment = product.productClass === 'equipment';
  const isTechnical = isEquipment || product.productClass === 'electronics';
  const safety = analyseProductAllergens(product, profile?.allergens || [], profile?.customAllergens || []);
  const ocrSafety = labelOcr?.fields?.ingredientsText
    ? analyseIngredientText(labelOcr.fields.ingredientsText, profile?.allergens || [], profile?.customAllergens || [])
    : [];
  const allergyMatches = [...new Set([...(safety.detected || []), ...ocrSafety])];
  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
  const OptionalRow = ({ label, value, last = false }) => hasValue(value) ? <InfoRow label={label} value={value} last={last} /> : null;
  const hasTechnicalDetails = [product.equipmentType, product.model, product.partNumber, product.ratedVoltage, product.ratedCurrent, product.ratedPower, product.frequency, product.phase, product.speedRpm, product.pressureRating, product.capacity, product.ipRating, product.certificationMarks].some(hasValue);

  return (
    <Screen>
      <TopBar
        title="Product Trust Record"
        onBack={() => go('back')}
        right={<TouchableOpacity onPress={toggleSaved} style={styles.iconButton}><Icon name={saved ? 'heart' : 'heart-outline'} color={saved ? C.danger : C.text} /></TouchableOpacity>}
      />
      <RestorableScrollView screenKey={`product:${product.id || product.barcode || product.name || 'record'}`} contentContainerStyle={styles.pagePad}>
        <View style={styles.productHero}>
          <ProductThumb size={92} imageUrl={product.packagingReferenceUrl || product.imageUrl || ''} />
          {makerBrand?.logoDataUri || makerBrand?.name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BrandLogo uri={makerBrand.logoDataUri} name={makerBrand.name || product.manufacturerName} size={40} />
              <Text style={styles.rowTitle}>{makerBrand.name || product.manufacturerName}</Text>
            </View>
          ) : null}
          <StatusPill text="MANUFACTURER REGISTERED" color={C.deepGreen} bg={C.primary} />
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.bodySoft}>{product.brand || product.category || 'Registered Product'}</Text>
        </View>
        <SecondaryButton title="See More Product Details" icon="sparkles-outline" color={C.primary} onPress={onOpenIntelligence} />
        <View style={styles.cardPad}>
          <OptionalRow label="Barcode" value={product.barcode} />
          <OptionalRow label="Manufacturer" value={product.manufacturerName} />
          <OptionalRow label="Brand" value={product.brand} />
          <OptionalRow label="Category" value={product.category} />
          <OptionalRow label="Net content" value={product.netContent} />
          <OptionalRow label="Country" value={product.country || product.countries || product.origins} last />
        </View>

        {isFoodLike ? <>
        <Text style={styles.sectionTitle}>Personal food safety</Text>
        {profile?.allergyProfileComplete !== true ? (
          <TouchableOpacity style={styles.darkNotice} onPress={() => go('allergySetup')} activeOpacity={0.86}>
            <Icon name="nutrition-outline" color={C.primary} />
            <View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Set your allergy profile</Text><Text style={styles.darkNoticeText}>Add your allergies so Product Trust can personalise ingredient and label checks.</Text></View>
            <Icon name="chevron-forward" color={C.primary} />
          </TouchableOpacity>
        ) : profile?.noKnownAllergies ? (
          <View style={styles.notice}><Icon name="person-circle-outline" color={C.primary} /><Text style={styles.noticeText}>Your Food Safety Profile says you have no known food allergies. Always check the physical label.</Text></View>
        ) : allergyMatches.length ? (
          <View style={[styles.notice, { backgroundColor: C.dangerBg }]}><Icon name="warning-outline" color={C.danger} /><View style={{ flex: 1 }}><Text style={[styles.smallStrong, { color: C.danger }]}>ALLERGY WARNING</Text><Text style={[styles.noticeText, { color: C.danger }]}>Matched your saved profile: {allergyMatches.join(', ')}.</Text></View></View>
        ) : safety.hasProductAllergenData ? (
          <View style={[styles.notice, { backgroundColor: C.successBg }]}><Icon name="checkmark-circle-outline" color={C.success} /><Text style={[styles.noticeText, { color: C.success }]}>No saved allergy match was detected in the available manufacturer ingredient/allergen data. Always verify the physical label.</Text></View>
        ) : (
          <View style={styles.darkNotice}><Icon name="scan-outline" color={C.primary} /><Text style={styles.darkNoticeText}>Scan the physical ingredient label to strengthen the personalised allergen check.</Text></View>
        )}

        </> : null}

        <Text style={styles.sectionTitle}>Recall check</Text>
        <RecallNotice check={externalEvidence?.recallCheck} />

        <Text style={styles.sectionTitle}>Product identity check</Text>
        <View style={[styles.notice, { backgroundColor: evidenceBg }]}>
          <Icon name={externalEvidence?.consistent === true ? 'checkmark-circle-outline' : externalEvidence?.consistent === false ? 'warning-outline' : 'information-circle-outline'} color={evidenceColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.smallStrong, { color: evidenceColor }]}>{externalEvidence?.found ? `Checked against ${externalEvidence.source || 'external source'}` : 'Product Trust manufacturer identity'}</Text>
            <Text style={[styles.noticeText, { color: evidenceColor }]}>{externalEvidence?.found ? (externalEvidence?.detail || 'Independent evidence supports the manufacturer record.') : 'This product is registered by its manufacturer in Product Trust. Independent sources can strengthen the identity result when they contain the same barcode.'}</Text>
          </View>
        </View>

        {gs1Verification ? <>
        <Text style={styles.sectionTitle}>Barcode ownership check</Text>
        <View style={styles.cardPad}>
          <InfoRow label="Barcode owner check" value={gs1StatusLabel(gs1Verification.status)} />
          <OptionalRow label="Licensed company" value={gs1Verification?.licensedCompany} />
          <OptionalRow label="Registered brand" value={gs1Verification?.brand} />
          <OptionalRow label="Registered product description" value={gs1Verification?.productDescription} last />
        </View>
        </> : null}

        {isTechnical && hasTechnicalDetails ? <>
        <Text style={styles.sectionTitle}>{isEquipment ? 'Equipment details' : 'Specifications'}</Text>
        <View style={styles.cardPad}>
          {isEquipment ? <OptionalRow label="Equipment type" value={product.equipmentType} /> : null}
          <OptionalRow label="Model" value={product.model} />
          <OptionalRow label="Part number" value={product.partNumber} />
          <OptionalRow label="Rated voltage" value={product.ratedVoltage} />
          <OptionalRow label="Rated current" value={product.ratedCurrent} />
          <OptionalRow label="Rated power" value={product.ratedPower} />
          <OptionalRow label="Frequency" value={product.frequency} />
          <OptionalRow label="Phase" value={product.phase} />
          <OptionalRow label="Rated speed" value={product.speedRpm} />
          <OptionalRow label="Pressure rating" value={product.pressureRating} />
          <OptionalRow label="Capacity" value={product.capacity} />
          <OptionalRow label="Protection rating" value={product.ipRating} />
          <OptionalRow label="Certification / conformity marks" value={product.certificationMarks} last />
        </View>
        </> : null}

        <Text style={styles.sectionTitle}>Physical product checks</Text>
        <Text style={[styles.bodySoft, { marginBottom: 12 }]}>{isTechnical ? 'Enter the serial or batch if available, then scan the equipment label to read model and rating information. Review anything read from the label before checking the product.' : 'Enter the printed values manually, or scan the product label when automatic label reading is available. Review the values before checking the product.'}</Text>
        <Input label="Batch / lot number" placeholder="Enter batch number" autoCapitalize="characters" value={batchNumber} onChangeText={setBatchNumber} />
        <Input label="Printed expiry" placeholder="Example: 09/2028 or 2028-09-30" autoCapitalize="characters" value={printedExpiry} onChangeText={setPrintedExpiry} />
        {product.serialTrackingEnabled ? <Input label="Serial number" placeholder="Serial number" autoCapitalize="characters" value={serialNumber} onChangeText={setSerialNumber} /> : null}

        <View style={styles.buttonStack}>
          <SecondaryButton title={apiConfigured('ocrSpaceApiKey') ? (isTechnical ? 'Scan Equipment Label' : 'Scan Product Label') : 'Scan Product Label'} icon="text-outline" color={C.primary} onPress={captureForOcr} />
          {product.packagingReferenceUrl ? <SecondaryButton title={apiConfigured('ocrSpaceApiKey') ? 'Compare Packaging & Security Features' : 'Compare Packaging'} icon="images-outline" color={C.primary} onPress={comparePackaging} /> : null}
        </View>

        {labelOcr ? (
          <View style={styles.cardPad}>
            <Text style={styles.bodyStrong}>Information read from label</Text>
            <OptionalRow label="Detected batch" value={labelOcr?.fields?.batchNumber} />
            <OptionalRow label="Detected expiry" value={labelOcr?.fields?.expiry} />
            <OptionalRow label="Detected serial" value={labelOcr?.fields?.serialNumber} />
            {isTechnical ? <OptionalRow label="Detected model" value={labelOcr?.fields?.modelNumber} /> : null}
            {isTechnical ? <OptionalRow label="Detected part number" value={labelOcr?.fields?.partNumber} /> : null}
            {isTechnical ? <OptionalRow label="Detected voltage" value={labelOcr?.fields?.voltage} /> : null}
            {isTechnical ? <OptionalRow label="Detected current" value={labelOcr?.fields?.current} /> : null}
            {isTechnical ? <OptionalRow label="Detected power" value={labelOcr?.fields?.power} /> : null}
            {isTechnical ? <OptionalRow label="Detected frequency" value={labelOcr?.fields?.frequency} /> : null}
            {isTechnical ? <OptionalRow label="Detected phase" value={labelOcr?.fields?.phase} /> : null}
            {isTechnical ? <OptionalRow label="Detected protection rating" value={labelOcr?.fields?.ipRating} /> : null}
            {isTechnical ? <OptionalRow label="Detected certification marks" value={labelOcr?.fields?.certificationMarks} /> : null}
            {isFoodLike ? <OptionalRow label="Detected ingredients" value={labelOcr?.fields?.ingredientsText} last /> : null}
            {ocrSafety.length ? <Text style={[styles.validationError, { marginTop: 10 }]}>Saved allergy match in scanned label: {ocrSafety.join(', ')}</Text> : null}
          </View>
        ) : null}

        {packagingEvidence ? (
          <View style={styles.cardPad}>
            <Text style={styles.bodyStrong}>Packaging evidence</Text>
            <InfoRow label="Packaging evidence match" value={`${Math.round(Number(packagingEvidence.similarityScore || 0))}%`} />
            {packagingEvidence.components?.referenceText != null ? <InfoRow label="Reference text match" value={`${Math.round(Number(packagingEvidence.components.referenceText))}%`} /> : null}
            {packagingEvidence.components?.identity != null ? <InfoRow label="Product identity wording" value={`${Math.round(Number(packagingEvidence.components.identity))}%`} /> : null}
            {packagingEvidence.components?.securityText != null ? <InfoRow label="Security wording" value={`${Math.round(Number(packagingEvidence.components.securityText))}%`} last /> : null}
          </View>
        ) : null}

        <PrimaryButton title={busy ? 'Checking evidence…' : 'Run Verification'} onPress={runVerification} disabled={busy} icon="shield-checkmark-outline" />
        <View style={styles.buttonStack}>
          <SecondaryButton title="View Product Details" icon="information-circle-outline" onPress={() => go('productDetails')} />
          <SecondaryButton title="See More Product Details" icon="sparkles-outline" color={C.primary} onPress={onOpenIntelligence} />
          <SecondaryButton title="Compare Product Quality" icon="git-compare-outline" color={C.primary} onPress={() => go('compare')} />
          <SecondaryButton title="Report This Product" icon="flag-outline" color={C.danger} onPress={() => { setReportProduct(product); go('report'); }} />
        </View>
      </RestorableScrollView>
      <PortalNav role="customer" screen="scan" go={go} />
    </Screen>
  );
}
