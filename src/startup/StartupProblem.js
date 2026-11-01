import React from 'react';
import { ScrollView, Text, View } from 'react-native';

// Until now, if the app failed while it was opening, the phone just closed it and gave no clue why.
// This screen shows the reason instead, so a screenshot of it tells the developers exactly what went wrong.
// It uses only plain React Native on purpose: it must still work when the rest of the app could not load.

let showFatal = null;
let pendingFatal = null;

export function describeError(error) {
  const source = error && typeof error === 'object' ? error : { message: String(error) };
  return {
    message: String(source.message || source).slice(0, 600),
    stack: String(source.stack || '').split('\n').slice(0, 14).join('\n').slice(0, 1800),
  };
}

export function StartupProblem({ error, when }) {
  const { message, stack } = describeError(error);
  let version = '';
  try {
    const Constants = require('expo-constants');
    version = String(((Constants && Constants.default) || Constants).expoConfig?.version || '');
  } catch (_) { /* the version line is a nicety: never let it break this screen */ }
  return (
    <View style={{ flex: 1, backgroundColor: '#050805', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>Product Trust could not start</Text>
      <Text style={{ color: '#C9D3C6', fontSize: 15, marginTop: 10, lineHeight: 21 }}>
        Something went wrong {when || 'while the app was running'}. Close the app completely and open it again. If this keeps happening, take a screenshot of this screen and send it to the developers.
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 16, backgroundColor: '#111A12', borderRadius: 12 }} contentContainerStyle={{ padding: 14 }}>
        <Text selectable style={{ color: '#FF9B9B', fontSize: 13, fontWeight: '700' }}>{message}</Text>
        {stack ? <Text selectable style={{ color: '#9FB09C', fontSize: 11, marginTop: 10 }}>{stack}</Text> : null}
        {version ? <Text style={{ color: '#6F7F6C', fontSize: 11, marginTop: 10 }}>App version {version}</Text> : null}
      </ScrollView>
    </View>
  );
}

// Fatal errors that nothing else caught would close the app. In a released app, show the screen above instead.
// (While developing, the normal red error screen is more useful, so nothing changes there.)
export function installFatalErrorScreen() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  const utils = globalThis.ErrorUtils;
  if (!utils || !utils.setGlobalHandler) return;
  const previous = utils.getGlobalHandler ? utils.getGlobalHandler() : null;
  utils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) {
      if (previous) previous(error, isFatal);
      return;
    }
    if (showFatal) showFatal(error);
    else pendingFatal = error;
  });
}

export function wrapWithFatalScreen(Root) {
  return function FatalErrorGuard() {
    const [fatal, setFatal] = React.useState(pendingFatal);
    React.useEffect(() => {
      showFatal = setFatal;
      if (pendingFatal) setFatal(pendingFatal);
      return () => { showFatal = null; };
    }, []);
    if (fatal) return <StartupProblem error={fatal} when="while the app was running" />;
    return <Root />;
  };
}
