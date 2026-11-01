import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildLeafletPage, safeJson } from './leafletPage';

// The map on Android: OpenStreetMap, shown through a WebView. It needs no Google Maps key (and no billing account).
// The Google map crashes an installed Android app that was built without such a key, so Android no longer uses it.
// It answers to the same props and functions the screens already use (markers, tap, drag a pin, move to a place, fit all pins).

const PAGE_ORIGIN = 'https://product-trust-verification.web.app';

export function Marker() {
  return null; // The map reads each marker's props directly.
}

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function collectMarkers(children) {
  const markers = [];
  const handlers = {};
  React.Children.toArray(children).forEach((child, index) => {
    const props = child && child.props;
    const lat = asNumber(props?.coordinate?.latitude);
    const lng = asNumber(props?.coordinate?.longitude);
    if (lat === null || lng === null) return;
    const id = String(child.key ?? index);
    markers.push({
      id, lat, lng,
      color: typeof props.pinColor === 'string' ? props.pinColor : undefined,
      title: props.title ? String(props.title) : '',
      description: props.description ? String(props.description) : '',
      z: asNumber(props.zIndex) ?? 0,
      draggable: Boolean(props.draggable),
    });
    handlers[id] = { onPress: props.onPress, onDragEnd: props.onDragEnd };
  });
  return { markers, handlers };
}

export function eventAt(latitude, longitude) {
  return { nativeEvent: { coordinate: { latitude, longitude } } };
}

const MapView = forwardRef(function MapView({ style, initialRegion, region, onMapReady, onPress, userLocation, showsUserLocation, children }, ref) {
  const webRef = useRef(null);
  const readyRef = useRef(false);
  const queue = useRef([]);
  const current = useRef({ apply: '', region: '' }); // what the page must show, re-sent whenever the page (re)starts
  const handlers = useRef({});
  const latest = useRef({});
  const [tilesProblem, setTilesProblem] = useState(false);
  const [failed, setFailed] = useState(false);

  // The page is built once, around the starting view.
  const html = useMemo(() => buildLeafletPage({ initialRegion: initialRegion || region }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const inject = useCallback((script) => { if (readyRef.current && webRef.current) webRef.current.injectJavaScript(`${script};true;`); }, []);
  const run = useCallback((script) => {
    if (readyRef.current && webRef.current) inject(script);
    else queue.current.push(script); // one-off commands (move, fit) wait for the page
  }, [inject]);

  const collected = collectMarkers(children);
  handlers.current = collected.handlers;
  latest.current = { onPress, onMapReady };
  const user = showsUserLocation && asNumber(userLocation?.latitude) !== null && asNumber(userLocation?.longitude) !== null ? { lat: userLocation.latitude, lng: userLocation.longitude } : null;
  const stateJson = safeJson({ markers: collected.markers, user });
  const regionJson = region ? safeJson({ type: 'region', region, animate: false }) : '';

  useEffect(() => { current.current.apply = `window.__apply(${stateJson})`; inject(current.current.apply); }, [stateJson, inject]);
  useEffect(() => { current.current.region = regionJson ? `window.__go(${regionJson})` : ''; if (current.current.region) inject(current.current.region); }, [regionJson, inject]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (target, duration) => run(`window.__go(${safeJson({ type: 'region', region: target, animate: true, ms: duration })})`),
    fitToCoordinates: (coords, options) => run(`window.__go(${safeJson({ type: 'fit', coords, padding: options?.edgePadding, animate: options?.animated !== false })})`),
  }), [run]);

  const onMessage = (event) => {
    let message;
    try { message = JSON.parse(event?.nativeEvent?.data); } catch (_) { return; }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      // The page has (re)started: give it the current pins and view, then anything that was waiting.
      // (Android can restart a page it needs the memory back from; it would otherwise come back empty.)
      readyRef.current = true;
      inject(current.current.apply);
      if (current.current.region) inject(current.current.region);
      const waiting = queue.current;
      queue.current = [];
      waiting.forEach((script) => inject(script));
      latest.current.onMapReady?.();
    } else if (message.type === 'mapPress') {
      latest.current.onPress?.(eventAt(message.latitude, message.longitude));
    } else if (message.type === 'markerPress') {
      handlers.current[message.id]?.onPress?.(eventAt(undefined, undefined));
    } else if (message.type === 'dragEnd') {
      handlers.current[message.id]?.onDragEnd?.(eventAt(message.latitude, message.longitude));
    } else if (message.type === 'tiles') {
      setTilesProblem(message.ok === false);
    } else if (message.type === 'error') {
      setFailed(true);
    }
  };

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: '#0b130c' }]}>
      <WebView
        ref={webRef}
        style={{ flex: 1, backgroundColor: '#0b130c' }}
        source={{ html, baseUrl: PAGE_ORIGIN }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        androidLayerType="hardware"
        onMessage={onMessage}
        onError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => !request?.url || request.url === 'about:blank' || request.url.startsWith(PAGE_ORIGIN)}
      />
      {tilesProblem || failed ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(5,8,5,0.85)' }}>
          <Text style={{ color: '#C9D3C6', fontSize: 12, textAlign: 'center' }}>
            {failed ? 'The map could not start. Your reports are still listed below.' : 'The map pictures could not load. Check your internet connection.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

export { MapView };
export default MapView;
