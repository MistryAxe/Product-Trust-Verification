import React from 'react';
import { WebView } from 'react-native-webview';

// Shows a generated document inside the app. Scripts are switched off: the
// document is plain, escaped HTML and needs none.
export function HtmlViewer({ html, style }) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={[{ flex: 1, backgroundColor: '#ffffff' }, style]}
      javaScriptEnabled={false}
      setSupportMultipleWindows={false}
      startInLoadingState
    />
  );
}
