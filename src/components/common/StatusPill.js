import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';

export function StatusPill({ text, color = C.primary, bg = C.primaryBg }) {
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color }]}>{text}</Text></View>;
}
