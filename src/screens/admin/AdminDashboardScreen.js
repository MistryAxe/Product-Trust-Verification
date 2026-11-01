import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, LivePill, PremiumMetricCard, PremiumAction, PremiumSectionTitle, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { subscribeAdminMetrics } from '../../services/dashboardService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function AdminDashboardScreen({ profile, go }) {
  const [metrics, setMetrics] = useState({ customers: 0, manufacturers: 0, admins: 0, products: 0, openReports: 0, investigations: 0, activeRecalls: 0, scans: 0, pendingGs1Reviews: 0 });
  const [error, setError] = useState('');

  useEffect(() => subscribeAdminMetrics(setMetrics, (e) => setError(friendlyFirebaseError(e))), []);

  const adminName = (profile?.fullName || profile?.name || 'Admin').split(' ')[0];

  return (
    <Screen>
      <View style={styles.premiumPortalTop}>
        <View style={{ flex: 1 }}>
          <LivePill text="ADMIN CONTROL • LIVE" />
          <Text style={styles.premiumPortalGreeting}>Hi, {adminName}</Text>
          <Text style={styles.premiumPortalSub}>Platform overview</Text>
        </View>
        <TouchableOpacity style={styles.premiumTopIcon} onPress={() => go('settings')}><Icon name="settings-outline" size={21} /></TouchableOpacity>
      </View>

      <RestorableScrollView screenKey="admin" contentContainerStyle={styles.premiumPortalPage} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.adminHero}>
          <View style={styles.adminHeroOrbOne} /><View style={styles.adminHeroOrbTwo} />
          <View style={styles.adminHeroTopRow}><View><Text style={styles.adminHeroKicker}>NEEDS ATTENTION</Text><Text style={styles.adminHeroTitle}>Reports</Text></View><View style={styles.adminShield}><Icon name="shield-checkmark" size={28} color={C.dark} /></View></View>
          <Text style={styles.adminHeroNumber}>{Number(metrics.openReports || 0).toLocaleString()}</Text>
          <Text style={styles.adminHeroLabel}>customer report{Number(metrics.openReports || 0) === 1 ? '' : 's'} waiting for review</Text>
          <View style={styles.adminHeroMiniRow}>
            <View style={styles.adminHeroMini}><Icon name="scan-outline" size={16} color={C.primary} /><Text style={styles.adminHeroMiniValue}>{Number(metrics.scans || 0).toLocaleString()}</Text><Text style={styles.adminHeroMiniLabel}>scans</Text></View>
            <View style={styles.adminHeroMini}><Icon name="warning-outline" size={16} color={C.danger} /><Text style={styles.adminHeroMiniValue}>{Number(metrics.activeRecalls || 0).toLocaleString()}</Text><Text style={styles.adminHeroMiniLabel}>recalls</Text></View>
            <View style={styles.adminHeroMini}><Icon name="cube-outline" size={16} color={C.cyan} /><Text style={styles.adminHeroMiniValue}>{Number(metrics.products || 0).toLocaleString()}</Text><Text style={styles.adminHeroMiniLabel}>products</Text></View>
          </View>
        </View>

        <View style={styles.premiumMetricGrid}>
          <PremiumMetricCard icon="person-outline" label="Customers" value={metrics.customers} accent={C.primary} />
          <PremiumMetricCard icon="business-outline" label="Manufacturers" value={metrics.manufacturers} accent={C.cyan} />
          <PremiumMetricCard icon="cube-outline" label="Products" value={metrics.products} accent={C.success} />
          <PremiumMetricCard icon="flag-outline" label="Open reports" value={metrics.openReports} accent={C.cyan} />
        </View>

        <TouchableOpacity style={styles.adminPriorityCard} activeOpacity={0.86} onPress={() => go('investigations')}>
          <View style={styles.adminPriorityIcon}><Icon name="search-circle" size={27} color={C.dark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminPriorityKicker}>INVESTIGATION QUEUE</Text>
            <Text style={styles.adminPriorityValue}>{Number(metrics.investigations || 0).toLocaleString()} investigation{metrics.investigations === 1 ? '' : 's'}</Text>
            <Text style={styles.adminPrioritySub}>Open the case workspace to review reports, evidence and decisions.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={C.dark} />
        </TouchableOpacity>

        <PremiumSectionTitle eyebrow="PLATFORM TOOLS" title="Administration" />
        <View style={styles.adminToolGrid}>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminUsers')}><View style={styles.adminToolIcon}><Icon name="people-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Users & Roles</Text><Text style={styles.adminToolSub}>Create, edit, disable and remove accounts</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminProducts')}><View style={styles.adminToolIcon}><Icon name="cube-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Products</Text><Text style={styles.adminToolSub}>Create, edit and delete products</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminBatches')}><View style={styles.adminToolIcon}><Icon name="layers-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Batches</Text><Text style={styles.adminToolSub}>Full batch CRUD workspace</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminRecalls')}><View style={[styles.adminToolIcon, { backgroundColor: C.danger }]}><Icon name="warning-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Recalls</Text><Text style={styles.adminToolSub}>Create, update and close recalls</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminSerials')}><View style={styles.adminToolIcon}><Icon name="qr-code-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Serials</Text><Text style={styles.adminToolSub}>Individual-unit registry</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminReports')}><View style={styles.adminToolIcon}><Icon name="flag-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Reports</Text><Text style={styles.adminToolSub}>Review and remove report records</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('adminManufacturers')}><View style={styles.adminToolIcon}><Icon name="business-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Manufacturers</Text><Text style={styles.adminToolSub}>Edit organisations and access</Text></TouchableOpacity>
          <TouchableOpacity style={styles.adminToolCard} onPress={() => go('trustMap')}><View style={styles.adminToolIcon}><Icon name="map-outline" size={23} color={C.dark} /></View><Text style={styles.adminToolTitle}>Trust Map</Text><Text style={styles.adminToolSub}>Hotspots & report intelligence</Text></TouchableOpacity>
        </View>

        <PremiumAction icon="barcode-outline" title="Barcode ownership checks" subtitle={`${Number(metrics.pendingGs1Reviews || 0).toLocaleString()} barcode${metrics.pendingGs1Reviews === 1 ? '' : 's'} waiting to be checked against the barcode owner records`} onPress={() => go('adminGs1')} accent={C.primary} />
      </RestorableScrollView>
      <PortalNav role="admin" screen="admin" go={go} />
    </Screen>
  );
}
