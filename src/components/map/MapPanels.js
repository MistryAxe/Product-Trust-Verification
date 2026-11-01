import React, { useState } from 'react';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from '../common';
import { clusterStatusKey, distanceKm, latestReportOf, reportTimeMs, trustMapInsight } from '../../utils/trustMapAnalytics';

// Shared building blocks for the Safety Map. The phone map and the web map both
// use these so customers, manufacturers and admins see the same clear layout.

export const STATUS_FILTERS = [
  ['all', 'All'],
  ['open', 'Under review'],
  ['confirmed', 'Confirmed'],
  ['authentic', 'Cleared'],
];

export const TIME_FILTERS = [
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['all', 'All time'],
];

export function statusMeta(key) {
  if (key === 'confirmed') return { label: 'Confirmed issue', color: C.danger, bg: C.dangerBg };
  if (key === 'authentic') return { label: 'Cleared (genuine)', color: C.success, bg: C.successBg };
  return { label: 'Under review', color: C.cyan, bg: C.cyanBg };
}

export function pinColorFor(cluster) {
  return statusMeta(clusterStatusKey(cluster)).color;
}

export function mapTitle(role) {
  if (role === 'admin') return 'Reports Map';
  if (role === 'manufacturer') return 'Reports on Your Products';
  return 'Safety Map';
}

export function mapIntro(role) {
  if (role === 'admin') return 'Every customer report that shared a location. Tap a pin or a card to open the case.';
  if (role === 'manufacturer') return 'Where customers have reported your products. Tap a pin or a card to open the case and respond.';
  return 'See where shoppers have reported suspicious or fake products. Tap a pin to see what was reported.';
}

function shortDate(report) {
  const ms = reportTimeMs(report);
  return ms ? new Date(ms).toLocaleDateString() : 'just now';
}

