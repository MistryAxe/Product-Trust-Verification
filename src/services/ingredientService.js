import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { prepareImages } from './storageService';

export const COMMON_ALLERGENS = [
  'Peanuts',
  'Tree nuts',
  'Milk',
  'Eggs',
  'Wheat / Gluten',
  'Soy',
  'Fish',
  'Shellfish',
  'Sesame',
  'Mustard',
  'Celery',
  'Sulphites',
];

const TERMS = {
  Peanuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  'Tree nuts': ['almond', 'cashew', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'macadamia', 'brazil nut', 'tree nut'],
  Milk: ['milk', 'whey', 'casein', 'caseinate', 'lactose', 'butter', 'cream'],
  Eggs: ['egg', 'eggs', 'albumen', 'ovalbumin'],
  'Wheat / Gluten': ['wheat', 'gluten', 'barley', 'rye', 'spelt'],
  Soy: ['soy', 'soya', 'soybean', 'soybeans'],
  Fish: ['fish', 'cod', 'salmon', 'tuna', 'anchovy', 'haddock'],
  Shellfish: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'mussel', 'oyster'],
  Sesame: ['sesame', 'tahini'],
  Mustard: ['mustard'],
  Celery: ['celery', 'celeriac'],
  Sulphites: ['sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide', 'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228'],
};

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function analyseIngredientText(text, selectedAllergens = [], customAllergens = []) {
  const lower = ` ${normalize(text)} `;
  const selected = [...new Set([...(selectedAllergens || []), ...(customAllergens || [])].filter(Boolean))];
  return selected.filter((allergen) => {
    const known = TERMS[allergen] || [normalize(allergen)];
    return known.some((term) => {
      const normalizedTerm = normalize(term);
      return normalizedTerm && lower.includes(` ${normalizedTerm} `) || lower.includes(normalizedTerm);
    });
  });
}

export function analyseProductAllergens(product = {}, selectedAllergens = [], customAllergens = []) {
  const sourceText = [
    product.ingredientsText,
    ...(product.allergens || []),
    ...(product.traces || []),
  ].filter(Boolean).join(' ');
  const detected = analyseIngredientText(sourceText, selectedAllergens, customAllergens);
  return {
    detected,
    hasProfile: Boolean((selectedAllergens || []).length || (customAllergens || []).length),
    hasProductAllergenData: Boolean(product.ingredientsText || product.allergens?.length || product.traces?.length),
  };
}

export async function saveIngredientCheck(uid, { ingredientText, detectedAllergens, imageUri }) {
  const ref = doc(collection(db, 'users', uid, 'ingredientScans'));
  let imageUrl = '';
  let imageDataUri = '';
  let imageUploadFailed = false;
  if (imageUri) {
    // One small label photo is kept on the check itself (see storageService).
    const prepared = await prepareImages([imageUri], `ingredient-labels/${uid}/${ref.id}`);
    imageUrl = prepared.urls[0] || '';
    imageDataUri = prepared.images[0]?.dataUri || '';
    imageUploadFailed = prepared.failed > 0;
  }
  await setDoc(ref, {
    ingredientText: ingredientText.trim(),
    detectedAllergens,
    imageUrl,
    imageDataUri,
    imageUploadFailed,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, imageUploadFailed };
}
