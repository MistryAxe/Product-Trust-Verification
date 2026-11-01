import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function PremiumAction({ icon, title, subtitle, onPress, accent = C.primary }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.premiumAction}>
      <View style={[styles.premiumActionIcon, { backgroundColor: `${accent}18` }]}>
        <Icon name={icon} size={22} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.premiumActionTitle}>{title}</Text>
        <Text style={styles.premiumActionSub}>{subtitle}</Text>
      </View>
      <View style={styles.premiumActionArrow}><Icon name="arrow-forward" size={16} color={C.primary} /></View>
    </TouchableOpacity>
  );
}
