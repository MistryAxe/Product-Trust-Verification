import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'App.js',
  'app.json',
  'package.json',
  'firebase.json',
  'firebase/firestore.rules',
  'firebase/storage.rules',
  'firebase/firestore.indexes.json',
  '.env.example',
  'src/navigation/RootNavigator.js',
  'src/navigation/RoleNavigator.js',
  'src/hooks/useAuthSession.js',
  'src/hooks/useTrustMapData.js',
  'src/utils/roleAccess.js',
  'src/utils/screenMemory.js',
  'src/hooks/useLoginCodeGate.js',
  'src/config/features.js',
  'src/screens/auth/LoginCodeScreen.js',
  'src/services/loginCodeService.js',
  'src/screens/auth/VerifyEmailScreen.js',
  'src/screens/shared/DocumentPreviewScreen.js',
  'src/components/reports/HtmlViewer.native.js',
  'src/components/reports/HtmlViewer.web.js',
  'src/components/reports/CompanyLogoEditor.js',
  'src/components/common/BrandLogo.js',
  'src/services/brandService.js',
  'src/utils/netFetch.js',
  'src/components/map/MapPanels.js',
  'src/components/reports/EvidenceStrip.js',
  'src/components/reports/CaseMessages.js',
  'src/theme/colors.js',
  'src/theme/styles.js',
  'src/components/common/index.js',
  'src/components/navigation/index.js',
  'src/screens/onboarding/LandingScreen.js',
  'src/screens/auth/AuthScreen.js',
  'src/components/auth/GoogleSignInButton.native.js',
  'src/components/auth/GoogleSignInButton.web.js',
  'src/screens/account/AboutScreen.js',
  'src/screens/account/SettingsScreen.js',
  'src/screens/customer/CustomerDashboardScreen.js',
  'src/screens/customer/ScanScreen.js',
  'src/screens/customer/HistoryScreen.js',
  'src/screens/customer/ExternalProductScreen.js',
  'src/screens/customer/ProductIntelligenceScreen.js',
  'src/screens/customer/TrustMapScreen.js',
  'src/screens/manufacturer/ManufacturerDashboardScreen.js',
  'src/screens/manufacturer/AddProductScreen.js',
  'src/screens/admin/AdminDashboardScreen.js',
  'src/screens/admin/UserManagementScreen.js',
  'src/screens/admin/ProductManagementScreen.js',
  'src/screens/admin/GS1ReviewScreen.js',
  'src/services/authService.js',
  'src/services/productService.js',
  'src/services/qualityComparisonService.js',
  'src/services/reportService.js',
  'src/services/reportExportService.js',
  'src/services/externalApiService.js',
  'src/services/gs1Service.js',
  'src/services/adminCrudService.js',
  'src/config/firebase.js',
  'src/config/api.js',
  'src/utils/validation.js',
  'src/utils/trustMapAnalytics.js',
  'docs/deployment/DEPLOYMENT-CHECKLIST.md',
  'docs/setup/GOOGLE-SIGN-IN.md',
];

let failed = false;

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
}

for (const file of ['package.json', 'app.json', 'firebase.json', 'firebase/firestore.indexes.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    console.log(`OK JSON: ${file}`);
  } catch (error) {
    console.error(`INVALID JSON: ${file} - ${error.message}`);
    failed = true;
  }
}

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('App.js');
const rootNavigator = read('src/navigation/RootNavigator.js');
const roleNavigator = read('src/navigation/RoleNavigator.js');
const auth = read('src/screens/auth/AuthScreen.js');
const history = read('src/screens/customer/HistoryScreen.js');
const externalProduct = read('src/screens/customer/ExternalProductScreen.js');
const addProduct = read('src/screens/manufacturer/AddProductScreen.js');
const adminDashboard = read('src/screens/admin/AdminDashboardScreen.js');
const adminProducts = read('src/screens/admin/ProductManagementScreen.js');
const adminUsers = read('src/screens/admin/UserManagementScreen.js');
const gs1Screen = read('src/screens/admin/GS1ReviewScreen.js');
const productService = read('src/services/productService.js');
const externalApi = read('src/services/externalApiService.js');
const gs1Service = read('src/services/gs1Service.js');
const adminCrud = read('src/services/adminCrudService.js');
const apiConfig = read('src/config/api.js');
const searchScreen = read('src/screens/customer/SearchScreen.js');
const savedScreen = read('src/screens/customer/SavedScreen.js');
const compareScreen = read('src/screens/customer/CompareScreen.js');
const settingsScreen = read('src/screens/account/SettingsScreen.js');
const aboutScreen = read('src/screens/account/AboutScreen.js');
const googleNativeButton = read('src/components/auth/GoogleSignInButton.native.js');
const googleWebButton = read('src/components/auth/GoogleSignInButton.web.js');
const reportExport = read('src/services/reportExportService.js');
const reportService = read('src/services/reportService.js');

if (!app.includes('RootNavigator')) {
  console.error('APP ENTRY ROUTER MISSING');
  failed = true;
}

for (const marker of ["role === 'customer'", "role === 'manufacturer'", "role === 'admin'"]) {
  if (!roleNavigator.includes(marker)) {
    console.error(`ROLE ROUTING MISSING: ${marker}`);
    failed = true;
  }
}

if (!rootNavigator.includes('LandingScreen') || !rootNavigator.includes('AuthScreen')) {
  console.error('SIGNED-OUT ROUTING MISSING');
  failed = true;
}

if (!auth.includes('PasswordChecklist') || !auth.includes('PasswordInput')) {
  console.error('AUTH VALIDATION UI MISSING');
  failed = true;
}

if (!roleNavigator.includes('openHistoryScan') || !history.includes('subscribeScanHistory')) {
  console.error('SCAN HISTORY FLOW MISSING');
  failed = true;
}


const productIntelligence = read('src/screens/customer/ProductIntelligenceScreen.js');
if (!productIntelligence.includes('Product Details') || !productIntelligence.includes('Find More Product Details')) {
  console.error('PRODUCT INTELLIGENCE SCREEN MISSING');
  failed = true;
}

if (!externalProduct.includes('Product identity verified') || !externalProduct.includes('Product information found')) {
  console.error('EXTERNAL PRODUCT RESULT UI MISSING');
  failed = true;
}

if (!addProduct.includes('Official packaging image URL')) {
  console.error('MANUFACTURER PACKAGING REFERENCE FIELD MISSING');
  failed = true;
}

for (const marker of ['Users & Roles', 'Create, edit, disable and remove accounts', 'Create, edit and delete products']) {
  if (!adminDashboard.includes(marker)) {
    console.error(`ADMIN DASHBOARD CRUD ENTRY MISSING: ${marker}`);
    failed = true;
  }
}

