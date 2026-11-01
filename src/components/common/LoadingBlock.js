import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { C, styles } from '../../theme';

export function LoadingBlock({ text = 'Loading…' }) {
  return (
    <View style={styles.centerFill}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={styles.bodySoft}>{text}</Text>
    </View>
  );
}
