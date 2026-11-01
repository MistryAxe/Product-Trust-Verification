import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../theme';

export function LivePill({ text = 'LIVE FIREBASE' }) {
  return (
    <View style={styles.livePill}>
      <View style={styles.liveDot} />
      <Text style={styles.livePillText}>{text}</Text>
    </View>
  );
}