if (!adminProducts.includes('adminUpdateProduct') || !adminProducts.includes('adminDeleteProduct')) {
  console.error('ADMIN PRODUCT CRUD UI MISSING');
  failed = true;
}

if (!adminUsers.includes('adminCreateUser') || !adminUsers.includes('adminUpdateUser')) {
  console.error('ADMIN USER CRUD UI MISSING');
  failed = true;
}

if (!gs1Screen.includes('Barcode Ownership Checks') || !gs1Service.includes('gtinVerifications')) {
  console.error('GS1 REVIEW WORKFLOW MISSING');
  failed = true;
}

if (!apiConfig.includes('world.openfoodfacts.org') || !apiConfig.includes('api.upcitemdb.com/prod/trial')) {
  console.error('UNIVERSAL PRODUCT SOURCES MISSING');
  failed = true;
}

if (!apiConfig.includes('api.nal.usda.gov/fdc/v1') || !apiConfig.includes('api.ocr.space/parse/image')) {
  console.error('FOOD ENRICHMENT OR OCR CONFIG MISSING');
  failed = true;
}

for (const marker of ['deepenExternalProductIntelligence', 'lookupBarcodeExternally', 'fetchUpcItemDb', 'fetchUsdaByBarcode', 'classifyProductKind', 'STATIONERY_TERMS', 'ELECTRONICS_TERMS', 'extractProductLabelExternally', 'comparePackagingExternally']) {
  if (!externalApi.includes(marker)) {
    console.error(`EXTERNAL VERIFICATION ADAPTER MISSING: ${marker}`);
    failed = true;
  }
}

if (!productService.includes('recordScanLookup') || !productService.includes('externalSnapshot')) {
  console.error('SCAN STORAGE MISSING');
  failed = true;
}

for (const marker of ['adminCreateBatch', 'adminCreateRecall', 'adminCreateSerial', 'adminCreateUser', 'adminDeleteProduct', 'adminDeleteReport']) {
  if (!adminCrud.includes(marker)) {
    console.error(`ADMIN CRUD SERVICE MISSING: ${marker}`);
    failed = true;
  }
}


if (!searchScreen.includes('searchProductsExternally') || !searchScreen.includes('Name, brand, barcode, model or SKU')) {
  console.error('EXTERNAL TEXT SEARCH FLOW MISSING');
  failed = true;
}
if (!savedScreen.includes('openSavedProduct') || !productService.includes('productSnapshot')) {
  console.error('SAVED PRODUCT SNAPSHOT FLOW MISSING');
  failed = true;
}
if (!compareScreen.includes('getRecentScanProducts')) {
  console.error('SCAN-BASED COMPARISON FLOW MISSING');
  failed = true;
}
if (!compareScreen.includes('compareProductQuality') || !read('src/services/qualityComparisonService.js').includes('buildQualityProfile')) {
  console.error('QUALITY COMPARISON ENGINE MISSING');
  failed = true;
}
if (!settingsScreen.includes('resetPassword') || !settingsScreen.includes('Account details') || !settingsScreen.includes('Appearance')) {
  console.error('PERSISTENT SETTINGS OR PASSWORD RESET FLOW MISSING');
  failed = true;
}
if (!(googleWebButton.includes('loginWithGooglePopup') || googleWebButton.includes('useIdTokenAuthRequest')) || !googleNativeButton.includes('@react-native-google-signin/google-signin') || !googleNativeButton.includes('GoogleSignin.signIn') || !auth.includes('GoogleSignInButton')) {
  console.error('GOOGLE SIGN-IN WIRING MISSING');
  failed = true;
}
if (googleNativeButton.includes('expo-auth-session') || googleNativeButton.includes('promptAsync')) {
  console.error('NATIVE GOOGLE SIGN-IN MUST NOT USE BROWSER AUTHSESSION');
  failed = true;
}
if (!reportExport.includes('expo-print') || !reportExport.includes('exportReportsPdf')) {
  console.error('PDF REPORT EXPORT MISSING');
  failed = true;
}
if (!aboutScreen.includes('About Product Trust')) {
  console.error('ABOUT SCREEN MISSING');
  failed = true;
}

const trustMapScreen = read('src/screens/customer/TrustMapScreen.js');
const trustMapAnalytics = read('src/utils/trustMapAnalytics.js');
if (!trustMapScreen.includes('useTrustMapData') || !trustMapScreen.includes('ClusterCarousel') || !trustMapScreen.includes('openInvestigation')) {
  console.error('SAFETY MAP UI MISSING (data hook, report cards or case link)');
  failed = true;
}
if (!read('src/screens/customer/TrustMapScreen.web.js').includes("sandbox: 'allow-scripts'")) {
  console.error('WEB MAP IFRAME MUST BE SANDBOXED (report text is untrusted)');
  failed = true;
}
if (!read('src/components/map/MapPanels.js').includes('Under review') || !read('src/hooks/useTrustMapData.js').includes('subscribePublicReports')) {
  console.error('SAFETY MAP PLAIN-LANGUAGE PANELS OR DATA MISSING');
  failed = true;
}
if (!trustMapAnalytics.includes('clusterTrustReports') || !trustMapAnalytics.includes('nearbyCount') || !trustMapAnalytics.includes('confirmedRate')) {
  console.error('TRUST INTELLIGENCE ANALYTICS MISSING');
  failed = true;
}


const customerDashboard = read('src/screens/customer/CustomerDashboardScreen.js');
const profileScreen = read('src/screens/account/ProfileScreen.js');
const restorableScroll = read('src/components/common/RestorableScrollView.js');
const themeProvider = read('src/theme/ThemeProvider.js');
const infoRow = read('src/components/common/InfoRow.js');
const compareRow = read('src/components/common/CompareRow.js');
const productDetailsScreen = read('src/screens/customer/ProductDetailsScreen.js');

if (customerDashboard.includes('Open Food Facts') || customerDashboard.includes('USDA FoodData Central')) {
  console.error('CUSTOMER SCAN HERO STILL CONTAINS TECHNICAL SOURCE COPY');
  failed = true;
}
if (!settingsScreen.includes('Appearance') || !themeProvider.includes('AsyncStorage') || !themeProvider.includes("['light', 'dark', 'system']")) {
  console.error('FUNCTIONAL APPEARANCE SETTINGS MISSING');
  failed = true;
}
if (!externalProduct.includes("['overview', 'Overview']") || !externalProduct.includes("['details', 'Details']") || !externalProduct.includes("['safety', 'Safety']") || !externalProduct.includes("['sources', 'Sources']")) {
  console.error('SHORTENED EXTERNAL PRODUCT TABS MISSING');
  failed = true;
}
if (!restorableScroll.includes('positions.set') || !restorableScroll.includes('scrollTo')) {
  console.error('SCROLL POSITION RESTORATION MISSING');
  failed = true;
}
if (!infoRow.includes('infoValueWrap') || !compareRow.includes('compareValueWrap')) {
  console.error('SHARED TEXT WRAP / OVERLAP PROTECTION MISSING');
  failed = true;
}
if (!productDetailsScreen.includes('RestorableScrollView')) {
  console.error('PRODUCT DETAILS SCROLL RESTORATION MISSING');
  failed = true;
}
if (profileScreen.includes('StatusPill') || profileScreen.includes('portalRolePill')) {
  console.error('PROFILE ROLE BADGE SHOULD NOT BE SHOWN');
  failed = true;
}

