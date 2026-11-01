import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, EmptyState, ProductThumb, FeatureTile, StatusPill, PremiumSectionTitle, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { dateLabel, scanHistoryMeta, decodeDisplayText } from '../../utils/display';
import { subscribeScanHistory } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function CustomerDashboardScreen({ uid, profile, go, openHistoryScan }) {
  const [scans, setScans] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => subscribeScanHistory(uid, setScans, (e) => setError(friendlyFirebaseError(e)), 5), [uid]);

  const quickActions = [
    ['scan', 'scan-outline', 'Scan'],
    ['search', 'search-outline', 'Search'],
    ['ingredients', 'nutrition-outline', 'Ingredients'],
    ['compare', 'git-compare-outline', 'Quality Compare'],
  ];

  return (
    <Screen>
      <View style={styles.darkDashboardHeader}>
        <View style={styles.headerIdentity}>
          <View style={styles.avatarSmall}><Text style={styles.avatarSmallText}>{(profile?.fullName || profile?.name || 'C').charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dashboardGreeting}>Hi, {(profile?.fullName || profile?.name || 'there').split(' ')[0]}</Text>
            <Text style={styles.dashboardSub}>Verify products before you trust them.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.roundDarkButton} onPress={() => go('settings')}><Icon name="settings-outline" color={C.text} /></TouchableOpacity>
      </View>

      <RestorableScrollView screenKey="customerHome" contentContainerStyle={styles.dashboardPage} showsVerticalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={0.88} onPress={() => go('scan')} style={styles.customerScanHero}>
          <View style={styles.customerScanHeroIcon}><Icon name="scan" size={34} color={C.dark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerScanKicker}>START A VERIFICATION</Text>
            <Text style={styles.customerScanTitle}>Scan a product</Text>
          </View>
          <View style={styles.customerScanArrow}><Icon name="arrow-forward" size={18} color={C.dark} /></View>
        </TouchableOpacity>

        {profile?.allergyProfileComplete !== true ? (
          <TouchableOpacity style={styles.darkNotice} onPress={() => go('allergySetup')} activeOpacity={0.86}>
            <Icon name="nutrition-outline" color={C.primary} />
            <View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Set your allergy profile</Text><Text style={styles.darkNoticeText}>Add your allergies so food scans can personalise ingredient and allergen checks.</Text></View>
            <Icon name="chevron-forward" color={C.primary} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.quickGrid}>
          {quickActions.map(([key, icon, label]) => (
            <TouchableOpacity key={key} style={styles.quickAction} onPress={() => go(key)} activeOpacity={0.8}>
              <View style={styles.quickIcon}><Icon name={icon} size={22} color={C.dark} /></View>
              <Text style={styles.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PremiumSectionTitle eyebrow="DISCOVER" title="Explore Product Trust" />
        <FeatureTile icon="map-outline" title="Product Trust Map" subtitle="See nearby report signals, hotspots and trust activity" color={C.primary} bg={C.primaryBg} onPress={() => go('trustMap')} />
        <FeatureTile icon="flag-outline" title="Report Suspicious Product" subtitle="Submit evidence, store details and location" color={C.danger} bg={C.dangerBg} onPress={() => go('report')} />

        <PremiumSectionTitle eyebrow="YOUR ACTIVITY" title="Recent scans" action="View all" onAction={() => go('history')} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!scans.length ? (
          <EmptyState icon="scan-outline" title="No scans yet" text="Every barcode scan you complete will appear here, including partner, external and unidentified products." />
        ) : scans.map((scan) => {
          const badge = scanHistoryMeta(scan);
          return (
          <TouchableOpacity key={scan.id} onPress={() => openHistoryScan(scan)} style={styles.listRow}>
            <ProductThumb imageUrl={scan.imageUrl || ''} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{decodeDisplayText(scan.productName || 'Scanned product')}</Text><Text style={styles.rowSub}>{scan.barcode || 'No barcode'} • {dateLabel(scan.scannedAt)}</Text></View>
            <StatusPill text={badge.text} color={badge.color} bg={badge.bg} />
          </TouchableOpacity>
          );
        })}
      </RestorableScrollView>
      <PortalNav role="customer" screen="customerHome" go={go} />
    </Screen>
  );
}
