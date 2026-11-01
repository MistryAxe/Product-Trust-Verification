import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, SecondaryButton, PrimaryButton, Input, ProductThumb, StatusPill, InfoRow } from '../../components/common';
import { EvidenceStrip } from '../../components/reports/EvidenceStrip';
import { CaseMessages } from '../../components/reports/CaseMessages';
import { investigationLabel } from '../../utils/display';
import { INVESTIGATION_STEPS } from '../../constants/investigations';
import { adminDeleteInvestigation, adminDeleteReport } from '../../services/adminCrudService';
import { getReport, getReportPrivateLocation, saveAdminNote, saveManufacturerResponse, updateInvestigationStatus } from '../../services/reportService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
function Heading({ children }) {
  return <Text style={[styles.h3, { marginTop: 26, marginBottom: 12 }]}>{children}</Text>;
}

export default function InvestigationDetailScreen({ profile, item, go, openDocument }) {
  const isAdmin = profile.role === 'admin';
  const isManufacturer = profile.role === 'manufacturer';
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [response, setResponse] = useState('');
  const [exactLocation, setExactLocation] = useState(null);

  useEffect(() => {
    setReport(null);
    setLoadError('');
    getReport(item.reportId)
      .then((row) => {
        if (!row) { setLoadError('This report could not be found. It may have been deleted.'); return; }
        setReport(row);
        setAdminNote(row.adminNote || '');
        setResponse(row.manufacturerResponse || '');
        if (profile.role === 'admin') getReportPrivateLocation(item.reportId).then(setExactLocation);
      })
      .catch((error) => setLoadError(friendlyFirebaseError(error)));
  }, [item.reportId]);

  const changeStatus = async (status) => {
    if (!isAdmin) return Alert.alert('Admin action', 'Only administrators can change investigation status.');
    setBusy(true);
    try {
      await updateInvestigationStatus(item.reportId, status);
      setReport((old) => old ? { ...old, status } : old);
      Alert.alert('Updated', `Status changed to ${investigationLabel(status)}. The customer and the map are updated.`);
    } catch (error) {
      Alert.alert('Update failed', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  const sendAdminNote = async () => {
    if (!adminNote.trim()) return Alert.alert('Write an update', 'Enter a short message for the customer.');
    setBusy(true);
    try {
      await saveAdminNote(item.reportId, adminNote);
      setReport((old) => old ? { ...old, adminNote: adminNote.trim() } : old);
      Alert.alert('Update sent', 'The customer can now read this on their report.');
    } catch (error) {
      Alert.alert('Could not send update', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  const sendResponse = async () => {
    if (!response.trim()) return Alert.alert('Write a response', 'Enter your response to this report.');
    setBusy(true);
    try {
      await saveManufacturerResponse(item.reportId, response);
      setReport((old) => old ? { ...old, manufacturerResponse: response.trim() } : old);
      Alert.alert('Response sent', 'The Product Trust team and the customer can now read your response.');
    } catch (error) {
      Alert.alert('Could not send response', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  // Exact position: from the private record (admin only). Older reports may still carry it on the report itself.
  const legacyLocation = report && typeof report.latitude === 'number' && typeof report.longitude === 'number'
    ? { latitude: report.latitude, longitude: report.longitude } : null;
  const location = isAdmin ? (exactLocation || legacyLocation) : null;
  const hasLocation = Boolean(location);
  const onMap = Boolean(report && (report.onMap || legacyLocation));

  return (
    <Screen>
      <TopBar title="Case Details" onBack={() => go('back')} />
      <ScrollView contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <View style={styles.caseHero}>
          <ProductThumb size={70} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.h3}>{item.productName}</Text>
            <Text style={styles.rowSub}>Ref: {item.reportId}</Text>
            <StatusPill text={investigationLabel(report?.status || item.status)} />
          </View>
        </View>

        {loadError ? <View style={[styles.notice, { backgroundColor: C.dangerBg }]}><Icon name="warning-outline" color={C.danger} /><Text style={[styles.noticeText, { color: C.danger }]}>{loadError}</Text></View> : null}
        {!report && !loadError ? <ActivityIndicator color={C.primary} /> : null}

        {report ? (
          <>
            <View style={styles.cardPad}>
              <InfoRow label="Reason" value={report.reason} />
              <InfoRow label="Barcode" value={report.barcode || '—'} />
              <InfoRow label="Store" value={report.store || '—'} />
              <InfoRow label="Area" value={report.area || '—'} last={!isAdmin || !hasLocation} />
              {isAdmin && hasLocation ? <InfoRow label="Exact location" value={`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`} last /> : null}
            </View>

            {isAdmin && onMap ? <SecondaryButton title="See on the Safety Map" icon="map-outline" color={C.primary} onPress={() => go('trustMap')} /> : null}

            <Heading>What the customer said</Heading>
            <View style={styles.cardPad}><Text style={styles.body}>{report.details || 'No additional details supplied.'}</Text></View>

            <Heading>Photos</Heading>
            <EvidenceStrip report={report} size={120} emptyText="No photos were attached to this report." />
            {report.evidenceUploadFailed ? <Text style={[styles.rowSub, { color: C.danger, marginTop: 8 }]}>Some photos could not be attached by the customer.</Text> : null}

            <Heading>Updates on this case</Heading>
            <CaseMessages report={{ ...report, adminNote: isAdmin ? '' : report.adminNote, manufacturerResponse: isManufacturer ? '' : report.manufacturerResponse }} />
            {!report.adminNote && !report.manufacturerResponse && !isAdmin && !isManufacturer ? <Text style={styles.bodySoft}>No updates yet.</Text> : null}

            {isAdmin ? (
              <View style={{ marginTop: 14 }}>
                <Input label="Update for the customer" placeholder="Tell the customer what is happening with their report" autoCapitalize="sentences" multiline value={adminNote} onChangeText={setAdminNote} />
                <PrimaryButton title={busy ? 'Sending…' : report.adminNote ? 'Update message' : 'Send to customer'} icon="send-outline" onPress={sendAdminNote} disabled={busy} />
                {!report.manufacturerId ? <Text style={[styles.bodySoft, { marginTop: 4 }]}>No manufacturer is linked to this product, so there is no manufacturer to respond.</Text> : null}
              </View>
            ) : null}

            {isManufacturer ? (
              <View style={{ marginTop: 14 }}>
                <Input label="Your response" placeholder="Explain what you found or what you are doing about this report" autoCapitalize="sentences" multiline value={response} onChangeText={setResponse} />
                <PrimaryButton title={busy ? 'Sending…' : report.manufacturerResponse ? 'Update response' : 'Send response'} icon="send-outline" onPress={sendResponse} disabled={busy} />
                <Text style={[styles.bodySoft, { marginTop: 4 }]}>Your response is shown to the Product Trust team and to the customer who reported.</Text>
              </View>
            ) : null}

            <Heading>Document</Heading>
            <SecondaryButton title="View Case Report" icon="document-text-outline" color={C.cyan} onPress={() => openDocument('report', report, 'Case Report')} />

            {isAdmin ? (
              <>
                <Heading>Case status</Heading>
                {INVESTIGATION_STEPS.map(([key, label]) => (
                  <TouchableOpacity key={key} disabled={busy} onPress={() => changeStatus(key)} style={styles.statusOption}>
                    <Text style={[styles.statusOptionText, { flex: 1 }]}>{label}</Text>
                    {(report.status || item.status) === key ? <Icon name="checkmark-circle" color={C.primary} /> : <Icon name="ellipse-outline" color={C.textFaint} />}
                  </TouchableOpacity>
                ))}
                <View style={{ marginTop: 14 }}>
                  <SecondaryButton title="Delete Investigation" icon="trash-outline" color={C.danger} onPress={() => Alert.alert('Delete investigation?', item.source === 'admin' ? 'This deletes the admin-created case and its linked admin report record.' : 'The investigation case will be deleted. The original customer report is preserved.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      try {
                        if (item.source === 'admin') await adminDeleteReport(item.reportId || item.id);
                        else await adminDeleteInvestigation(item.id);
                        go('investigations');
                      } catch (e) { Alert.alert('Delete failed', friendlyFirebaseError(e)); }
                    } },
                  ])} />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <PortalNav role={profile.role} screen="investigations" go={go} />
    </Screen>
  );
}
