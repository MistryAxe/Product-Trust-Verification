import React from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme';
import { ErrorBoundary } from './src/components/common';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
