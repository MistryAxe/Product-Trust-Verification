import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { C, styles, useTheme } from '../../theme';

export function Screen({ children, dark = false, style }) {
  const { resolved } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.safe, { backgroundColor: dark ? C.dark : C.bg }, style]}>
      <StatusBar style={dark || resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}