if (!reportService.includes("where('manufacturerId', '==', profile?.uid")) {
  console.error('MANUFACTURER MAP SERVER-SIDE FILTER MISSING');
  failed = true;
}

// Verify relative source imports resolve to a real source file/folder.
for (const file of fs.readdirSync(path.join(root, 'src'), { recursive: true })) {
  if (!String(file).endsWith('.js')) continue;
  const absolute = path.join(root, 'src', file);
  const source = fs.readFileSync(absolute, 'utf8');
  const importPattern = /(?:from\s+|require\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(source))) {
    const base = path.resolve(path.dirname(absolute), match[1]);
    const candidates = [base, `${base}.js`, `${base}.native.js`, `${base}.web.js`, `${base}.ios.js`, `${base}.android.js`, path.join(base, 'index.js'), `${base}.json`];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      console.error(`BROKEN RELATIVE IMPORT: ${file} -> ${match[1]}`);
      failed = true;
    }
  }
}

const projectText = [
  app,
  rootNavigator,
  roleNavigator,
  auth,
  history,
  externalProduct,
  addProduct,
  adminDashboard,
  adminProducts,
  adminUsers,
  gs1Screen,
  productService,
  externalApi,
  gs1Service,
  adminCrud,
  apiConfig,
].join('\n');

const forbidden = [
  /Nivea Body Lotion/i,
  /Samsung Fast Charger/i,
  /XYZ Cough Syrup/i,
  /1,254\s+products/i,
  /342\s+users/i,
  /GOOGLE_VISION_API_KEY/i,
  /EXPO_PUBLIC_PRODUCT_OCR_URL/i,
  /EXPO_PUBLIC_PACKAGING_COMPARE_URL/i,
];

for (const pattern of forbidden) {
  if (pattern.test(projectText)) {
    console.error(`FORBIDDEN CONTENT FOUND: ${pattern}`);
    failed = true;
  }
}

