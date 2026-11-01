import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function SecondaryButton({ title, onPress, icon, color = C.text, disabled = false }) {
  const effectiveColor = disabled ? C.textFaint : color;
  return (
    <TouchableOpacity disabled={disabled} activeOpacity={0.8} onPress={onPress} style={[styles.secondaryButton, disabled && { opacity: 0.55 }]}>
      <View style={styles.buttonInner}>
        {icon ? <Icon name={icon} size={18} color={effectiveColor} /> : null}
        <Text numberOfLines={2} style={[styles.secondaryButtonText, { color: effectiveColor }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}
