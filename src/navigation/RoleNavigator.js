import React, { useEffect, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { Screen, LoadingBlock } from '../components/common';
import { dashboardForRole } from '../components/navigation';
import CustomerDashboardScreen from '../screens/customer/CustomerDashboardScreen';
import AllergyProfileSetupScreen from '../screens/customer/AllergyProfileSetupScreen';
import ScanScreen from '../screens/customer/ScanScreen';
import SearchScreen from '../screens/customer/SearchScreen';
import ProductScreen from '../screens/customer/ProductScreen';
import VerificationScreen from '../screens/customer/VerificationScreen';
import ProductDetailsScreen from '../screens/customer/ProductDetailsScreen';
import ExternalProductScreen from '../screens/customer/ExternalProductScreen';
import ProductIntelligenceScreen from '../screens/customer/ProductIntelligenceScreen';
import HistoryScreen from '../screens/customer/HistoryScreen';
import SavedScreen from '../screens/customer/SavedScreen';
import IngredientScreen from '../screens/customer/IngredientScreen';
import CompareScreen from '../screens/customer/CompareScreen';
import ReportScreen from '../screens/customer/ReportScreen';
import MyReportsScreen from '../screens/customer/MyReportsScreen';
import TrustMapScreen from '../screens/customer/TrustMapScreen';
import ManufacturerDashboardScreen from '../screens/manufacturer/ManufacturerDashboardScreen';
import ManufacturerProductsScreen from '../screens/manufacturer/ManufacturerProductsScreen';
import AddProductScreen from '../screens/manufacturer/AddProductScreen';
import BatchManagementScreen from '../screens/manufacturer/BatchManagementScreen';
import SerialManagementScreen from '../screens/manufacturer/SerialManagementScreen';
import RecallManagementScreen from '../screens/manufacturer/RecallManagementScreen';
import CreateRecallScreen from '../screens/manufacturer/CreateRecallScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ProductManagementScreen from '../screens/admin/ProductManagementScreen';
import ManufacturerManagementScreen from '../screens/admin/ManufacturerManagementScreen';
import AdminBatchManagementScreen from '../screens/admin/BatchManagementScreen';
import AdminRecallManagementScreen from '../screens/admin/RecallManagementScreen';
import AdminSerialManagementScreen from '../screens/admin/SerialManagementScreen';
import ReportManagementScreen from '../screens/admin/ReportManagementScreen';
import GS1ReviewScreen from '../screens/admin/GS1ReviewScreen';
import InvestigationsScreen from '../screens/admin/InvestigationsScreen';
import InvestigationDetailScreen from '../screens/admin/InvestigationDetailScreen';
import DocumentPreviewScreen from '../screens/shared/DocumentPreviewScreen';
import { prepareReportDocument, prepareReportsDocument } from '../services/reportExportService';
import { canSendReports } from '../utils/roleAccess';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import ProfileScreen from '../screens/account/ProfileScreen';
import SettingsScreen from '../screens/account/SettingsScreen';
import AboutScreen from '../screens/account/AboutScreen';
import { getProduct, getProductByBarcode, recordScanLookup, updateExternalScanSnapshot } from '../services/productService';
import { checkProductRecalls, compareRegisteredProductWithExternal, createUnidentifiedExternalProduct, extractGtinFromScanData, extractWebUrlFromScanData, lookupBarcodeExternally, lookupUrlProductExternally } from '../services/externalApiService';
import { getGs1Verification, requestGs1Review } from '../services/gs1Service';
import { friendlyFirebaseError } from '../utils/firebaseErrors';

export default function RoleNavigator({ firebaseUser, profile, refreshProfile }) {
  const role = profile?.role === 'consumer' ? 'customer' : profile?.role || 'customer';
  const [screen, setScreen] = useState(() => role === 'customer' && profile?.allergyProfileComplete !== true ? 'allergySetup' : dashboardForRole(role));
  const [history, setHistory] = useState([]);
  // True only right after the person pressed Back; screens use it to decide whether to restore their old tab.
  const [arrivedByBack, setArrivedByBack] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [externalProduct, setExternalProduct] = useState(null);
  const [externalEvidence, setExternalEvidence] = useState(null);
  const [gs1Verification, setGs1Verification] = useState(null);
  const [verification, setVerification] = useState(null);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [reportProduct, setReportProduct] = useState(null);
  const [reportPrefill, setReportPrefill] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [busyMessage, setBusyMessage] = useState('');
  const [intelligenceProduct, setIntelligenceProduct] = useState(null);
  const [intelligenceReturnScreen, setIntelligenceReturnScreen] = useState('customerHome');

  useEffect(() => {
    setHistory([]);
    setScreen(role === 'customer' && profile?.allergyProfileComplete !== true ? 'allergySetup' : dashboardForRole(role));
  }, [role]);

  const navigateTo = (next, { replace = false } = {}) => {
    const resolved = next === 'home' ? dashboardForRole(role) : next;
    if (!resolved || resolved === screen) return;
    if (resolved === 'report' && !canSendReports(role)) {
      // The database only accepts reports from customer accounts. Say so up front instead of failing at the end.
      Alert.alert('Reports come from customer accounts', 'Product reports can only be sent from a customer account. Sign out and sign in with a customer account to report a product.');
      return;
    }
    setArrivedByBack(false);
    if (!replace) setHistory((old) => [...old, screen].slice(-40));
    setScreen(resolved);
  };

  // Android's back button / back gesture: go to the previous screen instead of closing the whole app.
  // On the first screen of the app it is left alone, so Android can leave the app normally.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const atStart = history.length === 0 && (screen === dashboardForRole(role) || screen === 'allergySetup');
      if (atStart) return false;
      if (busyMessage) return true; // a lookup is in progress: ignore the press instead of leaving half-way
      go('back');
      return true;
    });
    return () => subscription.remove();
  });

  const go = (next) => {
    if (next === 'back') {
      setArrivedByBack(true);
      if (history.length) {
        const previous = history[history.length - 1];
        setHistory((old) => old.slice(0, -1));
        setScreen(previous);
      } else {
        setScreen(dashboardForRole(role));
      }
      return;
    }
    navigateTo(next);
  };

  const openProduct = async (productId, scanId = null) => {
    if (!productId) return;
    setCurrentScanId(scanId || null);
    setBusyMessage('Opening product…');
    try {
      const product = await getProduct(productId);
      if (!product) throw new Error('Product record no longer exists.');
      try { setGs1Verification(await getGs1Verification(product.barcode || '')); } catch (_) { setGs1Verification(null); }
      setActiveProduct(product);
      setExternalEvidence(null);
      setVerification(null);
      navigateTo('product');
    } catch (error) {
      Alert.alert('Product unavailable', friendlyFirebaseError(error));
    } finally {
      setBusyMessage('');
    }
  };

  const openExternalProductResult = async (product, scanId = null) => {
    if (!product) return;
    setCurrentScanId(scanId || null);
    setBusyMessage('Preparing product details…');
    try {
      const barcode = product.barcode || '';
      try { setGs1Verification(barcode ? await getGs1Verification(barcode) : null); } catch (_) { setGs1Verification(null); }
      setExternalProduct(product);
      setActiveProduct(null);
      setExternalEvidence(null);
      setVerification(null);
      navigateTo('externalProduct');
    } finally {
      setBusyMessage('');
    }
  };

  const openHistoryScan = async (scan) => {
    if (!scan) return;
    setCurrentScanId(scan.id || null);

    if (scan.productId) {
      setBusyMessage('Opening scan…');
      try {
        const product = await getProduct(scan.productId);
        if (product) {
          try { setGs1Verification(await getGs1Verification(product.barcode || '')); } catch (_) { setGs1Verification(null); }
          setActiveProduct(product);
          setExternalProduct(null);
          setExternalEvidence(null);
          setVerification(null);
          navigateTo('product');
          return;
        }
      } catch (_) {
      } finally {
        setBusyMessage('');
      }
    }

    const stored = scan.productSnapshot || scan.externalSnapshot;
    if (stored) {
      await openExternalProductResult(stored, scan.id || null);
      return;
    }

    if (scan.barcode) {
      setBusyMessage('Refreshing product details…');
      try {
        const external = await lookupBarcodeExternally(scan.barcode);
        if (external?.found && external?.product) {
          await updateExternalScanSnapshot(firebaseUser.uid, scan.id, external.product);
          await openExternalProductResult(external.product, scan.id || null);
          return;
        }
      } catch (_) {
      } finally {
        setBusyMessage('');
      }
    }

    Alert.alert('Scan record', `${scan.productName || 'This product'} is still in your history, but Product Trust could not rebuild its product details yet.

Barcode: ${scan.barcode || 'Unknown'}
Status: ${scan.identityLabel || 'Lookup incomplete'}`);
  };

  const openSavedProduct = async (saved) => {
    if (!saved) return;
    if (saved.productId) {
      setBusyMessage('Opening saved product…');
      try {
        const product = await getProduct(saved.productId);
        if (product) {
          setActiveProduct(product);
          setExternalProduct(null);
          navigateTo('product');
          return;
        }
      } catch (_) {
      } finally {
        setBusyMessage('');
      }
    }
    if (saved.productSnapshot) {
      await openExternalProductResult(saved.productSnapshot);
      return;
    }
    if (saved.barcode) {
      setBusyMessage('Refreshing saved product…');
      try {
        const external = await lookupBarcodeExternally(saved.barcode);
        if (external?.found && external?.product) {
          await openExternalProductResult(external.product);
          return;
        }
      } catch (_) {
      } finally {
        setBusyMessage('');
      }
    }
    Alert.alert('Saved product unavailable', 'The saved entry is preserved, but its product details could not be loaded right now.');
  };

  const prepareGs1Evidence = async (barcode, productName = '', brand = '', sourceType = 'external') => {
    try {
      const existing = await getGs1Verification(barcode);
      setGs1Verification(existing);
      if (!existing) {
        await requestGs1Review({ barcode, productName, brand, sourceType });
      }
      return existing;
    } catch (_) {
      setGs1Verification(null);
      return null;
    }
  };

  const handleBarcode = async (barcode) => {
    const normalizedBarcode = extractGtinFromScanData(barcode);
    const webUrl = extractWebUrlFromScanData(barcode);
    if (!normalizedBarcode && webUrl) {
      setBusyMessage('Reading product information…');
      try {
        const webResult = await lookupUrlProductExternally(webUrl);
        if (webResult?.found && webResult?.product) {
          const scanId = await recordScanLookup(firebaseUser.uid, {
            barcode: '',
            product: webResult.product,
            sourceType: 'external',
            sourceLabel: 'Web QR reference',
            identityStatus: 'web_reference',
            identityLabel: 'Public product web reference found from QR code',
          });
          setCurrentScanId(scanId);
          setExternalProduct(webResult.product);
          setActiveProduct(null);
          setVerification(null);
          navigateTo('externalProduct');
          return;
        }
        Alert.alert('Website QR detected', 'The QR code contains a website, but Product Trust could not read product metadata from that page.');
      } catch (error) {
        Alert.alert('Website lookup unavailable', friendlyFirebaseError(error));
      } finally {
        setBusyMessage('');
      }
      return;
    }
    if (!normalizedBarcode) {
      Alert.alert('Unsupported product code', 'Scan a product barcode, supported product QR code, or product website QR code.');
      return;
    }

    setCurrentScanId(null);
    setGs1Verification(null);
    setBusyMessage(`Checking product…`);
    try {
      const product = await getProductByBarcode(normalizedBarcode);
      if (product) {
        const gs1 = await prepareGs1Evidence(normalizedBarcode, product.name || '', product.brand || product.manufacturerName || '', 'partner_manufacturer');
        setActiveProduct(product);
        setExternalProduct(null);
        setVerification(null);
        setBusyMessage('Product found. Checking supporting information…');
        // Recall check for the registered product itself (its own name and brand), at the same time as the second opinion.
        const recallPromise = checkProductRecalls({ barcode: normalizedBarcode, name: product.name, brand: product.brand || product.manufacturerName });
        let evidence;
        try {
          // A short second opinion only (6 seconds at most). The registered record is already the answer.
          const external = await lookupBarcodeExternally(normalizedBarcode, { quick: true, skipRecalls: true });
          evidence = external?.found && external?.product
            ? { found: true, ...compareRegisteredProductWithExternal(product, external.product) }
            : { found: false, source: 'Independent product sources', detail: 'No comparable independent record was available.' };
        } catch (externalError) {
          evidence = { found: false, source: 'Independent product sources', detail: friendlyFirebaseError(externalError) };
        }
        const recallCheck = await recallPromise.catch(() => null);
        setExternalEvidence({ ...evidence, recallCheck });
        const scanId = await recordScanLookup(firebaseUser.uid, {
          barcode: normalizedBarcode,
          product,
          sourceType: 'partner',
          sourceLabel: 'Product Trust manufacturer record',
          identityStatus: gs1?.status === 'mismatch' ? 'gs1_mismatch' : 'partner_match',
          identityLabel: gs1?.status === 'mismatch' ? 'Manufacturer product found but GS1 evidence conflicts' : 'Partner manufacturer product matched',
          gs1Verification: gs1,
        });
        setCurrentScanId(scanId);
        navigateTo('product');
        return;
      }

      setBusyMessage('Finding product information…');
      const external = await lookupBarcodeExternally(normalizedBarcode);
      if (external?.found && external?.product) {
        const gs1 = await prepareGs1Evidence(normalizedBarcode, external.product.name || '', external.product.brand || '', 'external_product');
        const structuredSourceCount = Number(external.product.structuredSourceCount || 0);
        const gtinValid = external.product.gtin?.valid === true;
        const highIdentityConfidence = external.product.identityConfidence === 'high';
        const identityStatus = !gtinValid
          ? 'invalid_gtin'
          : gs1?.status === 'mismatch'
            ? 'gs1_mismatch'
            : gs1?.status === 'verified' || structuredSourceCount >= 2 || highIdentityConfidence
              ? 'identity_verified'
              : 'external_match';
        const identityLabel = identityStatus === 'identity_verified'
          ? 'Product identity verified from matching independent evidence'
          : identityStatus === 'external_match'
            ? 'Product identity found in an independent source'
            : identityStatus === 'invalid_gtin'
              ? 'Invalid GTIN check digit'
              : 'GS1 ownership evidence conflicts with this product';
        const scanId = await recordScanLookup(firebaseUser.uid, {
          barcode: normalizedBarcode,
          product: external.product,
          sourceType: 'external',
          sourceLabel: external.providerName || 'Independent product sources',
          identityStatus,
          identityLabel,
          gs1Verification: gs1,
        });
        setCurrentScanId(scanId);
        setExternalProduct(external.product);
        setActiveProduct(null);
        setVerification(null);
        navigateTo('externalProduct');
        return;
      }

      await prepareGs1Evidence(normalizedBarcode, 'Scanned product', '', 'unidentified_scan');
      if (external?.timedOut) {
        Alert.alert('The product sources are slow', 'We could not finish checking this barcode in time. Scan it again in a minute, or photograph the label.');
      }
      const unidentified = createUnidentifiedExternalProduct(normalizedBarcode);
      const scanId = await recordScanLookup(firebaseUser.uid, {
        barcode: normalizedBarcode,
        product: unidentified,
        sourceType: 'external',
        sourceLabel: 'Barcode captured — physical label enrichment available',
        identityStatus: 'needs_label',
        identityLabel: 'Barcode captured — scan the physical label to complete the product profile',
      });
      setCurrentScanId(scanId);
      setExternalProduct(unidentified);
      setActiveProduct(null);
      setVerification(null);
      navigateTo('externalProduct');
      return;
    } catch (error) {
      try {
        const scanId = await recordScanLookup(firebaseUser.uid, {
          barcode: normalizedBarcode,
          product: { name: 'Lookup unavailable', barcode: normalizedBarcode },
          sourceType: 'unidentified',
          sourceLabel: 'Lookup unavailable',
          identityStatus: 'lookup_unavailable',
          identityLabel: 'External lookup could not complete',
        });
        setCurrentScanId(scanId);
      } catch (_) {}
      Alert.alert(
        'External lookup unavailable',
        `${friendlyFirebaseError(error)}\n\nThe scan has been recorded in Scan History. Try the lookup again when connected.`,
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Report', onPress: () => { setReportProduct({ id: '', name: 'Unregistered product', barcode: normalizedBarcode, manufacturerId: '' }); navigateTo('report'); } },
        ],
      );
    } finally {
      setBusyMessage('');
    }
  };

  const saveExternalEnrichment = async (product) => {
    setExternalProduct(product);
    if (currentScanId) {
      try { await updateExternalScanSnapshot(firebaseUser.uid, currentScanId, product); } catch (_) {}
    }
  };

  const openProductIntelligence = (product, returnScreen = 'externalProduct') => {
    if (!product) return;
    setIntelligenceProduct(product);
    setIntelligenceReturnScreen(returnScreen);
    navigateTo('productIntelligence');
  };

  const saveIntelligenceEnrichment = async (product) => {
    setIntelligenceProduct(product);
    if (intelligenceReturnScreen === 'externalProduct' || product?.external) {
      setExternalProduct(product);
      if (currentScanId) {
        try { await updateExternalScanSnapshot(firebaseUser.uid, currentScanId, product); } catch (_) {}
      }
    }
  };

  // Open a report (or a summary of reports) inside the app as a branded document.
  const openDocument = async (kind, payload, title) => {
    setBusyMessage('Preparing document…');
    try {
      const prepared = kind === 'reports' ? await prepareReportsDocument(payload, title) : await prepareReportDocument(payload, title);
      setPreviewDocument(prepared);
      navigateTo('documentPreview');
    } catch (error) {
      Alert.alert('Could not open the document', friendlyFirebaseError(error));
    } finally {
      setBusyMessage('');
    }
  };

  const openInvestigation = (item) => {
    setInvestigation(item);
    navigateTo('investigationDetail');
  };

  if (busyMessage) return <Screen><LoadingBlock text={busyMessage} /></Screen>;
  if (role === 'customer') {
    if (screen === 'customerHome') return <CustomerDashboardScreen uid={firebaseUser.uid} profile={profile} go={go} openHistoryScan={openHistoryScan} />;
    if (screen === 'scan') return <ScanScreen go={go} onBarcode={handleBarcode} />;
    if (screen === 'search') return <SearchScreen go={go} openProduct={openProduct} openExternalProduct={openExternalProductResult} onBarcode={handleBarcode} />;
    if (screen === 'product' && activeProduct) return <ProductScreen uid={firebaseUser.uid} product={activeProduct} profile={profile} externalEvidence={externalEvidence} gs1Verification={gs1Verification} currentScanId={currentScanId} go={go} onVerified={setVerification} setReportProduct={setReportProduct} onOpenIntelligence={() => openProductIntelligence(activeProduct, 'product')} />;
    if (screen === 'externalProduct' && externalProduct) return <ExternalProductScreen uid={firebaseUser.uid} product={externalProduct} arrivedByBack={arrivedByBack} profile={profile} gs1Verification={gs1Verification} go={go} setReportProduct={setReportProduct} onProductEnriched={saveExternalEnrichment} onOpenIntelligence={() => openProductIntelligence(externalProduct, 'externalProduct')} />;
    if (screen === 'productIntelligence' && intelligenceProduct) return <ProductIntelligenceScreen uid={firebaseUser.uid} product={intelligenceProduct} arrivedByBack={arrivedByBack} profile={profile} gs1Verification={gs1Verification} go={go} onBack={() => go('back')} onProductEnriched={saveIntelligenceEnrichment} />;
    if (screen === 'verification' && activeProduct && verification) return <VerificationScreen product={activeProduct} verification={verification} go={go} setReportProduct={setReportProduct} />;
    if (screen === 'productDetails' && activeProduct) return <ProductDetailsScreen product={activeProduct} go={go} />;
    if (screen === 'history') return <HistoryScreen uid={firebaseUser.uid} go={go} openHistoryScan={openHistoryScan} />;
    if (screen === 'saved') return <SavedScreen uid={firebaseUser.uid} go={go} openSavedProduct={openSavedProduct} />;
    if (screen === 'allergySetup') return <AllergyProfileSetupScreen uid={firebaseUser.uid} profile={profile} refreshProfile={refreshProfile} go={go} onSkip={() => navigateTo('customerHome', { replace: true })} />;
    if (screen === 'ingredients') return <IngredientScreen uid={firebaseUser.uid} profile={profile} go={go} onReport={(prefill) => { setReportProduct(null); setReportPrefill(prefill || null); navigateTo('report'); }} />;
    if (screen === 'compare') return <CompareScreen uid={firebaseUser.uid} go={go} initialProduct={activeProduct || externalProduct} />;
    if (screen === 'report') return <ReportScreen uid={firebaseUser.uid} product={reportProduct} prefill={reportPrefill} go={go} clearProduct={() => { setReportProduct(null); setReportPrefill(null); }} />;
    if (screen === 'myReports') return <MyReportsScreen uid={firebaseUser.uid} go={go} openDocument={openDocument} />;
  }
  if (role === 'manufacturer') {
    if (screen === 'manufacturer') return <ManufacturerDashboardScreen uid={firebaseUser.uid} profile={profile} go={go} />;
    if (screen === 'manufacturerProducts') return <ManufacturerProductsScreen uid={firebaseUser.uid} go={go} />;
    if (screen === 'manufacturerAddProduct') return <AddProductScreen uid={firebaseUser.uid} profile={profile} go={go} />;
    if (screen === 'manufacturerAddBatch') return <BatchManagementScreen uid={firebaseUser.uid} go={go} />;
    if (screen === 'manufacturerRecalls') return <RecallManagementScreen uid={firebaseUser.uid} go={go} />;
    if (screen === 'manufacturerRecall') return <CreateRecallScreen uid={firebaseUser.uid} go={go} />;
    if (screen === 'manufacturerSerial') return <SerialManagementScreen uid={firebaseUser.uid} go={go} />;
    if (screen === 'investigations') return <InvestigationsScreen profile={profile} go={go} openInvestigation={openInvestigation} openDocument={openDocument} />;
    if (screen === 'investigationDetail' && investigation) return <InvestigationDetailScreen profile={profile} item={investigation} go={go} openDocument={openDocument} />;
  }
  if (role === 'admin') {
    if (screen === 'admin') return <AdminDashboardScreen profile={profile} go={go} />;
    if (screen === 'investigations') return <InvestigationsScreen profile={profile} go={go} openInvestigation={openInvestigation} openDocument={openDocument} />;
    if (screen === 'investigationDetail' && investigation) return <InvestigationDetailScreen profile={profile} item={investigation} go={go} openDocument={openDocument} />;
    if (screen === 'adminUsers') return <UserManagementScreen go={go} currentUid={firebaseUser.uid} />;
    if (screen === 'adminProducts') return <ProductManagementScreen go={go} />;
    if (screen === 'adminBatches') return <AdminBatchManagementScreen go={go} />;
    if (screen === 'adminRecalls') return <AdminRecallManagementScreen go={go} />;
    if (screen === 'adminSerials') return <AdminSerialManagementScreen go={go} />;
    if (screen === 'adminReports') return <ReportManagementScreen go={go} openInvestigation={openInvestigation} openDocument={openDocument} />;
    if (screen === 'adminManufacturers') return <ManufacturerManagementScreen go={go} />;
    if (screen === 'adminGs1') return <GS1ReviewScreen uid={firebaseUser.uid} go={go} />;
  }
  if (screen === 'allergySetup' && role === 'customer') return <AllergyProfileSetupScreen uid={firebaseUser.uid} profile={profile} refreshProfile={refreshProfile} go={go} onSkip={() => navigateTo('customerHome', { replace: true })} />;
    if (screen === 'trustMap') return <TrustMapScreen go={go} profile={{ ...profile, role }} openInvestigation={openInvestigation} />;
  if (screen === 'profile') return <ProfileScreen profile={{ ...profile, role }} go={go} />;
  if (screen === 'settings') return <SettingsScreen uid={firebaseUser.uid} profile={{ ...profile, role }} refreshProfile={refreshProfile} go={go} arrivedByBack={arrivedByBack} />;
  if (screen === 'about') return <AboutScreen go={go} role={role} />;
  if (screen === 'documentPreview' && previewDocument) return <DocumentPreviewScreen document={previewDocument} go={go} role={role} />;
  if (role === 'admin') return <AdminDashboardScreen profile={profile} go={go} />;
  if (role === 'manufacturer') return <ManufacturerDashboardScreen uid={firebaseUser.uid} profile={profile} go={go} />;
  return <CustomerDashboardScreen uid={firebaseUser.uid} profile={profile} go={go} openHistoryScan={openHistoryScan} />;
}
