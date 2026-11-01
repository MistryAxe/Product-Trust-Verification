export const API_CONFIG = {
  openFoodFactsBaseUrl: 'https://world.openfoodfacts.org',
  openFoodFactsUserAgent: 'ProductTrustVerification/1.0 (https://product-trust-verification.firebaseapp.com)',
  usdaFdcBaseUrl: 'https://api.nal.usda.gov/fdc/v1',
  usdaFdcApiKey: process.env.EXPO_PUBLIC_USDA_FDC_API_KEY || '',
  ocrSpaceBaseUrl: 'https://api.ocr.space/parse/image',
  upcItemDbBaseUrl: 'https://api.upcitemdb.com/prod/trial',
  ocrSpaceApiKey: process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || '',
  serpApiBaseUrl: 'https://serpapi.com/search.json',
  serpApiKey: process.env.EXPO_PUBLIC_SERPAPI_KEY || '',
  recallLookupUrl: process.env.EXPO_PUBLIC_RECALL_LOOKUP_URL || '',
  gs1VerifyUrl: 'https://www.gs1.org/services/verified-by-gs1',
};

export function apiConfigured(name) {
  return Boolean(API_CONFIG[name]);
}
