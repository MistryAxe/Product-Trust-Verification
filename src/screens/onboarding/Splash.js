import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen } from '../../components/common';

export default function Splash() {
  return (
    <Screen dark style={styles.splash}>
      <View style={styles.splashLogo}><Icon name="shield-checkmark" size={44} color={C.dark} /></View>
      <Text style={styles.splashTitle}>Product Trust & Verification</Text>
      <Text style={styles.splashSub}>Starting Product Trust…</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
    </Screen>
  );
}
