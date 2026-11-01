import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function PrimaryButton({ title, onPress, disabled = false, color = C.primary, icon }) {
  const bright = color === C.primary || color === C.success;
  const contentColor = disabled ? C.textSoft : bright ? C.dark : '#fff';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, { backgroundColor: disabled ? C.surface3 : color }]}
    >
      <View style={styles.buttonInner}>
        {icon ? <Icon name={icon} size={18} color={contentColor} /> : null}
        <Text numberOfLines={2} style={[styles.primaryButtonText, { color: contentColor }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}
