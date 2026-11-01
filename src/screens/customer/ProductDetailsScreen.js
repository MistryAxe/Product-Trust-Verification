import React from 'react';
import { Image, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Screen, TopBar, StatusPill, InfoRow, RestorableScrollView } from '../../components/common';

import { PortalNav } from '../../components/navigation';
export default function ProductDetailsScreen({ product, go }) {
  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
  const hasAny = (values) => values.some(hasValue);
  const OptionalRow = ({ label, value, last = false }) => hasValue(value) ? <InfoRow label={label} value={value} last={last} /> : null;
  const nutrientValue = (key, unit = 'g') => {
    const value = product.nutriments?.[key];
    return value !== '' && value != null ? `${value} ${unit}` : '';
  };

  const isFood = product.productClass === 'food' || product.productType === 'food' || !!product.ingredientsText || Object.keys(product.nutriments || {}).length > 0;
  const isTechnical = product.productClass === 'equipment' || product.productClass === 'electronics';
  const identificationValues = [product.model, product.partNumber, product.sku, product.color, product.size, product.dimensions, product.weight, product.material, product.warranty];
  const technicalValues = [product.ratedVoltage, product.ratedCurrent, product.ratedPower, product.frequency, product.phase, product.speedRpm, product.pressureRating, product.capacity, product.ipRating, product.certificationMarks];
  const originValues = [product.marketCountries, product.countries, product.manufacturingPlaces, product.origins, product.authorisedRetailers, product.traceabilityCode, product.servingSize, product.officialWebsite, product.officialProductUrl];
  const packagingValues = [product.packagingDescription, product.packaging, product.securityFeatures];
  const nutritionValues = [
    product.nutritionGrade, product.ecoScore, product.novaGroup,
    product.nutriments?.['energy-kcal_100g'], product.nutriments?.fat_100g,
    product.nutriments?.['saturated-fat_100g'], product.nutriments?.carbohydrates_100g,
    product.nutriments?.sugars_100g, product.nutriments?.proteins_100g,
    product.nutriments?.fiber_100g, product.nutriments?.salt_100g,
  ];

  return (
    <Screen>
      <TopBar title="Product Details" onBack={() => go('back')} />
      <RestorableScrollView screenKey={`registeredDetails:${product?.id || product?.barcode || product?.name || 'details'}`} contentContainerStyle={styles.pagePad}>
        <View style={styles.cardPad}>
          <OptionalRow label="Name" value={product.name} />
          <OptionalRow label="Brand" value={product.brand} />
          <OptionalRow label="Manufacturer" value={product.manufacturerName} />
          <OptionalRow label="Barcode" value={product.barcode} />
          <OptionalRow label="Product type" value={product.productClass} />
          <OptionalRow label="Category" value={product.category} />
          <OptionalRow label="Equipment type" value={product.equipmentType} />
          <OptionalRow label={isFood ? 'Net content' : 'Pack quantity / capacity'} value={product.netContent} />
          <OptionalRow label="Country of origin" value={product.country || product.countries || product.origins} last />
        </View>

        {!isFood && hasAny(identificationValues) ? <>
          <Text style={styles.sectionTitle}>Product information</Text>
          <View style={styles.cardPad}>
            <OptionalRow label="Model" value={product.model} />
            <OptionalRow label="Part number" value={product.partNumber} />
            <OptionalRow label="SKU / item code" value={product.sku} />
            <OptionalRow label="Colour" value={product.color} />
            <OptionalRow label="Size" value={product.size} />
            <OptionalRow label="Dimensions" value={product.dimensions} />
            <OptionalRow label="Weight" value={product.weight} />
            <OptionalRow label="Material" value={product.material} />
            <OptionalRow label="Warranty" value={product.warranty} last />
          </View>
        </> : null}

        {isTechnical && hasAny(technicalValues) ? <>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.cardPad}>
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

        {hasAny(originValues) ? <>
          <Text style={styles.sectionTitle}>Origin & where it is sold</Text>
          <View style={styles.cardPad}>
            <OptionalRow label="Countries / markets sold" value={product.marketCountries || product.countries} />
            <OptionalRow label="Manufacturing places" value={product.manufacturingPlaces} />
            <OptionalRow label="Origins" value={product.origins} />
            <OptionalRow label="Authorised retailers" value={product.authorisedRetailers} />
            <OptionalRow label="Package / tracking code" value={product.traceabilityCode} />
            {isFood ? <OptionalRow label="Serving size" value={product.servingSize} /> : null}
            <OptionalRow label="Official website" value={product.officialWebsite} />
            <OptionalRow label="Official product page" value={product.officialProductUrl} last />
          </View>
        </> : null}

        {hasValue(product.description) ? <>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.cardPad}><Text style={styles.body}>{product.description}</Text></View>
        </> : null}

        {hasAny(packagingValues) ? <>
          <Text style={styles.sectionTitle}>Packaging</Text>
          <View style={styles.cardPad}>
            <OptionalRow label="Packaging description" value={product.packagingDescription || product.packaging} />
            <OptionalRow label="Security features" value={product.securityFeatures} last />
          </View>
        </> : null}

        {isFood && hasAny(nutritionValues) ? <>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.cardPad}>
            <OptionalRow label="Nutri-Score" value={product.nutritionGrade} />
            <OptionalRow label="Eco-Score / Green-Score" value={product.ecoScore} />
            <OptionalRow label="Energy / 100 g or ml" value={nutrientValue('energy-kcal_100g', 'kcal')} />
            <OptionalRow label="Fat / 100 g or ml" value={nutrientValue('fat_100g')} />
            <OptionalRow label="Saturated fat / 100 g or ml" value={nutrientValue('saturated-fat_100g')} />
            <OptionalRow label="Carbohydrates / 100 g or ml" value={nutrientValue('carbohydrates_100g')} />
            <OptionalRow label="Sugars / 100 g or ml" value={nutrientValue('sugars_100g')} />
            <OptionalRow label="Protein / 100 g or ml" value={nutrientValue('proteins_100g')} />
            <OptionalRow label="Fibre / 100 g or ml" value={nutrientValue('fiber_100g')} />
            <OptionalRow label="Salt / 100 g or ml" value={nutrientValue('salt_100g')} />
            <OptionalRow label="NOVA group" value={product.novaGroup} last />
          </View>
        </> : null}

        {isFood && hasValue(product.ingredientsText) ? <>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.cardPad}><Text style={styles.body}>{product.ingredientsText}</Text></View>
        </> : null}

        {isFood && product.allergens?.length ? <>
          <Text style={styles.sectionTitle}>Declared allergens</Text>
          <View style={styles.cardPad}>
            <View style={styles.tagWrap}>{product.allergens.map((a) => <StatusPill key={a} text={a} color={C.primary} bg={C.primaryBg} />)}</View>
          </View>
        </> : null}

        {product.packagingReferenceUrl ? <><Text style={styles.sectionTitle}>Reference image</Text><Image source={{ uri: product.packagingReferenceUrl }} style={styles.packagingImage} /></> : null}
      </RestorableScrollView>
      <PortalNav role="customer" screen="scan" go={go} />
    </Screen>
  );
}
