import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';

// The page the Android map runs inside. It uses OpenStreetMap, which is free and needs no key and no billing account.
// (The Google map on Android needs a Google Maps key, and an app built without one crashes as soon as a map opens.)
//
// Messages from the page to the app: ready, mapPress, markerPress, dragEnd, tiles, error.
// Messages from the app to the page: window.__apply({ markers, user }) and window.__go({ type: 'region' | 'fit', ... }).

export const DEFAULT_REGION = { latitude: -30.5595, longitude: 22.9375, latitudeDelta: 10.5, longitudeDelta: 10.5 };

export const PAGE_SCRIPT = `
(function () {
  var post = function (message) { try { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } catch (e) {} };
  var note = document.getElementById('note');
  if (!window.L) { note.textContent = 'The map could not start.'; note.style.display = 'block'; post({ type: 'error', message: 'map library missing' }); return; }
  var ok = function (n) { return typeof n === 'number' && isFinite(n); };
  var color = function (c) { return typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\\([0-9 ,.%]+\\))$/.test(c) ? c : '#A7C776'; };
  var clampLat = function (v) { return Math.max(-85, Math.min(85, v)); };
  var initial = window.__INITIAL__ || {};
  var map = L.map(document.getElementById('map'), { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 19 });
  map.attributionControl.setPrefix(false);
  var tileProblem = false;
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '\\u00a9 OpenStreetMap contributors' });
  tiles.on('tileerror', function () { if (!tileProblem) { tileProblem = true; post({ type: 'tiles', ok: false }); } });
  tiles.on('tileload', function () { if (tileProblem) { tileProblem = false; post({ type: 'tiles', ok: true }); } });
  tiles.addTo(map);

  function boundsOf(r) {
    if (!r || !ok(r.latitude) || !ok(r.longitude)) return null;
    var dLat = ok(r.latitudeDelta) && r.latitudeDelta > 0 ? r.latitudeDelta : 0.05;
    var dLng = ok(r.longitudeDelta) && r.longitudeDelta > 0 ? r.longitudeDelta : 0.05;
    return L.latLngBounds([clampLat(r.latitude - dLat / 2), r.longitude - dLng / 2], [clampLat(r.latitude + dLat / 2), r.longitude + dLng / 2]);
  }
  function show(r, animate, ms) {
    var b = boundsOf(r); if (!b) return;
    if (animate) map.flyToBounds(b, { duration: Math.max(0.2, (ms || 400) / 1000) }); else map.fitBounds(b, { animate: false });
  }
  show(initial, false);
  window.addEventListener('resize', function () { map.invalidateSize(); });

  var pins = {};
  var me = null;
  function pinIcon(c) { return L.divIcon({ className: 'pin', html: '<span style="background:' + color(c) + '"></span>', iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30] }); }
  function bindText(marker, title, description) {
    var box = document.createElement('div'); var strong = document.createElement('strong'); strong.textContent = String(title); box.appendChild(strong);
    if (description) { box.appendChild(document.createElement('br')); box.appendChild(document.createTextNode(String(description))); }
    marker.unbindPopup(); marker.bindPopup(box, { closeButton: false, offset: [0, -4] });
  }
  window.__apply = function (state) {
    state = state || {};
    var seen = {};
    (state.markers || []).forEach(function (m) {
      if (!m || !ok(m.lat) || !ok(m.lng)) return;
      var id = String(m.id); seen[id] = true;
      var signature = [m.color, m.title, m.description, m.draggable ? 1 : 0, m.z].join('|');
      var entry = pins[id];
      if (!entry) {
        var marker = L.marker([m.lat, m.lng], { icon: pinIcon(m.color), draggable: !!m.draggable, keyboard: false, zIndexOffset: (ok(m.z) ? m.z : 0) * 100 });
        marker.on('click', function () { post({ type: 'markerPress', id: id }); });
        marker.on('dragend', function () { var p = marker.getLatLng(); post({ type: 'dragEnd', id: id, latitude: p.lat, longitude: p.lng }); });
        marker.addTo(map);
        entry = pins[id] = { marker: marker, signature: '' };
      } else {
        var at = entry.marker.getLatLng();
        if (at.lat !== m.lat || at.lng !== m.lng) entry.marker.setLatLng([m.lat, m.lng]);
      }
      if (entry.signature !== signature) {
        entry.marker.setIcon(pinIcon(m.color));
        entry.marker.setZIndexOffset((ok(m.z) ? m.z : 0) * 100);
        if (m.title) bindText(entry.marker, m.title, m.description); else entry.marker.unbindPopup();
        if (entry.marker.dragging) { if (m.draggable) entry.marker.dragging.enable(); else entry.marker.dragging.disable(); }
        entry.signature = signature;
      }
    });
    Object.keys(pins).forEach(function (id) { if (!seen[id]) { map.removeLayer(pins[id].marker); delete pins[id]; } });
    if (state.user && ok(state.user.lat) && ok(state.user.lng)) {
      if (!me) me = L.circleMarker([state.user.lat, state.user.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2a7fff', fillOpacity: 1, interactive: false }).addTo(map);
      else me.setLatLng([state.user.lat, state.user.lng]);
    } else if (me) { map.removeLayer(me); me = null; }
  };
  window.__go = function (cmd) {
    if (!cmd) return;
    if (cmd.type === 'region') show(cmd.region, !!cmd.animate, cmd.ms);
    if (cmd.type === 'fit') {
      var pts = (cmd.coords || []).filter(function (p) { return p && ok(p.latitude) && ok(p.longitude); }).map(function (p) { return [clampLat(p.latitude), p.longitude]; });
      if (!pts.length) return;
      var pad = cmd.padding || {};
      map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [pad.left || 30, pad.top || 30], paddingBottomRight: [pad.right || 30, pad.bottom || 30], animate: !!cmd.animate, maxZoom: 15 });
    }
  };
  map.on('click', function (e) { post({ type: 'mapPress', latitude: e.latlng.lat, longitude: e.latlng.lng }); });
  window.__map = map; window.__pins = pins; // handles for automated tests
  post({ type: 'ready' });
})();
`;

// JSON that is safe to place inside a <script> tag or a JavaScript string.
export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function buildLeafletPage({ initialRegion, library = true } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>${library ? LEAFLET_CSS : ''}
html,body,#map{height:100%;margin:0;padding:0;background:#0b130c;-webkit-tap-highlight-color:transparent}
#note{display:none;position:absolute;inset:0;color:#c9d3c6;font:15px sans-serif;text-align:center;padding:24px}
.pin{background:none;border:0}
.pin span{display:block;width:22px;height:22px;margin:3px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.55)}
.leaflet-container{font:13px sans-serif}
</style></head><body><div id="map"></div><div id="note"></div>
${library ? `<script>${LEAFLET_JS.replace(/<\/script/gi, '<\\/script')}</script>` : ''}
<script>window.__INITIAL__ = ${safeJson(initialRegion || DEFAULT_REGION)};</script>
<script>${PAGE_SCRIPT}</script></body></html>`;
}
