import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from '../common';
import { getReportEvidence } from '../../services/reportService';

// Shows the photos attached to a report. Used by the customer (My Reports),
// the admin and the manufacturer so everyone sees the same evidence.
export function EvidenceStrip({ report, size = 84, emptyText = 'No photos were attached to this report.' }) {
  const reportId = report?.reportId || report?.id;
  const expected = Number(report?.evidenceCount || 0) + (Array.isArray(report?.evidenceUrls) ? report.evidenceUrls.length : 0);
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let active = true;
    setItems(null);
    setFailed(false);
    if (!expected) { setItems([]); return undefined; }
    getReportEvidence(report)
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) { setItems([]); setFailed(true); } });
    return () => { active = false; };
  }, [reportId, expected]);

  if (items === null) return <View style={{ paddingVertical: 12 }}><ActivityIndicator color={C.primary} /></View>;
  if (!items.length) {
    return <Text style={styles.bodySoft}>{failed ? 'The photos could not be loaded right now.' : emptyText}</Text>;
  }

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {items.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => setViewing(item.uri)}>
            <Image source={{ uri: item.uri }} style={[styles.evidenceThumb, { width: size, height: size }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 16 }}>
          {viewing ? <Image source={{ uri: viewing }} style={{ width: '100%', height: '78%' }} resizeMode="contain" /> : null}
          <TouchableOpacity onPress={() => setViewing(null)} style={{ alignSelf: 'center', marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <Icon name="close" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}
