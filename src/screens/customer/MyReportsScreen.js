import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, LoadingBlock, EmptyState, StatusPill, SecondaryButton, RestorableScrollView } from '../../components/common';
import { EvidenceStrip } from '../../components/reports/EvidenceStrip';
import { CaseMessages } from '../../components/reports/CaseMessages';
import { dateLabel, investigationLabel } from '../../utils/display';
import { subscribeOwnReports } from '../../services/reportService';

import { PortalNav } from '../../components/navigation';
export default function MyReportsScreen({ uid, go, openDocument }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeOwnReports(uid, (rows) => { setReports(rows); setLoading(false); }, () => setLoading(false)), [uid]);

  const viewOne = (report) => openDocument('report', report, 'Product Trust Report');
  const viewAll = () => openDocument('reports', reports, 'My Product Trust Reports');

  return (
    <Screen>
      <TopBar title="My Reports" onBack={() => go('back')} />
      {loading ? <LoadingBlock /> : (
        <RestorableScrollView screenKey="myReports" contentContainerStyle={styles.pagePad}>
          {reports.length ? (
            <View style={{ marginBottom: 20, gap: 4 }}>
              <Text style={styles.h3}>{reports.length} report{reports.length === 1 ? '' : 's'} sent</Text>
              <Text style={styles.bodySoft}>Replies from the Product Trust team and the manufacturer appear on each report.</Text>
              <SecondaryButton title="View All My Reports" icon="documents-outline" color={C.primary} onPress={viewAll} />
            </View>
          ) : null}
          {!reports.length ? <EmptyState icon="flag-outline" title="No reports yet" text="Reports you send will appear here with their current status, any photos you attached and replies from the team." /> : reports.map((report) => (
            <View key={report.id} style={styles.caseCard}>
              <View style={styles.caseTop}>
                <View style={{ flex: 1, gap: 2 }}><Text style={styles.rowTitle}>{report.productName}</Text><Text style={styles.rowSub}>Ref: {report.reportId}</Text></View>
                <StatusPill text={investigationLabel(report.status)} />
              </View>
              <Text style={styles.body}>{report.reason}</Text>
              {report.details ? <Text style={styles.bodySoft}>{report.details}</Text> : null}
              <Text style={styles.rowSub}>{report.area || 'No area given'} • {dateLabel(report.createdAt)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={report.onMap || report.latitude != null ? 'map' : 'map-outline'} size={16} color={report.onMap || report.latitude != null ? C.primary : C.textFaint} />
                <Text style={styles.rowSub}>{report.onMap || report.latitude != null ? 'Shown on the Safety Map (general area only)' : 'Not shown on the Safety Map'}</Text>
              </View>
              {report.evidenceCount || report.evidenceUrls?.length ? <EvidenceStrip report={report} /> : null}
              {report.evidenceUploadFailed ? <Text style={[styles.rowSub, { color: C.danger }]}>Some photos could not be attached to this report.</Text> : null}
              <CaseMessages report={report} />
              <SecondaryButton title="View Report" icon="document-text-outline" color={C.cyan} onPress={() => viewOne(report)} />
            </View>
          ))}
        </RestorableScrollView>
      )}
      <PortalNav role="customer" screen="myReports" go={go} />
    </Screen>
  );
}
