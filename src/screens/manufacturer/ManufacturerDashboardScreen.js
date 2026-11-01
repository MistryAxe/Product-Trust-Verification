import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { BrandLogo, Icon, Screen, EmptyState, LivePill, PremiumMetricCard, PremiumAction, PremiumSectionTitle, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { subscribeManufacturerMetrics } from '../../services/dashboardService';
import { subscribeManufacturerBrand } from '../../services/brandService';
import { subscribeManufacturerProducts } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function ManufacturerDashboardScreen({ uid, profile, go }) {
  const [products, setProducts] = useState([]);
  const [metrics, setMetrics] = useState({ products: 0, activeBatches: 0, openReports: 0, awaitingResponse: 0, activeRecalls: 0, scans: 0 });
  const [error, setError] = useState('');
  const [brand, setBrand] = useState(null);

  useEffect(() => subscribeManufacturerProducts(uid, setProducts, (e) => setError(friendlyFirebaseError(e))), [uid]);
  useEffect(() => subscribeManufacturerMetrics(uid, setMetrics, (e) => setError(friendlyFirebaseError(e))), [uid]);
  useEffect(() => subscribeManufacturerBrand(uid, setBrand), [uid]);

  const orgName = profile?.organizationName || profile?.fullName || profile?.name || 'Manufacturer';

  return (
    <Screen>
      <View style={styles.premiumPortalTop}>
        <BrandLogo uri={brand?.logoDataUri} name={orgName} size={52} />
        <View style={{ flex: 1 }}>
          <LivePill text="MANUFACTURER • LIVE" />
          <Text style={styles.premiumPortalGreeting}>{orgName}</Text>
          <Text style={styles.premiumPortalSub}>Your products and customer reports</Text>
        </View>
        <TouchableOpacity style={styles.premiumTopIcon} onPress={() => go('settings')}><Icon name="settings-outline" size={21} /></TouchableOpacity>
      </View>

      <RestorableScrollView screenKey="manufacturer" contentContainerStyle={styles.premiumPortalPage} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.manufacturerHero}>
          <View style={styles.manufacturerHeroGlow} />
          <View style={styles.manufacturerHeroIcon}><Icon name="business" size={27} color={C.dark} /></View>
          <Text style={styles.manufacturerHeroKicker}>PRODUCT CATALOGUE</Text>
          <Text style={styles.manufacturerHeroValue}>{Number(metrics.products || 0).toLocaleString()}</Text>
          <Text style={styles.manufacturerHeroLabel}>registered product{metrics.products === 1 ? '' : 's'}</Text>
          <TouchableOpacity style={styles.manufacturerHeroButton} onPress={() => go('manufacturerAddProduct')}>
            <Icon name="add" size={17} color={C.dark} /><Text style={styles.manufacturerHeroButtonText}>Register product</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.premiumMetricGrid}>
          <PremiumMetricCard icon="layers-outline" label="Active batches" value={metrics.activeBatches} accent={C.primary} />
          <PremiumMetricCard icon="chatbox-ellipses-outline" label="Awaiting your response" value={metrics.awaitingResponse} accent={metrics.awaitingResponse ? C.danger : C.cyan} />
          <PremiumMetricCard icon="warning-outline" label="Active recalls" value={metrics.activeRecalls} accent={C.danger} />
          <PremiumMetricCard icon="scan-outline" label="Product scans" value={metrics.scans} accent={C.cyan} />
        </View>

        <PremiumSectionTitle eyebrow="OPERATIONS" title="Manage your products" />
        <View style={styles.premiumActionGrid}>
          <TouchableOpacity style={styles.premiumSquareAction} onPress={() => go('manufacturerProducts')}>
            <View style={styles.premiumSquareIcon}><Icon name="cube-outline" size={24} color={C.dark} /></View><Text style={styles.premiumSquareTitle}>Products</Text><Text style={styles.premiumSquareSub}>View catalogue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.premiumSquareAction} onPress={() => go('manufacturerAddBatch')}>
            <View style={styles.premiumSquareIcon}><Icon name="layers-outline" size={24} color={C.dark} /></View><Text style={styles.premiumSquareTitle}>Batches</Text><Text style={styles.premiumSquareSub}>Register batch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.premiumSquareAction} onPress={() => go('manufacturerSerial')}>
            <View style={styles.premiumSquareIcon}><Icon name="qr-code-outline" size={24} color={C.dark} /></View><Text style={styles.premiumSquareTitle}>Serials</Text><Text style={styles.premiumSquareSub}>Track units</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.premiumSquareAction} onPress={() => go('manufacturerRecalls')}>
            <View style={[styles.premiumSquareIcon, { backgroundColor: C.danger }]}><Icon name="warning-outline" size={24} color="#fff" /></View><Text style={styles.premiumSquareTitle}>Recalls</Text><Text style={styles.premiumSquareSub}>Manage safety</Text>
          </TouchableOpacity>
        </View>

        <PremiumAction icon="search-circle-outline" title="Product investigations" subtitle={`${Number(metrics.openReports || 0).toLocaleString()} open customer report${metrics.openReports === 1 ? '' : 's'} linked to your organisation`} onPress={() => go('investigations')} accent={C.cyan} />
        <PremiumAction icon="map-outline" title="Report intelligence map" subtitle="See where your products are reported, clustered and confirmed" onPress={() => go('trustMap')} accent={C.cyan} />

        <PremiumSectionTitle eyebrow="CATALOGUE" title="Recent products" action="View all" onAction={() => go('manufacturerProducts')} />
        {!products.length ? (
          <EmptyState icon="cube-outline" title="No products yet" text="Your catalogue is empty. Register your first real product to start building verification records." action="Register first product" onAction={() => go('manufacturerAddProduct')} />
        ) : products.slice(0, 4).map((product) => (
          <View key={product.id} style={styles.premiumProductRow}>
            <View style={styles.premiumProductIcon}><Icon name="cube-outline" size={21} color={C.primary} /></View>
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowSub}>{product.barcode || 'No barcode'} • {product.active ? 'Active' : 'Inactive'}</Text></View>
            <View style={[styles.catalogueStatus, product.active ? styles.catalogueStatusOn : styles.catalogueStatusOff]}><Text style={styles.catalogueStatusText}>{product.active ? 'LIVE' : 'OFF'}</Text></View>
          </View>
        ))}
      </RestorableScrollView>
      <PortalNav role="manufacturer" screen="manufacturer" go={go} />
    </Screen>
  );
}
