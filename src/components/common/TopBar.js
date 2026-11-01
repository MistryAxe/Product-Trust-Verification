import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Icon } from './Icon';

export function TopBar({ title, onBack, right }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <Icon name="arrow-back" size={21} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.topBarTitle}>{title}</Text>
      <View style={[styles.topBarSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}