// ---- v20.4 guards -------------------------------------------------------
{
  const aboutText = read('src/screens/account/AboutScreen.js');
  if (/Version\s*\d/.test(aboutText)) { console.error('ABOUT SCREEN MUST NOT SHOW A VERSION NUMBER'); failed = true; }

  // Every network call must have a time limit (React Native fetch has none).
  const extApi = read('src/services/externalApiService.js');
  const bareFetch = extApi.split('\n').filter((line) => /(^|[^\w.])fetch\(/.test(line) && !line.trim().startsWith('//'));
  if (bareFetch.length) { console.error('EXTERNAL API HAS fetch() WITHOUT A TIMEOUT:\n  ' + bareFetch.join('\n  ')); failed = true; }
  if (!extApi.includes('withDeadline') || !extApi.includes('Promise.allSettled')) { console.error('DEEP SEARCH MUST BE TIME-BOXED AND PARALLEL'); failed = true; }

  // Buttons must carry vertical spacing so stacked buttons never touch.
  const styleText = read('src/theme/styles.js');
  for (const name of ['primaryButton', 'secondaryButton']) {
    const line = styleText.split('\n').find((l) => l.trim().startsWith(`${name}:`)) || '';
    if (!/marginVertical|marginBottom/.test(line)) { console.error(`${name} STYLE HAS NO SPACING`); failed = true; }
  }

  // Photos must not depend on Firebase Storage (not available on the Spark plan).
  const reportSvc = read('src/services/reportService.js');
  if (!reportSvc.includes('prepareImages') || !reportSvc.includes("'evidence'")) { console.error('REPORT PHOTO STORAGE (Firestore) MISSING'); failed = true; }
  if (reportSvc.includes('uploadMultipleImages')) { console.error('REPORTS MUST NOT CALL FIREBASE STORAGE DIRECTLY'); failed = true; }

  // Rules for photos and manufacturer replies, and cleanup on account deletion.
  const rulesText = read('firebase/firestore.rules');
  if (!rulesText.includes('match /evidence/{evidenceId}') || !rulesText.includes('manufacturerRespondingOnly')) { console.error('FIRESTORE RULES MISSING PHOTO OR MANUFACTURER-RESPONSE RULES'); failed = true; }
  if (!read('firebase/functions/index.js').includes("collection('evidence')")) { console.error('ACCOUNT DELETION DOES NOT REMOVE REPORT PHOTOS'); failed = true; }
  if (!read('package.json').includes('expo-image-manipulator')) { console.error('expo-image-manipulator DEPENDENCY MISSING'); failed = true; }

  // Customer -> admin -> manufacturer loop.
  if (!reportSvc.includes('saveAdminNote') || !reportSvc.includes('saveManufacturerResponse')) { console.error('CASE MESSAGING MISSING'); failed = true; }
  if (!read('src/navigation/RoleNavigator.js').includes('<TrustMapScreen go={go} profile={{ ...profile, role }} openInvestigation={openInvestigation} />')) { console.error('MAP IS NOT LINKED TO CASES'); failed = true; }
}

// ---- v20.5 guards -------------------------------------------------------
{
  // Scanner: web pages may only describe a product if they prove they match it.
  const ext = read('src/services/externalApiService.js');
  if (!ext.includes('acceptWebEvidence') || !ext.includes('mentionedBarcode')) { console.error('SCANNER RELEVANCE CHECK MISSING (a search result must prove it is about the scanned product)'); failed = true; }
  // Every web-search call must carry a relevance context (checked over the whole call, which may span lines).
  const callPattern = /fetchSerpWebResearch\(([\s\S]*?)\);/g;
  let callMatch;
  const unguarded = [];
  while ((callMatch = callPattern.exec(ext))) {
    const head = ext.slice(Math.max(0, callMatch.index - 40), callMatch.index);
    if (/async function\s*$/.test(head)) continue;
    if (!/(context|labelContext|identity|barcodes)/.test(callMatch[1])) unguarded.push(callMatch[0].replace(/\s+/g, ' ').slice(0, 110));
  }
  if (unguarded.length) { console.error('WEB SEARCH CALLED WITHOUT A RELEVANCE CONTEXT:\n  ' + unguarded.join('\n  ')); failed = true; }

  // Staying signed in, and email verification for customers.
  {
    const hook = read('src/hooks/useAuthSession.js');
    if (!hook.includes('FEATURES.startSignedOut') || !/launchHandled/.test(hook) || !/await logout\(\)/.test(hook)) { console.error('THE APP MUST START SIGNED OUT WHEN IT OPENS (once per launch, controlled by FEATURES.startSignedOut)'); failed = true; }
    if (!/startSignedOut: !off\(process\.env\.EXPO_PUBLIC_START_SIGNED_OUT\)/.test(read('src/config/features.js'))) { console.error('startSignedOut MUST BE ON BY DEFAULT'); failed = true; }
  }
  if (!read('src/navigation/RootNavigator.js').includes('VerifyEmailScreen')) { console.error('CUSTOMER EMAIL VERIFICATION GATE MISSING'); failed = true; }

  // Things that must not be on screen.
  if (read('src/navigation/RoleNavigator.js').includes('systemReadiness')) { console.error('SYSTEM READINESS MUST BE REMOVED'); failed = true; }
  if (fs.existsSync(path.join(root, 'src/screens/admin/SystemReadinessScreen.js'))) { console.error('SystemReadinessScreen.js STILL EXISTS'); failed = true; }
  const profileText = read('src/screens/account/ProfileScreen.js');
  if (/title="(Dashboard|Users|Product Cases)"/.test(profileText)) { console.error('PROFILE MUST NOT REPEAT DASHBOARD / USERS / PRODUCT CASES'); failed = true; }
  const aboutText2 = read('src/screens/account/AboutScreen.js');
  if (/Administrators|Manufacturers|Customers"/.test(aboutText2) && /label="(Customers|Manufacturers|Administrators)"/.test(aboutText2)) { console.error('ABOUT MUST NOT DESCRIBE WHAT EACH ROLE DOES'); failed = true; }

  // Navigation bar on every admin and manufacturer sub-screen.
  for (const file of [
    'admin/InvestigationsScreen', 'admin/InvestigationDetailScreen', 'admin/ReportManagementScreen', 'admin/BatchManagementScreen', 'admin/RecallManagementScreen', 'admin/SerialManagementScreen',
    'manufacturer/AddProductScreen', 'manufacturer/BatchManagementScreen', 'manufacturer/CreateRecallScreen', 'manufacturer/SerialManagementScreen', 'account/SettingsScreen', 'account/AboutScreen',
  ]) {
    if (!read(`src/screens/${file}.js`).includes('<PortalNav')) { console.error(`NAVIGATION BAR MISSING ON ${file}`); failed = true; }
  }

  // Appearance belongs to the signed-in person.
  const themeText = read('src/theme/ThemeProvider.js');
  if (!themeText.includes('STORAGE_PREFIX') || !themeText.includes('onAuthStateChanged')) { console.error('APPEARANCE MUST BE SAVED PER ACCOUNT'); failed = true; }

  // Documents open inside the app; company logos.
  if (!read('src/navigation/RoleNavigator.js').includes('DocumentPreviewScreen')) { console.error('IN-APP DOCUMENT VIEWER NOT WIRED'); failed = true; }
  if (!read('package.json').includes('react-native-webview')) { console.error('react-native-webview DEPENDENCY MISSING'); failed = true; }
  if (!read('firebase/firestore.rules').includes('match /manufacturerBrands/{brandId}')) { console.error('MANUFACTURER LOGO RULES MISSING'); failed = true; }
  if (!read('src/screens/account/SettingsScreen.js').includes('CompanyLogoEditor')) { console.error('MANUFACTURER LOGO UPLOAD MISSING'); failed = true; }
}

// ---- v20.6 guards: sign-in code (OTP) --------------------------------------
{
  const features = read('src/config/features.js');
  if (!features.includes('requireLoginCode') || !read('src/navigation/RootNavigator.js').includes('shouldRequireLoginCode')) { console.error('LOGIN CODE SWITCH MISSING FROM SIGN-IN FLOW'); failed = true; }
  const envExample = read('.env.example');
  if (!/EXPO_PUBLIC_REQUIRE_LOGIN_CODE=false/.test(envExample) || !/EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false/.test(envExample)) { console.error('SIGN-IN SECURITY SWITCHES MUST DEFAULT TO OFF IN .env.example'); failed = true; }
  const fnText = read('firebase/functions/index.js');
  if (!fnText.includes('exports.sendLoginCode') || !fnText.includes('exports.verifyLoginCode')) { console.error('LOGIN CODE FUNCTIONS MISSING'); failed = true; }
  if (/codeHash:\s*code\b/.test(fnText) || /set\(\{[^}]*\bcode\b\s*[:,]/.test(fnText.split('exports.sendLoginCode')[1] || '')) { console.error('LOGIN CODE MUST BE STORED HASHED, NEVER IN PLAIN TEXT'); failed = true; }
  if (!read('firebase/firestore.rules').includes('match /loginCodes/{uid}')) { console.error('LOGIN CODE RECORDS MUST BE LOCKED IN firestore.rules'); failed = true; }
  if (!fs.existsSync(path.join(root, 'docs/setup/LOGIN-CODE.md'))) { console.error('LOGIN CODE SETUP GUIDE MISSING'); failed = true; }
}

// ---- v20.7 guards: screens must not reopen on stale tabs/sections ------------
{
  // A module-level "last tab" variable survives sign-out and leaving the screen, so the next visit opens in the wrong place.
  for (const file of fs.readdirSync(path.join(root, 'src/screens'), { recursive: true })) {
    if (!String(file).endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(root, 'src/screens', file), 'utf8');
    if (/^let last[A-Z]\w*\s*=/m.test(text)) { console.error(`STALE SCREEN MEMORY (module-level "let last...") in ${file}: use utils/screenMemory with arrivedByBack`); failed = true; }
  }
  const settingsText = read('src/screens/account/SettingsScreen.js');
  if (!settingsText.includes('startingScreenState') || !settingsText.includes('arrivedByBack')) { console.error('SETTINGS MUST OPEN ON ITS MENU UNLESS RETURNING WITH BACK'); failed = true; }
  if (!read('src/navigation/RoleNavigator.js').includes('setArrivedByBack(true)')) { console.error('NAVIGATOR MUST TELL SCREENS WHEN THE PERSON PRESSED BACK'); failed = true; }
}

// ---- v20.8 guards: free sign-in code service, location privacy, account deletion, store readiness ----
{
  // Cloudflare Worker (free sign-in code service)
  for (const f of ['workers/login-code/src/index.js', 'workers/login-code/schema.sql', 'workers/login-code/wrangler.toml']) {
    if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; }
  }
  const worker = read('workers/login-code/src/index.js');
  if (!worker.includes("header.alg !== 'RS256'") || !worker.includes('securetoken.google.com') || !worker.includes('crypto.subtle.verify')) { console.error('WORKER MUST VERIFY THE FIREBASE LOGIN TOKEN (RS256, issuer, signature)'); failed = true; }
  if (!read('workers/login-code/schema.sql').includes('code_hash') || /\bcode\s+TEXT/i.test(read('workers/login-code/schema.sql'))) { console.error('WORKER MUST STORE ONLY A HASH OF EACH CODE'); failed = true; }
  if (!read('src/services/loginCodeService.js').includes('EXPO_PUBLIC_LOGIN_CODE_URL')) { console.error('APP IS NOT WIRED TO THE FREE CODE SERVICE'); failed = true; }
  if (!/EXPO_PUBLIC_LOGIN_CODE_URL=\s*$/m.test(read('.env.example'))) { console.error('EXPO_PUBLIC_LOGIN_CODE_URL MUST BE EMPTY IN .env.example'); failed = true; }
  if (!read('src/config/features.js').includes('shouldRequireLoginCode')) { console.error('LOGIN CODE EXEMPTION LOGIC MISSING'); failed = true; }

  // Exact location must never be written onto the manufacturer-readable report
  const reportSvc2 = read('src/services/reportService.js');
  if (/latitude:\s*location\??\.latitude\s*\?\?\s*null/.test(reportSvc2) || !reportSvc2.includes("'private', 'location'")) { console.error('EXACT LOCATION MUST BE STORED ONLY IN reports/<id>/private/location'); failed = true; }
  if (!read('firebase/firestore.rules').includes('match /private/{recordId}')) { console.error('RULES FOR THE PRIVATE LOCATION RECORD MISSING'); failed = true; }

  // Account deletion must work without a paid server function
  const acct = read('src/services/accountService.js');
  if (!acct.includes('deleteAccountInApp') || !acct.includes('reauthenticateWithCredential') || !acct.includes('requires-recent-login')) { console.error('IN-APP ACCOUNT DELETION MISSING'); failed = true; }
  if (!acct.includes("role === 'manufacturer'") || !acct.includes("'batches', 'serials', 'recalls'") || !acct.includes('manufacturerBrands') || !acct.includes('manufacturerDeleted')) { console.error('MANUFACTURER ACCOUNT DELETION MISSING (products, batches, serials, recalls, brand card, report detach)'); failed = true; }
  if (!read('firebase/firestore.rules').includes('(isCustomer() || isManufacturer())')) { console.error('RULES MUST LET A MANUFACTURER DELETE ITS OWN ACCOUNT RECORD'); failed = true; }
  if (!/administrator/i.test(acct) || /role === 'admin'[^\n]*deleteDocs/.test(acct)) { console.error('ADMIN ACCOUNTS MUST NOT SELF-DELETE (last-admin protection)'); failed = true; }
  for (const f of ['docs/deployment/LAUNCH-GUIDE.md', 'docs/testing/SCANNER-TEST-SHEET.md']) { if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; } }
  if (!read('src/screens/account/SettingsScreen.js').includes('Confirm your password')) { console.error('DELETE ACCOUNT MUST ASK FOR THE PASSWORD'); failed = true; }

  // Store readiness
  const appJson = JSON.parse(read('app.json')).expo;
  if (!appJson.icon || !fs.existsSync(path.join(root, appJson.icon))) { console.error('APP ICON MISSING'); failed = true; }
  const cam = (appJson.plugins || []).find((p) => Array.isArray(p) && p[0] === 'expo-camera');
  if (!cam || cam[1].recordAudioAndroid !== false || cam[1].microphonePermission !== false) { console.error('CAMERA PLUGIN MUST NOT REQUEST THE MICROPHONE'); failed = true; }
  for (const f of ['legal/privacy.html', 'legal/delete-account.html', 'docs/deployment/PUBLISHING-CHECKLIST.md', 'store/STORE-LISTING.md']) {
    if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; }
  }
  if (fs.existsSync(path.join(root, 'public/index.html'))) { console.error('public/index.html BREAKS THE WEB BUILD (Expo uses it as the page template). Keep static pages in legal/.'); failed = true; }
  { const hosting = JSON.parse(read('firebase.json')).hosting || {}; const pkg = JSON.parse(read('package.json')).scripts || {}; const web = (JSON.parse(read('app.json')).expo || {}).web || {};
    if (hosting.public !== 'dist' || !pkg['deploy:web'] || web.output !== 'single' || !fs.existsSync(path.join(root, 'scripts/prepare-web-deploy.mjs'))) { console.error('WEB DEPLOY NOT CONFIGURED (firebase hosting must serve dist, app.json web.output must be single, npm run deploy:web must exist)'); failed = true; } }
  for (const f of ['web-static/manifest.webmanifest', 'web-static/sw.js', 'web-static/icon-192.png', 'web-static/icon-512.png', 'web-static/icon-maskable-512.png', 'src/components/scan/ManualBarcodeEntry.js', 'src/utils/typedBarcode.js']) {
    if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; }
  }
  if (!read('scripts/prepare-web-deploy.mjs').includes('serviceWorker') || !JSON.stringify(JSON.parse(read('firebase.json')).hosting.headers || []).includes('/sw.js')) { console.error('INSTALL-AS-APP SUPPORT (manifest, service worker, headers) NOT WIRED INTO THE WEB DEPLOY'); failed = true; }
  if (!read('src/screens/customer/ScanScreen.js').includes('ManualBarcodeEntry')) { console.error('SCAN SCREEN MUST OFFER TYPING THE BARCODE (camera fallback)'); failed = true; }
  if (!JSON.parse(read('firebase.json')).hosting) { console.error('FIREBASE HOSTING NOT CONFIGURED FOR THE PRIVACY PAGES'); failed = true; }
}

