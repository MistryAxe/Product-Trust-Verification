import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Icon } from './Icon';

export function CrudManufacturerPicker({ manufacturers, value, onChange }) {
  if (!manufacturers.length) return <Text style={styles.errorText}>Create or promote a Manufacturer account first.</Text>;
  const index = Math.max(0, manufacturers.findIndex((m) => m.uid === value));
  const manufacturer = manufacturers[index] || manufacturers[0];
  const move = (delta) => {
    const next = (index + delta + manufacturers.length) % manufacturers.length;
    onChange(manufacturers[next].uid);
  };
  return (
    <View style={styles.pickerCard}>
      <Text style={styles.fieldLabel}>Manufacturer</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity onPress={() => move(-1)} style={styles.smallIconButton}><Icon name="chevron-back" size={18} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.rowTitle, { textAlign: 'center' }]}>{manufacturer.organizationName || manufacturer.fullName || 'Manufacturer'}</Text><Text style={styles.rowSub}>{manufacturer.email || manufacturer.uid}</Text></View>
        <TouchableOpacity onPress={() => move(1)} style={styles.smallIconButton}><Icon name="chevron-forward" size={18} /></TouchableOpacity>
      </View>
    </View>
  );
}
