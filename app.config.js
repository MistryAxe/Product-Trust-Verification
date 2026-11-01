const DEFAULT_IOS_GOOGLE_CLIENT_ID = '398531881162-ssdlbi4evse5cpg3ueljl86uohbml1v7.apps.googleusercontent.com';

function googleIosUrlScheme(clientId = '') {
  const clean = String(clientId || '')
    .trim()
    .replace(/\.apps\.googleusercontent\.com$/i, '');
  return clean ? `com.googleusercontent.apps.${clean}` : '';
}

module.exports = ({ config }) => {
  const iosGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || DEFAULT_IOS_GOOGLE_CLIENT_ID;
  const iosUrlScheme = googleIosUrlScheme(iosGoogleClientId);
  const managedPlugins = new Set([
    '@react-native-google-signin/google-signin',
    'expo-font',
    'expo-sharing',
    'expo-status-bar',
    'expo-web-browser',
  ]);
  const plugins = [...(config.plugins || [])].filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !managedPlugins.has(name);
  });

  plugins.push(
    'expo-font',
    'expo-sharing',
    'expo-status-bar',
    'expo-web-browser',
    iosUrlScheme
      ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
      : '@react-native-google-signin/google-signin',
  );

  return {
    ...config,
    version: '20.22.3',
    android: {
      ...(config.android || {}),
      package: 'com.producttrust.verification',
      versionCode: 229,
    },
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: 'com.producttrust.verification',
      buildNumber: '20.22.3',
      infoPlist: {
        ...((config.ios || {}).infoPlist || {}),
        GIDClientID: iosGoogleClientId,
      },
    },
    plugins,
  };
};
