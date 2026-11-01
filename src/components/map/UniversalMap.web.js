import React from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme';

export function Marker() {
  return null;
}

export function MapView({ style, children, region }) {
  const latitude = Number(region?.latitude);
  const longitude = Number(region?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <View
      style={[
        style,
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
          backgroundColor: C.card || '#111827',
          borderWidth: 1,
          borderColor: C.border || '#263244',
          overflow: 'hidden',
        },
      ]}
    >
      <Text style={{ color: C.text || '#ffffff', fontWeight: '700', textAlign: 'center' }}>
        Map preview
      </Text>
      <Text style={{ color: C.textSoft || '#94a3b8', textAlign: 'center', marginTop: 6 }}>
        Interactive map controls are available in the Android/iOS app. The web build keeps this screen usable for testing authentication and the rest of Product Trust.
      </Text>
      {hasCoordinates ? (
        <Text style={{ color: C.textSoft || '#94a3b8', textAlign: 'center', marginTop: 10 }}>
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export default MapView;