// ---- v20.11 guards: speed and report reliability -------------------------------
{
  const ext = read('src/services/externalApiService.js');
  const look = ext.slice(ext.indexOf('export async function lookupBarcodeExternally'), ext.indexOf('export function createUnidentifiedExternalProduct'));
  if (!look.includes('budgetMs') || !look.includes('withDeadline') || !look.includes('Promise.allSettled')) { console.error('BARCODE LOOKUP MUST RUN DATABASES IN PARALLEL UNDER A TIME LIMIT'); failed = true; }
  if (/await enrichFromReferenceLabelImages\(product\);/.test(look) || !look.includes('withLabelOcr')) { console.error('LABEL OCR MUST NOT RUN IN A NORMAL SCAN (it is opt-in via withLabelOcr)'); failed = true; }
  if (!/lookupBarcodeExternally\(normalizedBarcode, \{[^}]*quick: true/.test(read('src/navigation/RoleNavigator.js'))) { console.error('REGISTERED-PRODUCT SCAN MUST USE THE QUICK LOOKUP'); failed = true; }
  if (!read('src/config/firebase.js').includes('experimentalForceLongPolling')) { console.error('FIRESTORE MUST USE LONG POLLING ON PHONES (default streaming hangs on mobile networks)'); failed = true; }
  const rep = read('src/services/reportService.js');
  if (!rep.includes('newReportId') || !rep.includes('app/timeout') || !rep.includes('photo-${index + 1}')) { console.error('REPORT SENDING MUST USE A FIXED ID, FIXED PHOTO IDS AND A TIME LIMIT (safe to retry)'); failed = true; }
  if (!read('src/screens/customer/ReportScreen.js').includes('reportIdRef')) { console.error('REPORT FORM MUST KEEP ONE ID ACROSS ATTEMPTS'); failed = true; }
  if (!read('src/navigation/RoleNavigator.js').includes('canSendReports(role)')) { console.error('ONLY CUSTOMER ACCOUNTS MAY OPEN THE REPORT FORM'); failed = true; }
}

// ---- v20.12 guards: one navigation bar, reports are customer-only, the map always fits -----------
{
  // Reports: the form can only be opened from inside the customer part of the navigator.
  const nav = read('src/navigation/RoleNavigator.js');
  const custStart = nav.indexOf("if (role === 'customer') {");
  const mfrStart = nav.indexOf("if (role === 'manufacturer') {");
  const tail = nav.slice(mfrStart);
  const custBlock = nav.slice(custStart, mfrStart);
  if (!custBlock.includes('<ReportScreen') || /<ReportScreen/.test(tail) || /screen === 'report'/.test(tail)) { console.error('THE REPORT FORM MUST EXIST ONLY IN THE CUSTOMER PART OF THE NAVIGATOR (manufacturers and admins must never reach it)'); failed = true; }
  if ((nav.match(/<ReportScreen/g) || []).length !== 1) { console.error('THERE MUST BE EXACTLY ONE REPORT FORM ROUTE'); failed = true; }

  // Navigation bar: one implementation, same place on every screen.
  const files = fs.readdirSync(path.join(root, 'src/screens'), { recursive: true }).filter((f) => String(f).endsWith('.js'));
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, 'src/screens', file), 'utf8');
    if (/import \{[^}]*\bBottomNav\b[^}]*\} from/.test(text)) { console.error(`OLD BottomNav USED IN ${file}: use PortalNav (one bar for the whole app)`); failed = true; }
    for (const m of text.matchAll(/<PortalNav\b[^>]*\/>/g)) {
      if (!/^\s*<\/Screen>/.test(text.slice(m.index + m[0].length))) { console.error(`NAVIGATION BAR IS NOT THE LAST CHILD OF <Screen> IN ${file} (it would sit in a different place)`); failed = true; }
    }
  }
  const bar = read('src/components/navigation/PortalNav.js');
  if (!bar.includes('keyboardDidShow') || !bar.includes("screen === 'home'")) { console.error('NAVIGATION BAR MUST HIDE WHILE THE KEYBOARD IS OPEN AND TREAT "home" AS THE HOME ITEM'); failed = true; }
  if (!read('src/components/navigation/BottomNav.js').includes('PortalNav') || read('src/components/navigation/BottomNav.js').includes('styles.bottomNav')) { console.error('BottomNav MUST BE ONLY A WRAPPER AROUND PortalNav'); failed = true; }

  // The map must adapt to the phone so the bar is never pushed off the bottom.
  for (const f of ['src/screens/customer/TrustMapScreen.js', 'src/screens/customer/TrustMapScreen.web.js']) {
    if (!read(f).includes('mapLayoutMode(height)') || !read(f).includes('mapMinHeight')) { console.error(`${f} MUST SIZE THE MAP FROM THE SCREEN HEIGHT (mapLayoutMode)`); failed = true; }
  }
}

