import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function FeatureTile({ icon, title, subtitle, color = C.primary, bg = C.primaryBg, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.featureTile}>
      <View style={[styles.featureIcon, { backgroundColor: bg }]}><Icon name={icon} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={C.textFaint} />
    </TouchableOpacity>
  );
}