function Chips({ value, options, onChange }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapChipRow}>
      {options.map(([key, label]) => {
        const active = value === key;
        return (
          <TouchableOpacity key={key} onPress={() => onChange(key)} style={[styles.mapChip, active && styles.mapChipActive]}>
            <Text style={[styles.mapChipText, active && styles.mapChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Metric({ label, value, accent }) {
  return (
    <View style={styles.mapMetric}>
      <Text style={[styles.mapMetricValue, { color: accent || C.text }]}>{value}</Text>
      <Text style={styles.mapMetricLabel}>{label}</Text>
    </View>
  );
}

// How much room this phone has. The map must always leave space for the navigation bar, so on shorter phones the
// explanatory text is tucked behind the "Filters & help" button instead of using up the screen.
//   regular: very tall screens (940+ points) show everything
//   compact: nearly every phone (under 940) shows the numbers and filters; help text is one tap away
//   tiny:    small phones (under 700) show a one-line summary and hide the colour key
export function mapLayoutMode(height) {
  const h = Number(height) || 800;
  return { compact: h < 940, tiny: h < 700, mapMinHeight: h < 700 ? 140 : h < 940 ? 160 : 220 };
}

export function MapHeader({ role, data, userLocation, mode = { compact: false, tiny: false } }) {
  const [moreFilters, setMoreFilters] = useState(false);
  const { summary } = data;
  const nearMode = role === 'customer' && !!userLocation;
  const showProducts = role !== 'customer' && data.productOptions.length > 1;
  const reports = nearMode ? summary.nearbyCount : summary.total;
  const confirmed = nearMode ? summary.nearbyConfirmed : summary.confirmed;

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const intro = <Text style={styles.mapIntroText}>{mapIntro(role)}</Text>;
  const insight = <Text style={styles.mapIntroText}>{trustMapInsight(role, summary, userLocation)}</Text>;

  return (
    <View style={styles.mapHeader}>
      {!mode.compact ? intro : null}
      {mode.tiny ? (
        <Text style={[styles.mapIntroText, { fontWeight: '800' }]}>{`${plural(reports, 'report')} · ${confirmed} confirmed · ${summary.open} under review`}</Text>
      ) : (
        <View style={styles.mapMetricRow}>
          <Metric label={nearMode ? 'Reports near you' : 'Reports'} value={reports} />
          <Metric label={nearMode ? 'Confirmed near you' : 'Confirmed'} value={confirmed} accent={confirmed ? C.danger : C.textSoft} />
          <Metric label="Under review" value={summary.open} accent={summary.open ? C.cyan : C.textSoft} />
        </View>
      )}
      {!mode.compact ? insight : null}
      <Chips value={data.statusFilter} options={STATUS_FILTERS} onChange={data.setStatusFilter} />
      <TouchableOpacity onPress={() => setMoreFilters((open) => !open)} style={styles.mapMoreFilters}>
        <Icon name={moreFilters ? 'chevron-up' : 'options-outline'} size={16} color={C.primary} />
        <Text style={styles.mapMoreFiltersText}>{moreFilters ? 'Hide filters' : mode.compact ? 'Filters & help' : 'More filters'}</Text>
      </TouchableOpacity>
      {moreFilters ? (
        <View style={{ gap: 12 }}>
          {mode.compact ? <>{intro}{insight}</> : null}
          <Chips value={data.timeFilter} options={TIME_FILTERS} onChange={data.setTimeFilter} />
          {showProducts ? <Chips value={data.productFilter} options={data.productOptions} onChange={data.setProductFilter} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function MapKey() {
  return (
    <View style={styles.mapKeyRow}>
      {['open', 'confirmed', 'authentic'].map((key) => {
        const meta = statusMeta(key);
        return (
          <View key={key} style={styles.mapKeyItem}>
            <View style={[styles.mapKeyDot, { backgroundColor: meta.color }]} />
            <Text style={styles.mapKeyText}>{meta.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ClusterCard({ cluster, selected, width, role, userLocation, onPress, onOpenCase, onOpenAll }) {
  const meta = statusMeta(clusterStatusKey(cluster));
  const latest = latestReportOf(cluster);
  const away = userLocation ? distanceKm(userLocation, cluster) : null;
  const title = cluster.count > 1 ? `${cluster.count} reports near ${cluster.area}` : cluster.productName;
  const sub = cluster.count > 1 ? `Most reported: ${cluster.productName}` : cluster.area;
  const canOpen = role === 'admin' || role === 'manufacturer';

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.mapCard, selected && styles.mapCardSelected, { width }]}>
      <View style={styles.mapCardTop}>
        <View style={[styles.pill, { backgroundColor: meta.bg }]}><Text style={[styles.pillText, { color: meta.color, fontSize: 12 }]}>{meta.label}</Text></View>
        {away != null ? <Text style={styles.mapCardSub}>{away.toFixed(1)} km away</Text> : null}
      </View>
      <View style={{ gap: 3 }}>
        <Text numberOfLines={2} style={styles.mapCardTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.mapCardSub}>{sub}</Text>
        <Text style={styles.mapCardSub}>Latest report: {shortDate(latest)}</Text>
      </View>
      {canOpen ? (
        <View style={styles.mapCardActions}>
          {cluster.count === 1 && latest ? (
            <TouchableOpacity onPress={() => onOpenCase(latest)} style={styles.mapCardButton}><Text style={styles.mapCardButtonText}>Open case</Text></TouchableOpacity>
          ) : (
            <>
              {latest ? <TouchableOpacity onPress={() => onOpenCase(latest)} style={styles.mapCardButton}><Text style={styles.mapCardButtonText}>Open latest</Text></TouchableOpacity> : null}
              <TouchableOpacity onPress={onOpenAll} style={styles.mapCardButton}><Text style={styles.mapCardButtonText}>All cases</Text></TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function ReportActionCard({ width, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.mapActionCard, { width }]}>
      <Icon name="flag-outline" size={26} color={C.danger} />
      <Text style={[styles.mapCardTitle, { textAlign: 'center' }]}>Spotted something suspicious?</Text>
      <Text style={[styles.mapCardSub, { textAlign: 'center' }]}>Report a product so others can be warned.</Text>
    </TouchableOpacity>
  );
}

export function EmptyMapCard({ role, filteredOut, onShowAll, onReport }) {
  return (
    <View style={styles.mapEmpty}>
      <Icon name="map-outline" size={30} color={C.textSoft} />
      {filteredOut ? (
        <>
          <Text style={[styles.mapCardTitle, { textAlign: 'center' }]}>No reports match these filters</Text>
          <Text style={[styles.mapCardSub, { textAlign: 'center' }]}>Try a different status or a longer time range.</Text>
          <TouchableOpacity onPress={onShowAll} style={[styles.mapCardButton, { flex: 0, alignSelf: 'stretch' }]}><Text style={styles.mapCardButtonText}>Show all reports</Text></TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.mapCardTitle, { textAlign: 'center' }]}>No reports on the map yet</Text>
          <Text style={[styles.mapCardSub, { textAlign: 'center' }]}>
            {role === 'customer'
              ? 'When a shopper reports a suspicious product and shares the area, it appears here so others can be warned.'
              : role === 'manufacturer'
                ? 'When customers report one of your products and share the area, it appears here.'
                : 'When customers report a product and share the area, it appears here.'}
          </Text>
          {role === 'customer' && onReport ? <TouchableOpacity onPress={onReport} style={[styles.mapCardButton, { flex: 0, alignSelf: 'stretch' }]}><Text style={styles.mapCardButtonText}>Report a product</Text></TouchableOpacity> : null}
        </>
      )}
    </View>
  );
}

export const CARD_GAP = 12;

// Swipeable row of report cards under the map. Swiping to a card selects it
// (the map moves to that pin); tapping a pin scrolls to its card.
export function ClusterCarousel({ listRef, clusters, selectedId, role, userLocation, cardWidth, onFocus, onOpenCase, onOpenAll, onReport }) {
  const step = cardWidth + CARD_GAP;
  const items = role === 'customer' && onReport ? [...clusters, { id: '__report__', action: true }] : clusters;
  return (
    <FlatList keyboardShouldPersistTaps="handled"
      ref={listRef}
      horizontal
      data={items}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP }}
      onMomentumScrollEnd={(event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / step);
        const cluster = clusters[index];
        if (cluster && cluster.id !== selectedId) onFocus(cluster, index, false);
      }}
      renderItem={({ item, index }) => item.action ? (
        <ReportActionCard width={cardWidth} onPress={onReport} />
      ) : (
        <ClusterCard
          cluster={item}
          selected={item.id === selectedId}
          width={cardWidth}
          role={role}
          userLocation={userLocation}
          onPress={() => onFocus(item, index, false)}
          onOpenCase={onOpenCase}
          onOpenAll={onOpenAll}
        />
      )}
    />
  );
}
