import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Icon } from './Icon';

export function CrudProductPicker({ products, value, onChange }) {
  if (!products.length) return <Text style={styles.errorText}>No products are registered yet.</Text>;
  const index = Math.max(0, products.findIndex((p) => p.id === value));
  const product = products[index] || products[0];
  const move = (delta) => {
    const next = (index + delta + products.length) % products.length;
    onChange(products[next].id);
  };
  return (
    <View style={styles.pickerCard}>
      <Text style={styles.fieldLabel}>Product</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity onPress={() => move(-1)} style={styles.smallIconButton}><Icon name="chevron-back" size={18} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.rowTitle, { textAlign: 'center' }]}>{product.name || 'Unnamed product'}</Text><Text style={styles.rowSub}>{product.barcode || 'No barcode'}</Text></View>
        <TouchableOpacity onPress={() => move(1)} style={styles.smallIconButton}><Icon name="chevron-forward" size={18} /></TouchableOpacity>
      </View>
    </View>
  );
}
