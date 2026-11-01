import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../theme';

export function Legend({ color, text }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.rowSub}>{text}</Text></View>;
}
