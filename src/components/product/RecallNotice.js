import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from '../common';

// How sure we are, in plain words.
export function recallConfidenceText(item) {
  if (item?.batchMatch) return 'Your batch number appears in this notice.';
  if (item?.matchType === 'barcode') return 'This barcode is listed in the notice.';
  if (item?.old) return `Same brand and product name, but this notice is old${item?.date ? ` (${String(item.date).slice(0, 4)})` : ''}. It probably does not apply to a product bought today. Check the batch or lot printed on your pack.`;
  return 'Same brand and product name. This is a possible match, so check the batch or lot printed on your pack.';
}

const openLink = (url) => { if (/^https?:\/\//i.test(String(url || ''))) Linking.openURL(url).catch(() => {}); };

// One honest recall card. It shows one of three things, and never mixes them up:
//   a recall was found  /  nothing was found (and where we looked)  /  we could not check at all.
export function RecallNotice({ check }) {
  if (!check) return null;

  if (check.checked === false) {
    return (
      <View style={[styles.notice, { backgroundColor: C.surface2 }]}>
        <Icon name="information-circle-outline" color={C.textSoft} />
        <Text style={[styles.noticeText, { color: C.textSoft }]}>We could not check recalls right now, so we cannot say whether this product has been recalled. Try again in a little while.</Text>
      </View>
    );
  }

  if (!check.hasMatch) {
    const where = (check.sourcesChecked || []).join(', ');
    return (
      <View style={[styles.notice, { backgroundColor: C.successBg }]}>
        <Icon name="shield-checkmark-outline" color={C.success} />
        <Text style={[styles.noticeText, { color: C.success }]}>
          {`No recall notice found${where ? ` in ${where}` : ''}. This is not a guarantee: always check the batch or lot printed on your pack.`}
        </Text>
      </View>
    );
  }

  const items = (check.matches || []).slice(0, 3);
  const strong = items.some((item) => item?.confidence === 'high' || item?.matchType === 'barcode' || item?.batchMatch);
  // Only old name-matches: a softer amber card (it is information, not an alarm). Anything recent or exact stays red.
  const allOld = !strong && items.length > 0 && items.every((item) => item?.old === true);
  const accent = allOld ? C.warning : C.danger;
  return (
    <View style={[styles.notice, { backgroundColor: allOld ? C.warningBg : C.dangerBg, borderWidth: 1, borderColor: accent, flexDirection: 'column', gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={allOld ? 'time-outline' : 'warning-outline'} color={accent} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '900', color: accent }}>{strong ? 'Recall notice found' : allOld ? 'Older recall notice found' : 'Possible recall found'}</Text>
      </View>
      {check.summary ? <Text style={[styles.noticeText, { color: C.text }]}>{check.summary}</Text> : null}
      {items.map((item, index) => (
        <View key={item?.id || index} style={{ gap: 4, paddingTop: 8, borderTopWidth: index ? 1 : 0, borderTopColor: accent }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{item?.title || 'Recall notice'}</Text>
          <Text style={styles.bodySoft}>{[item?.sourceName, item?.country, item?.date].filter(Boolean).join(' · ')}</Text>
          {item?.reason ? <Text style={styles.bodySoft}>{item.reason}</Text> : null}
          <Text style={[styles.bodySoft, { color: C.text }]}>{recallConfidenceText(item)}</Text>
          {item?.scope ? <Text style={styles.bodySoft}>{item.scope}</Text> : null}
          {item?.url ? (
            <TouchableOpacity onPress={() => openLink(item.url)} accessibilityRole="link">
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.primary, marginTop: 2 }}>Read the notice</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
}
