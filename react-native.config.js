// The Google map library (react-native-maps) needs a Google Maps key on Android, and an installed app built without one
// crashes as soon as a map opens. Android now uses the free OpenStreetMap map (src/components/map/UniversalMap.android.js),
// so the library is left out of the Android app completely. iPhone is unaffected: it uses Apple Maps, which needs no key.
module.exports = {
  dependencies: {
    'react-native-maps': {
      platforms: {
        android: null,
      },
    },
  },
};
