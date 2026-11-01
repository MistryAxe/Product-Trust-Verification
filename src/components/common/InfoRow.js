import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../theme';

export function InfoRow({ label, value, last = false }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <View style={styles.infoLabelWrap}><Text style={styles.infoLabel}>{label}</Text></View>
      <View style={styles.infoValueWrap}><Text selectable style={styles.infoValue}>{String(value ?? '—')}</Text></View>
    </View>
  );
}
