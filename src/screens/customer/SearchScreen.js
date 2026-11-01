import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, EmptyState, ProductThumb, StatusPill, RestorableScrollView } from '../../components/common';
import { searchProducts } from '../../services/productService';
import { searchProductsExternally } from '../../services/externalApiService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function SearchScreen({ go, openProduct, openExternalProduct, onBarcode }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const queryText = text.trim();
    if (!queryText) return;
    setBusy(true);
    setSearched(true);
    try {
      if (/^\d{8,14}$/.test(queryText) && onBarcode) {
        await onBarcode(queryText);
        return;
      }
      const [firebaseResults, externalResults] = await Promise.all([
        searchProducts(queryText).catch(() => []),
        searchProductsExternally(queryText).catch(() => []),
      ]);
      const rows = [
        ...firebaseResults.map((product) => ({ key: `internal-${product.id}`, product, type: 'internal' })),
        ...externalResults.map((product, index) => ({ key: `external-${product.barcode || product.id || index}`, product, type: 'external' })),
      ];
      const deduped = [];
      const seen = new Set();
      rows.forEach((row) => {
        const key = row.product.barcode || `${row.product.brand || ''}-${row.product.name || ''}`.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        deduped.push(row);
      });
      setResults(deduped.slice(0, 24));
    } catch (error) {
      Alert.alert('Search failed', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Search Products" onBack={() => go('back')} />
      <View style={styles.searchBarWrap}>
        <TextInput value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={search} placeholder="Name, brand, barcode, model or SKU" placeholderTextColor={C.textFaint} style={styles.searchInput} />
        <TouchableOpacity onPress={search} style={styles.searchButton}><Icon name="search" color={C.dark} /></TouchableOpacity>
      </View>
      <RestorableScrollView screenKey="search" contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}><Icon name="globe-outline" color={C.cyan} /><Text style={styles.noticeText}>Search checks Product Trust first, then connected public product sources and online product research when configured.</Text></View>
        {busy ? <ActivityIndicator color={C.primary} size="large" /> : null}
        {!busy && searched && !results.length ? <EmptyState title="No product found yet" text="Try the brand plus product name, model, barcode or SKU. You can also scan the physical product or its QR code." /> : null}
        {results.map(({ key, product, type }) => (
          <TouchableOpacity key={key} onPress={() => type === 'internal' ? openProduct(product.id) : openExternalProduct(product)} style={styles.listRow}>
            <ProductThumb imageUrl={product.imageUrl || ''} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{product.name || 'Product result'}</Text>
              <Text style={styles.rowSub}>{[product.brand || product.manufacturerName, product.category, product.barcode].filter(Boolean).join(' • ')}</Text>
              <Text style={styles.dataSourceText}>{type === 'internal' ? 'Product Trust manufacturer record' : (product.sourceName || (product.webResearch ? 'Online product research' : 'External product source'))}</Text>
            </View>
            <StatusPill text={type === 'internal' ? 'Registered' : 'External'} color={type === 'internal' ? C.primary : C.cyan} bg={type === 'internal' ? C.primaryBg : C.cyanBg} />
          </TouchableOpacity>
        ))}
      </RestorableScrollView>
      <PortalNav role="customer" screen="search" go={go} />
    </Screen>
  );
}
