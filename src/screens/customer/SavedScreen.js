import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, LoadingBlock, EmptyState, ProductThumb, SecondaryButton, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { removeSavedProduct, subscribeSavedProducts } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';
import { decodeDisplayText } from '../../utils/display';

export default function SavedScreen({ uid, go, openSavedProduct }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeSavedProducts(uid, (rows) => { setItems(rows); setLoading(false); }, () => setLoading(false)), [uid]);

  const remove = async (item) => {
    try {
      await removeSavedProduct(uid, item.id);
    } catch (error) {
      Alert.alert('Unable to remove product', friendlyFirebaseError(error));
    }
  };

  return (
    <Screen>
      <TopBar title="Saved Products" />
      {loading ? <LoadingBlock /> : (
        <RestorableScrollView screenKey="saved" contentContainerStyle={styles.pagePad}>
          {!items.length ? <EmptyState icon="heart-outline" title="Nothing saved" text="Open any registered or external product result and tap the heart to keep it here for later." /> : items.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <TouchableOpacity onPress={() => openSavedProduct(item)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <ProductThumb imageUrl={item.imageUrl || item.productSnapshot?.imageUrl || ''} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rowTitle}>{decodeDisplayText(item.productName || item.productSnapshot?.name || 'Saved product')}</Text>
                  <Text style={styles.rowSub}>{item.manufacturerName || item.barcode || item.productSnapshot?.brand || 'Saved evidence'}</Text>
                  <Text style={styles.dataSourceText}>{item.sourceType === 'external' ? 'External product snapshot' : 'Product Trust record'}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={C.textFaint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(item)} style={styles.smallIconButton}><Icon name="heart" color={C.danger} size={18} /></TouchableOpacity>
            </View>
          ))}
          {items.length ? <SecondaryButton title="Compare Product Quality" icon="git-compare-outline" color={C.primary} onPress={() => go('compare')} /> : null}
        </RestorableScrollView>
      )}
      <PortalNav role="customer" screen="saved" go={go} />
    </Screen>
  );
}