// ---- v20.13 guards: recall checking must be honest -----------------------------------------------
{
  for (const f of ['workers/recall-lookup/wrangler.toml', 'workers/recall-lookup/src/index.js', 'workers/recall-lookup/src/sources.js', 'workers/recall-lookup/src/match.js', 'src/components/product/RecallNotice.js', 'docs/setup/RECALL.md']) {
    if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; }
  }
  const src = read('workers/recall-lookup/src/sources.js');
  if (!src.includes('answer too large') || !src.includes('not filtered')) { console.error('RECALL SERVICE MUST REFUSE OVERSIZED AND UNFILTERED ANSWERS (free plan CPU limit)'); failed = true; }
  const idx = read('workers/recall-lookup/src/index.js');
  if (!idx.includes('sourcesFailed') || !idx.includes('could not be reached') || !/if \(checked\b/.test(idx)) { console.error('RECALL SERVICE MUST REPORT FAILED SOURCES AND NEVER CACHE OR CLAIM "NO RECALL" WHEN NOTHING WAS CHECKED'); failed = true; }
  const ext = read('src/services/externalApiService.js');
  if (!ext.includes("payload?.checked !== false") || !ext.includes('export async function checkProductRecalls')) { console.error('THE APP MUST TREAT "checked:false" AS "COULD NOT CHECK", NOT AS "NO RECALL"'); failed = true; }
  for (const f of ['src/screens/customer/ProductScreen.js', 'src/screens/customer/ExternalProductScreen.js', 'src/screens/customer/ProductIntelligenceScreen.js']) {
    if (!read(f).includes('<RecallNotice')) { console.error(`${f} MUST SHOW THE RECALL CARD`); failed = true; }
  }
  if (read('src/screens/customer/ProductIntelligenceScreen.js').includes('JSON.stringify(item)')) { console.error('RECALLS MUST NOT BE SHOWN AS RAW JSON TEXT'); failed = true; }
  if (!read('src/components/product/RecallNotice.js').includes('https?')) { console.error('RECALL LINKS MUST ONLY OPEN http(s) ADDRESSES'); failed = true; }
}

