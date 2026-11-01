import React, { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { styles } from '../../theme';
import { Screen, TopBar, LoadingBlock } from '../../components/common';
import { PortalNav, dashboardForRole } from '../../components/navigation';
import { useTrustMapData } from '../../hooks/useTrustMapData';
import { CARD_GAP, ClusterCarousel, EmptyMapCard, MapHeader, MapKey, mapLayoutMode, mapTitle, pinColorFor } from '../../components/map/MapPanels';

// Safe to place inside a <script> block: "<" can never close the script tag.
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function mapHtml(clusters) {
  const rows = safeJson(clusters.map((cluster) => ({
    id: cluster.id,
    lat: cluster.latitude,
    lng: cluster.longitude,
    count: cluster.count,
    color: pinColorFor(cluster),
    area: cluster.area,
    productName: cluster.productName,
  })));
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>html,body,#map{height:100%;margin:0;background:#dfe6dc}.leaflet-popup-content{font:13px system-ui;line-height:1.5}.cluster-label{font:700 12px system-ui;color:#fff;text-shadow:0 1px 3px #000}</style></head><body><div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const rows=${rows};
  const map=L.map('map').setView([-30.5595,22.9375],5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  const esc=(v)=>String(v||'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const markers={};
  rows.forEach(r=>{
    const radius=Math.min(18,9+r.count*2);
    const m=L.circleMarker([r.lat,r.lng],{radius,color:r.color,fillColor:r.color,fillOpacity:.85,weight:2}).addTo(map);
    m.bindPopup('<b>'+(r.count>1?r.count+' reports near '+esc(r.area):esc(r.productName))+'</b><br>'+esc(r.area));
    if(r.count>1)m.bindTooltip(String(r.count),{permanent:true,direction:'center',className:'cluster-label'});
    m.on('click',()=>parent.postMessage({source:'ptmap',type:'select',id:r.id},'*'));
    markers[r.id]=m;
  });
  const all=Object.values(markers);
  if(all.length){const g=L.featureGroup(all);map.fitBounds(g.getBounds().pad(0.3),{maxZoom:12});}
  window.addEventListener('message',(e)=>{
    const d=e.data||{};
    if(d.source!=='ptmap'||d.type!=='focus')return;
    const m=markers[d.id]; if(!m)return;
    map.setView(m.getLatLng(),Math.max(map.getZoom(),11),{animate:true}); m.openPopup();
  });
  </script></body></html>`;
}

// Safety Map (web). Same layout as the phone: explanation and numbers on top,
// map in the middle, report cards underneath.
export default function TrustMapScreen({ go, profile, openInvestigation }) {
  const data = useTrustMapData(profile, null);
  const { role, summary } = data;
  const clusters = summary.clusters;
  const { width, height } = useWindowDimensions();
  const mode = mapLayoutMode(height);
  const cardWidth = Math.min(width - 56, 320);
  const frameRef = useRef(null);
  const listRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const clusterKey = clusters.map((cluster) => cluster.id).join('|');

  useEffect(() => { setSelectedId(null); }, [clusterKey]);

  const focusCluster = (cluster, index, scroll) => {
    setSelectedId(cluster.id);
    frameRef.current?.contentWindow?.postMessage({ source: 'ptmap', type: 'focus', id: cluster.id }, '*');
    if (scroll) listRef.current?.scrollToOffset({ offset: index * (cardWidth + CARD_GAP), animated: true });
  };

  // A pin was clicked inside the map: select its card. Only messages from our
  // own map frame are accepted.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const msg = event.data || {};
      if (msg.source !== 'ptmap' || msg.type !== 'select') return;
      const index = clusters.findIndex((cluster) => cluster.id === msg.id);
      if (index >= 0) { setSelectedId(msg.id); listRef.current?.scrollToOffset({ offset: index * (cardWidth + CARD_GAP), animated: true }); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [clusterKey, cardWidth]);

  const openCase = (report) => {
    if (!openInvestigation || !report) return;
    const id = report.reportId || report.id;
    openInvestigation({ id, reportId: id, productName: report.productName, status: report.status, manufacturerId: report.manufacturerId || '', source: 'customer' });
  };
  const showAll = () => { data.setStatusFilter('all'); data.setTimeFilter('all'); data.setProductFilter('all'); };

  return (
    <Screen>
      <TopBar title={mapTitle(role)} onBack={() => go(dashboardForRole(role))} />
      {data.loading ? <LoadingBlock text="Loading reports…" /> : (
        <>
          <MapHeader role={role} data={data} userLocation={null} mode={mode} />
          <View style={{ flex: 1, minHeight: Math.max(mode.mapMinHeight, 200) }}>
            {/* sandbox: the map page can run its own script but cannot touch the app's data or login */}
            {React.createElement('iframe', {
              ref: frameRef,
              title: mapTitle(role),
              sandbox: 'allow-scripts',
              srcDoc: mapHtml(clusters),
              style: { flex: 1, width: '100%', height: '100%', border: 'none', minHeight: 280 },
            })}
            {data.error ? <Text style={[styles.noticeText, { padding: 12 }]}>{data.error}</Text> : null}
          </View>
          <View style={styles.mapPanel}>
            {mode.tiny ? null : <MapKey />}
            {clusters.length ? (
              <ClusterCarousel
                listRef={listRef}
                clusters={clusters}
                selectedId={selectedId}
                role={role}
                userLocation={null}
                cardWidth={cardWidth}
                onFocus={focusCluster}
                onOpenCase={openCase}
                onOpenAll={() => go('investigations')}
                onReport={() => go('report')}
              />
            ) : <EmptyMapCard role={role} filteredOut={data.totalBeforeFilters > 0} onShowAll={showAll} onReport={role === 'customer' ? () => go('report') : undefined} />}
          </View>
        </>
      )}
      <PortalNav role={role} screen="trustMap" go={go} />
    </Screen>
  );
}
