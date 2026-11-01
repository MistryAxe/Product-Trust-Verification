import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../theme';

export function CompareRow({ label, a, b }) {
  return (
    <View style={styles.compareRow}>
      <View style={styles.compareLabelWrap}><Text style={styles.compareLabel}>{label}</Text></View>
      <View style={styles.compareValueWrap}><Text style={styles.compareValue}>{a}</Text></View>
      <View style={styles.compareValueWrap}><Text style={styles.compareValue}>{b}</Text></View>
    </View>
  );
}
