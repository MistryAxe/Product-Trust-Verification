import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../theme';

export function StatCard({ label, value }) {
  return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.rowSub}>{label}</Text></View>;
}