// ---- v20.14 guards: behave like a real app ---------------------------------------------------------
{
  if (!read('App.js').includes('<ErrorBoundary>')) { console.error('THE APP MUST BE WRAPPED IN THE CRASH-PROTECTION SCREEN (ErrorBoundary) IN App.js'); failed = true; }
  if (!read('src/navigation/RoleNavigator.js').includes("'hardwareBackPress'") || !read('src/navigation/RootNavigator.js').includes("'hardwareBackPress'")) { console.error('ANDROID BACK BUTTON MUST BE HANDLED IN BOTH NAVIGATORS'); failed = true; }
  // Every scrolling list must let a button respond on the first tap while the keyboard is open.
  for (const file of fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter((f) => String(f).endsWith('.js'))) {
    const text = fs.readFileSync(path.join(root, 'src', file), 'utf8');
    for (const m of text.matchAll(/<(ScrollView|FlatList|SectionList)\b([^>]*)>/g)) {
      if (!m[2].includes('keyboardShouldPersistTaps') && !m[2].includes('{...')) { console.error(`${file}: <${m[1]}> MUST HAVE keyboardShouldPersistTaps="handled" (otherwise the first tap with the keyboard open is lost)`); failed = true; }
    }
    // A save button must never crash because a stored record lacks a field: no form.x.trim() / data.x.trim() / patch.x.trim() without a fallback.
    if (/(?<![\w.$(])(?:form\??|data|patch)\.[A-Za-z_]\w*\.trim\(\)/.test(text) && !/^components\/.*Input/.test(String(file))) { console.error(`${file}: UNSAFE .trim() ON A POSSIBLY MISSING FIELD. Use String(x ?? '').trim()`); failed = true; }
  }
  // Google sign-in must work in Expo Go: through the hosted page, never a dead-end pop-up.
  for (const f of ['web-static/google-auth.html', 'web-static/google-auth.js', 'src/services/googleBridge.js', 'docs/setup/GOOGLE-SIGN-IN.md']) {
    if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING ${f}`); failed = true; }
  }
  const gbtn = read('src/components/auth/GoogleSignInButton.native.js');
  if (!gbtn.includes('openAuthSessionAsync') || /unavailable in Expo Go/.test(gbtn)) { console.error('THE GOOGLE BUTTON MUST USE THE HOSTED SIGN-IN PAGE IN EXPO GO (not show an "unavailable" message)'); failed = true; }
  if (!read('web-static/google-auth.js').includes('validateReturnUrl') || !read('scripts/prepare-web-deploy.mjs').includes('google-auth-config.js')) { console.error('THE HOSTED GOOGLE PAGE MUST VALIDATE WHERE IT SENDS THE RESULT, AND THE DEPLOY STEP MUST WRITE ITS FIREBASE SETTINGS'); failed = true; }
}

// ---- v20.16 guards: no dead ends on the way in ------------------------------------------------------
{
  const code = read('src/screens/auth/LoginCodeScreen.js');
  if (!code.includes('<TopBar') || !code.includes('onBack={leave}') || !code.includes('<KeyboardAvoidingView') || !code.includes('keyboardShouldPersistTaps="handled"')) { console.error('THE SIGN-IN CODE SCREEN NEEDS A BACK ARROW AND A KEYBOARD-AWARE SCROLLING LAYOUT (the number keyboard otherwise covers the buttons)'); failed = true; }
  if (!code.includes('Keyboard.dismiss')) { console.error('THE CODE SCREEN MUST CLOSE THE KEYBOARD WHEN IT IS LEFT'); failed = true; }
  if (!read('src/navigation/RootNavigator.js').includes('rootBackAction(')) { console.error('THE ANDROID BACK BUTTON MUST LEAVE THE CODE STEP (rootBackAction)'); failed = true; }
  if (!read('src/screens/customer/AllergyProfileSetupScreen.js').includes('leaveSetup')) { console.error('FIRST-TIME SETUP MUST OFFER A WAY OUT (leaveSetup)'); failed = true; }
  const auth = read('src/screens/auth/AuthScreen.js');
  if (/textContentType|autoComplete=/.test(auth)) { console.error('SIGN-IN BOXES MUST NOT SET textContentType / autoComplete (they interfere with the iPhone keyboard)'); failed = true; }
}

// ---- v20.16.1: text the owner asked to remove ---------------------------------------------------------
if (/Admin access is controlled separately/.test(read('src/screens/onboarding/LandingScreen.js'))) { console.error('THE WELCOME SCREEN MUST NOT SHOW "Customer and Manufacturer registration • Admin access is controlled separately" (removed on request)'); failed = true; }

// ---- v20.17 guards: the website / iPhone-icon barcode scanner ----------------------------------------
{
  const scan = read('src/screens/customer/ScanScreen.js');
  if (!scan.includes('<ScanCamera') || /<CameraView/.test(scan)) { console.error('THE SCAN SCREEN MUST USE <ScanCamera> (so the website gets its own barcode reader on iPhone Safari)'); failed = true; }
  const web = read('src/components/scan/ScanCamera.web.js');
  if (!web.includes("barcode-detector/ponyfill") || !web.includes('/zxing_reader.wasm') || !web.includes('getUserMedia') || !web.includes('.stop()')) { console.error('THE WEBSITE SCANNER MUST BUNDLE ITS OWN READER, LOAD ITS ENGINE FROM THE SITE, AND RELEASE THE CAMERA'); failed = true; }
  if (!read('scripts/prepare-web-deploy.mjs').includes('zxing_reader.wasm')) { console.error('THE DEPLOY STEP MUST PUBLISH zxing_reader.wasm NEXT TO THE SITE'); failed = true; }
  if (!JSON.parse(read('package.json')).dependencies['barcode-detector']) { console.error('package.json MUST LIST barcode-detector (the website barcode reader)'); failed = true; }
  if (!read('src/components/scan/ScanCamera.js').includes('CameraView')) { console.error('THE PHONE-APP SCANNER (ScanCamera.js) MUST STILL USE THE NATIVE CameraView'); failed = true; }
}

// ---- v20.18 guards: the published website must be complete, and behave like an app on iPhone ---------------
{
  const hosting = JSON.parse(read('firebase.json')).hosting || {};
  if ((hosting.ignore || []).some((p) => /node_modules/.test(p))) { console.error('firebase.json MUST NOT IGNORE node_modules: the website\'s icon fonts live in assets/node_modules/ and would never be uploaded (every icon becomes an empty square)'); failed = true; }
  const prep = read('scripts/prepare-web-deploy.mjs');
  if (!prep.includes('isIgnored') || !prep.includes('maximum-scale=1') || !prep.includes('viewport-fit=cover') || !prep.includes('Ionicons')) { console.error('THE DEPLOY STEP MUST CHECK THE UPLOAD LIST, LOCK THE PAGE ZOOM AND CHECK THE ICON FONT'); failed = true; }
  if (/#0D5C1A/i.test(read('web-static/manifest.webmanifest')) || /#0D5C1A/i.test(prep)) { console.error('THE INSTALLED APP MUST USE THE DARK THEME COLOUR, NOT BRIGHT GREEN (it made a green bar at the top of the iPhone)'); failed = true; }
  if (!fs.existsSync(path.join(root, 'scripts/lib/ignore.mjs'))) { console.error('MISSING scripts/lib/ignore.mjs'); failed = true; }
}

// ---- v20.19 guards: the Android build must produce an installable app that has your settings --------------
{
  const eas = JSON.parse(read('eas.json'));
  if (!eas.build || !eas.build.preview || !eas.build.preview.android || eas.build.preview.android.buildType !== 'apk') { console.error('eas.json: THE "preview" PROFILE MUST BUILD AN APK (otherwise Android makes a store bundle you cannot install directly)'); failed = true; }
  if (!eas.cli || eas.cli.appVersionSource !== 'local') { console.error('eas.json: cli.appVersionSource MUST BE "local" (version numbers come from app.config.js)'); failed = true; }
  if (!fs.existsSync(path.join(root, '.easignore'))) { console.error('MISSING .easignore (without it the cloud build skips .env, because .gitignore lists it)'); failed = true; }
  else {
    const lines = read('.easignore').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.some((l) => /^\/?\.env/.test(l))) { console.error('.easignore MUST NOT LIST .env (the Android build needs your EXPO_PUBLIC_ settings)'); failed = true; }
    if (!lines.includes('node_modules/')) { console.error('.easignore MUST EXCLUDE node_modules/ (the upload would be hundreds of MB)'); failed = true; }
  }
  if (!JSON.parse(read('package.json')).scripts['build:android']) { console.error('package.json MUST HAVE THE build:android SCRIPT'); failed = true; }
}

// ---- v20.19.1 guard: the South African recall search must ask SHORT questions ---------------------------
{
  const src = read('workers/recall-lookup/src/sources.js');
  const ncc = src.slice(src.indexOf('export function nccQueries'));
  if (!ncc.includes('export function nccQueries') || !ncc.includes('queries.map') || /\.slice\(0, 3\)/.test(ncc)) { console.error('THE NCC SEARCH MUST USE SHORT QUESTIONS (nccQueries): WordPress needs every word, so a long question misses real recalls'); failed = true; }
  if (!/const CACHE_VERSION = 'v\d+'/.test(read('workers/recall-lookup/src/index.js')) || !read('workers/recall-lookup/src/index.js').includes('${env.CACHE_VERSION || CACHE_VERSION}')) { console.error('THE RECALL SERVICE MUST KEEP A CACHE VERSION (bump it whenever the matching rules change, or old answers are served for hours)'); failed = true; }
  if (!read('workers/recall-lookup/src/index.js').includes("'debug'")) { console.error('THE RECALL SERVICE MUST OFFER ?debug=1 (how a missed recall is diagnosed)'); failed = true; }
}

// ---- v20.20 guards: an old name-only recall must not look like a fresh alarm ---------------------------------
{
  if (!read('src/components/product/RecallNotice.js').includes('Older recall notice found') || !read('workers/recall-lookup/src/index.js').includes('OLD_AFTER_MS')) { console.error('OLD NAME-ONLY RECALL NOTICES MUST BE FLAGGED (service) AND SHOWN AS A SOFTER "Older recall notice" (card)'); failed = true; }
  if (!read('workers/recall-lookup/src/sources.js').includes('usefulReason')) { console.error('THE NCC\'S CONTACT-PAGE BOILERPLATE MUST NOT BE SHOWN AS THE REASON (usefulReason)'); failed = true; }
}

// ---- v20.21 guards: an installed Android app must start, show why if it cannot, and never use the key-less Google map ---------
{
  const pkg = JSON.parse(read('package.json'));
  const entry = read('index.js');
  if (pkg.main !== 'index.js' || !/try\s*\{[^}]*require\('\.\/App'\)/.test(entry) || !entry.includes('registerRootComponent') || !entry.includes('installFatalErrorScreen')) { console.error('THE APP MUST START THROUGH index.js, LOADING ./App INSIDE A TRY, SO A START-UP FAILURE SHOWS ITS REASON INSTEAD OF SILENTLY CLOSING'); failed = true; }
  const android = read('src/components/map/UniversalMap.android.js');
  if (/react-native-maps/.test(android.replace(/\/\/[^\n]*/g, ''))) { console.error('THE ANDROID MAP (UniversalMap.android.js) MUST NOT USE react-native-maps: the Google map crashes an installed Android app built without a Google Maps key'); failed = true; }
  const rnConfig = read('react-native.config.js');
  if (!/'react-native-maps'/.test(rnConfig) || !/android:\s*null/.test(rnConfig)) { console.error('react-native.config.js MUST LEAVE react-native-maps OUT OF THE ANDROID APP (platforms: { android: null })'); failed = true; }
  if (!fs.existsSync(path.join(root, 'src/components/map/leafletAssets.js')) || !read('src/components/map/leafletPage.js').includes('LEAFLET_JS')) { console.error('THE ANDROID MAP MUST CARRY ITS OWN MAP ENGINE (leafletAssets.js), NOT LOAD IT FROM THE INTERNET'); failed = true; }
  if (/<script[^>]+src=/i.test(read('src/components/map/leafletPage.js').replace(/\/\/[^\n]*/g, ''))) { console.error('THE MAP PAGE MUST NOT LOAD SCRIPTS FROM THE INTERNET'); failed = true; }
}

function checkIncludes(file, marker, label) {
  if (!read(file).includes(marker)) {
    console.error(`${label} MISSING: ${marker}`);
    failed = true;
  }
}

checkIncludes('src/screens/admin/UserManagementScreen.js', 'adminDeleteUser', 'ADMIN PERMANENT USER DELETE');
checkIncludes('src/services/adminCrudService.js', "httpsCallable(functions, 'adminDeleteUser')", 'ADMIN DELETE CALLABLE');
checkIncludes('firebase/functions/index.js', 'exports.adminDeleteUser', 'ADMIN DELETE FUNCTION');
checkIncludes('firebase/functions/index.js', 'exports.deleteMyAccount', 'SELF DELETE FUNCTION');
checkIncludes('firebase/functions/index.js', 'deleteStoragePrefix', 'ACCOUNT STORAGE CLEANUP');
checkIncludes('src/screens/manufacturer/ManufacturerProductsScreen.js', 'deleteManufacturerProduct', 'MANUFACTURER PRODUCT DELETE');
checkIncludes('src/screens/manufacturer/BatchManagementScreen.js', 'deleteManufacturerBatch', 'MANUFACTURER BATCH DELETE');
checkIncludes('src/screens/manufacturer/RecallManagementScreen.js', 'deleteManufacturerRecall', 'MANUFACTURER RECALL DELETE');
checkIncludes('src/screens/manufacturer/SerialManagementScreen.js', 'deleteManufacturerSerial', 'MANUFACTURER SERIAL DELETE');
checkIncludes('src/screens/admin/UserManagementScreen.js', 'email: form.email', 'ADMIN USER EMAIL UPDATE');

if (failed) process.exit(1);
console.log('Project validation passed.');
