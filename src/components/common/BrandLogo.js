import React from 'react';
import { Image, Text, View } from 'react-native';
import { C } from '../../theme';

// A company logo, or the company's first letter when it has not added one.
export function BrandLogo({ uri = '', name = '', size = 48 }) {
  const radius = Math.round(size * 0.22);
  if (uri) {
    return <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border }} />;
  }
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.primary, fontWeight: '900', fontSize: Math.round(size * 0.42) }}>{initial}</Text>
    </View>
  );
}
