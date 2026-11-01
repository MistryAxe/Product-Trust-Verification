import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

export function ProductSelector({ products, index, setIndex }) {
  if (!products.length) return <EmptyState title="No products" text="Register a product first." />;
  const p = products[index] || products[0];
  return (
    <View style={styles.pickerCard}>
      <Text style={styles.fieldLabel}>Product</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity onPress={() => setIndex((index - 1 + products.length) % products.length)} style={styles.smallIconButton}><Icon name="chevron-back" size={18} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.rowTitle, { textAlign: 'center' }]}>{p.name}</Text><Text style={styles.rowSub}>{p.barcode}</Text></View>
        <TouchableOpacity onPress={() => setIndex((index + 1) % products.length)} style={styles.smallIconButton}><Icon name="chevron-forward" size={18} /></TouchableOpacity>
      </View>
    </View>
  );
}
