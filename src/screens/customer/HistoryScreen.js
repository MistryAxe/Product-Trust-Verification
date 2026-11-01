import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Screen, TopBar, LoadingBlock, EmptyState, ProductThumb, StatusPill, RestorableScrollView } from '../../components/common';
import { dateLabel, scanHistoryMeta, decodeDisplayText } from '../../utils/display';
import { subscribeScanHistory } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function HistoryScreen({ uid, go, openHistoryScan }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => subscribeScanHistory(uid, (items) => { setScans(items); setLoading(false); }, (e) => { setError(friendlyFirebaseError(e)); setLoading(false); }), [uid]);

  return (
    <Screen>
      <TopBar title="Scan History" onBack={() => go('back')} />
      {loading ? <LoadingBlock /> : (
        <RestorableScrollView screenKey="history" contentContainerStyle={styles.pagePad}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!scans.length ? <EmptyState title="No scan history" text="Every completed barcode scan is saved to your account so you can open it again later." /> : scans.map((scan) => {
            const badge = scanHistoryMeta(scan);
            return (
            <TouchableOpacity key={scan.id} onPress={() => openHistoryScan(scan)} style={styles.listRow}>
              <ProductThumb imageUrl={scan.imageUrl || ''} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{decodeDisplayText(scan.productName || 'Scanned product')}</Text>
                <Text style={styles.rowSub}>{scan.barcode || 'No barcode'} • {dateLabel(scan.scannedAt)}{scan.coverage != null ? ` • ${scan.coverage}% coverage` : ''}</Text>
                {scan.sourceLabel ? <Text style={styles.dataSourceText}>{scan.sourceLabel}</Text> : null}
              </View>
              <StatusPill text={badge.text} color={badge.color} bg={badge.bg} />
            </TouchableOpacity>
            );
          })}
        </RestorableScrollView>
      )}
      <PortalNav role="customer" screen="history" go={go} />
    </Screen>
  );
}
