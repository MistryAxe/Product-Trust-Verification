import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from '../common';
import { dateLabel } from '../../utils/display';

// Read-only display of the two-way updates on a case: what the Product Trust
// team wrote and what the manufacturer replied. Shown to the customer who
// reported, to the admin and to the manufacturer, so all three see one story.
export function CaseMessages({ report }) {
  const hasAdmin = Boolean(String(report?.adminNote || '').trim());
  const hasManufacturer = Boolean(String(report?.manufacturerResponse || '').trim());
  if (!hasAdmin && !hasManufacturer) return null;
  return (
    <View style={{ gap: 10 }}>
      {hasAdmin ? (
        <View style={[styles.notice, { marginBottom: 0, backgroundColor: C.primaryBg }]}>
          <Icon name="shield-checkmark-outline" color={C.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>Update from Product Trust</Text>
            <Text style={styles.body}>{report.adminNote}</Text>
            {report.adminNoteAt ? <Text style={styles.rowSub}>{dateLabel(report.adminNoteAt)}</Text> : null}
          </View>
        </View>
      ) : null}
      {hasManufacturer ? (
        <View style={[styles.notice, { marginBottom: 0, backgroundColor: C.cyanBg }]}>
          <Icon name="business-outline" color={C.cyan} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>Response from the manufacturer</Text>
            <Text style={styles.body}>{report.manufacturerResponse}</Text>
            {report.manufacturerResponseAt ? <Text style={styles.rowSub}>{dateLabel(report.manufacturerResponseAt)}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
