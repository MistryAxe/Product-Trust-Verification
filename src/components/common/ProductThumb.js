import React from 'react';
import { Image, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function ProductThumb({ size = 48, imageUrl = '' }) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.productThumb, { width: size, height: size }]} resizeMode="cover" />;
  }
  return (
    <View style={[styles.productThumb, { width: size, height: size }]}> 
      <Icon name="cube-outline" size={Math.round(size * 0.45)} color={C.textSoft} />
    </View>
  );
}
