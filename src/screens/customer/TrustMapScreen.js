import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from '../../components/map/UniversalMap';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, LoadingBlock } from '../../components/common';
import { PortalNav, dashboardForRole } from '../../components/navigation';
import { useTrustMapData } from '../../hooks/useTrustMapData';
import { CARD_GAP, ClusterCarousel, EmptyMapCard, MapHeader, MapKey, mapLayoutMode, mapTitle, statusMeta } from '../../components/map/MapPanels';
import { clusterStatusKey } from '../../utils/trustMapAnalytics';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';
import { withDeadline } from '../../utils/netFetch';

const SOUTH_AFRICA = { latitude: -30.5595, longitude: 22.9375, latitudeDelta: 10.5, longitudeDelta: 10.5 };

// Safety Map (phone). A short explanation and the key numbers on top, the map in
// the middle, and swipeable report cards underneath. Every pin has a matching
// card, and admins and manufacturers can open the full case from it.
export default function TrustMapScreen({ go, profile, openInvestigation }) {
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const data = useTrustMapData(profile, userLocation);
  const { role, summary } = data;
  const clusters = summary.clusters;
  const { width, height } = useWindowDimensions();
  const mode = mapLayoutMode(height);
  const cardWidth = Math.min(width - 56, 320);
  const mapRef = useRef(null);
  const listRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const clusterKey = clusters.map((cluster) => cluster.id).join('|');

  // Frame the map around whatever is currently being shown.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (role === 'customer' && userLocation) {
      map.animateToRegion({ ...userLocation, latitudeDelta: 0.25, longitudeDelta: 0.25 }, 500);
    } else if (!clusters.length) {
      map.animateToRegion(SOUTH_AFRICA, 400);
    } else if (clusters.length === 1) {
      map.animateToRegion({ latitude: clusters[0].latitude, longitude: clusters[0].longitude, latitudeDelta: 0.3, longitudeDelta: 0.3 }, 500);
    } else {
      map.fitToCoordinates(
        clusters.map((cluster) => ({ latitude: cluster.latitude, longitude: cluster.longitude })),
        { edgePadding: { top: 70, right: 50, bottom: 50, left: 50 }, animated: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, clusterKey, userLocation, role]);

  useEffect(() => { setSelectedId(null); }, [clusterKey]);

  const focusCluster = (cluster, index, scroll) => {
    setSelectedId(cluster.id);
    mapRef.current?.animateToRegion({ latitude: cluster.latitude, longitude: cluster.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 400);
    if (scroll) listRef.current?.scrollToOffset({ offset: index * (cardWidth + CARD_GAP), animated: true });
  };

  const locateMe = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return Alert.alert('Location is off', 'Allow location to see reports near you. You can still browse the whole map.');
      const current = await withDeadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15000, () => null);
      if (!current) return Alert.alert('Location unavailable', 'We could not find your location in time. Please try again.');
      setUserLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch (error) {
      Alert.alert('Location unavailable', friendlyFirebaseError(error));
    } finally {
      setLocating(false);
    }
  };

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
          <MapHeader role={role} data={data} userLocation={userLocation} mode={mode} />
          <View style={{ flex: 1, minHeight: mode.mapMinHeight }}>
            <MapView
              ref={mapRef}
              style={styles.fullMap}
              initialRegion={SOUTH_AFRICA}
              onMapReady={() => setMapReady(true)}
              showsUserLocation={!!userLocation}
              userLocation={userLocation}
            >
              {clusters.map((cluster, index) => {
                const meta = statusMeta(clusterStatusKey(cluster));
                return (
                  <Marker
                    key={cluster.id}
                    coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                    pinColor={meta.color}
                    title={cluster.count > 1 ? `${cluster.count} reports near ${cluster.area}` : cluster.productName}
                    description={meta.label}
                    zIndex={cluster.id === selectedId ? 10 : 1}
                    onPress={() => focusCluster(cluster, index, true)}
                  />
                );
              })}
            </MapView>
            <TouchableOpacity onPress={locateMe} disabled={locating} style={styles.mapNearMe}>
              <Icon name="locate-outline" size={16} color={C.primary} />
              <Text style={styles.mapNearMeText}>{locating ? 'Finding you…' : userLocation ? 'Update location' : 'Near me'}</Text>
            </TouchableOpacity>
            {data.error ? (
              <View style={[styles.notice, { position: 'absolute', left: 16, right: 16, bottom: 12, marginBottom: 0, backgroundColor: C.dangerBg }]}>
                <Icon name="warning-outline" color={C.danger} />
                <Text style={[styles.noticeText, { color: C.danger }]}>{data.error}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.mapPanel}>
            {mode.tiny ? null : <MapKey />}
            {clusters.length || role === 'customer' ? (
              clusters.length ? (
                <ClusterCarousel
                  listRef={listRef}
                  clusters={clusters}
                  selectedId={selectedId}
                  role={role}
                  userLocation={userLocation}
                  cardWidth={cardWidth}
                  onFocus={focusCluster}
                  onOpenCase={openCase}
                  onOpenAll={() => go('investigations')}
                  onReport={() => go('report')}
                />
              ) : <EmptyMapCard role={role} filteredOut={data.totalBeforeFilters > 0} onShowAll={showAll} onReport={() => go('report')} />
            ) : <EmptyMapCard role={role} filteredOut={data.totalBeforeFilters > 0} onShowAll={showAll} />}
          </View>
        </>
      )}
      <PortalNav role={role} screen="trustMap" go={go} />
    </Screen>
  );
}
