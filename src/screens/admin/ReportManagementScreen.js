import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, SecondaryButton, LoadingBlock, EmptyState, StatusPill, RestorableScrollView } from '../../components/common';
import { dateLabel, investigationLabel } from '../../utils/display';
import { adminDeleteReport, subscribeAllReports } from '../../services/adminCrudService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function ReportManagementScreen({ go, openInvestigation, openDocument }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAllReports((rows) => { setItems(rows); setLoading(false); }, () => setLoading(false)), []);

  const viewOne = (item) => openDocument('report', item, 'Admin Report');
  const viewAll = () => openDocument('reports', items, 'Product Trust Reports');

  const openCase = (item) => openInvestigation && openInvestigation({
    id: item.id, reportId: item.reportId || item.id, productName: item.productName, status: item.status,
    manufacturerId: item.manufacturerId || '', source: item.source || 'customer',
  });

  return (
    <Screen>
      <TopBar title="Report Records" onBack={() => go('back')} />
      {loading ? <LoadingBlock /> : <RestorableScrollView screenKey="adminReports" contentContainerStyle={styles.pagePad}>
        {items.length ? (
          <View style={{ marginBottom: 20, gap: 4 }}>
            <Text style={styles.h3}>{items.length} report{items.length === 1 ? '' : 's'} from customers</Text>
            <SecondaryButton title="View All Reports" icon="documents-outline" color={C.primary} onPress={viewAll} />
          </View>
        ) : null}
        {!items.length ? <EmptyState icon="flag-outline" title="No reports" text="Customer reports will appear here." /> : items.map((item) => (
          <View key={item.id} style={styles.caseCard}>
            <View style={styles.caseTop}>
              <View style={{ flex: 1, gap: 2 }}><Text style={styles.rowTitle}>{item.productName || 'Unregistered product'}</Text><Text style={styles.rowSub}>Ref: {item.reportId || item.id}</Text></View>
              <StatusPill text={investigationLabel(item.status)} />
            </View>
            <Text style={styles.body}>{item.reason || 'No reason supplied'}</Text>
            {item.details ? <Text style={styles.bodySoft}>{item.details}</Text> : null}
            <Text style={styles.rowSub}>{item.source === 'admin' ? 'Created by admin' : item.area || 'No area'} • {dateLabel(item.createdAt)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="images-outline" size={15} color={item.evidenceCount ? C.primary : C.textFaint} /><Text style={styles.rowSub}>{item.evidenceCount || item.evidenceUrls?.length || 0} photo{(item.evidenceCount || item.evidenceUrls?.length || 0) === 1 ? '' : 's'}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="map-outline" size={15} color={item.onMap || item.latitude != null ? C.primary : C.textFaint} /><Text style={styles.rowSub}>{item.onMap || item.latitude != null ? 'On the map' : 'Not on the map'}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="business-outline" size={15} color={item.manufacturerResponse ? C.cyan : C.textFaint} /><Text style={styles.rowSub}>{item.manufacturerResponse ? 'Manufacturer replied' : item.manufacturerId ? 'Awaiting manufacturer' : 'No manufacturer linked'}</Text></View>
            </View>
            {openInvestigation ? <SecondaryButton title="Open Case" icon="search-circle-outline" color={C.primary} onPress={() => openCase(item)} /> : null}
            <SecondaryButton title="View Report" icon="document-text-outline" color={C.cyan} onPress={() => viewOne(item)} />
            <SecondaryButton title="Delete Report Record" icon="trash-outline" color={C.danger} onPress={() => Alert.alert('Delete report?', 'This also deletes the linked investigation, photos and public map record.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => adminDeleteReport(item.id).catch((e) => Alert.alert('Failed', friendlyFirebaseError(e))) }])} />
          </View>
        ))}
      </RestorableScrollView>}
      <PortalNav role="admin" screen="adminReports" go={go} />
    </Screen>
  );
}
