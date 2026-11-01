import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function PremiumMetricCard({ icon, label, value, accent = C.primary, compact = false }) {
  return (
    <View style={[styles.premiumMetricCard, compact && styles.premiumMetricCardCompact]}>
      <View style={[styles.premiumMetricIcon, { backgroundColor: `${accent}18` }]}>
        <Icon name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.premiumMetricValue}>{Number(value || 0).toLocaleString()}</Text>
      <Text style={styles.premiumMetricLabel}>{label}</Text>
    </View>
  );
}
