import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, EmptyState, StatusPill, InfoRow } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { VERIFIED_BY_GS1_URL, gs1StatusLabel, saveGs1Verification, subscribeGs1ReviewQueue, subscribeGs1Verifications } from '../../services/gs1Service';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function GS1ReviewScreen({ uid, go }) {
  const [requests, setRequests] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('verified');
  const [licensedCompany, setLicensedCompany] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [countryOfSale, setCountryOfSale] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stopRequests = subscribeGs1ReviewQueue(setRequests, (e) => setError(friendlyFirebaseError(e)));
    const stopVerifications = subscribeGs1Verifications(setVerifications, (e) => setError(friendlyFirebaseError(e)));
    return () => { stopRequests?.(); stopVerifications?.(); };
  }, []);

  const existingFor = (barcode) => verifications.find((row) => row.barcode === barcode || row.id === barcode) || null;
  const pending = requests.filter((row) => row.status !== 'reviewed');

  const startReview = (item) => {
    const existing = existingFor(item.barcode);
    setSelected(item);
    setStatus(existing?.status || 'verified');
    setLicensedCompany(existing?.licensedCompany || '');
    setProductDescription(existing?.productDescription || item.productName || '');
    setBrand(existing?.brand || item.brand || '');
    setCountryOfSale(existing?.countryOfSale || '');
    setNotes(existing?.notes || '');
  };

  const save = async () => {
    if (!selected?.barcode) return;
    if (status === 'verified' && !licensedCompany.trim()) {
      return Alert.alert('Licensed company required', 'When you mark a GTIN as verified, record the company shown by Verified by GS1.');
    }
    setBusy(true);
    try {
      await saveGs1Verification(uid, {
        barcode: selected.barcode,
        status,
        licensedCompany,
        productDescription,
        brand,
        countryOfSale,
        notes,
      });
      Alert.alert('GS1 review saved', 'Future customer scans of this GTIN will automatically use the stored GS1 ownership evidence.');
      setSelected(null);
    } catch (e) {
      Alert.alert('Unable to save GS1 review', friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  const openVerifiedByGs1 = async () => {
    try { await Linking.openURL(VERIFIED_BY_GS1_URL); }
    catch (_) { Alert.alert('Unable to open GS1', 'Open Verified by GS1 in your browser and search the barcode shown on this screen.'); }
  };

  if (selected) {
    return (
      <Screen>
        <TopBar title="Manual GS1 Review" onBack={() => setSelected(null)} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>

          <Text style={styles.h3}>GTIN to review</Text>
          <View style={styles.cardPad}>
            <InfoRow label="Barcode / GTIN" value={selected.barcode} />
            <InfoRow label="Product seen by Product Trust" value={selected.productName || 'Not identified'} />
            <InfoRow label="Brand seen by Product Trust" value={selected.brand || 'Not identified'} last />
          </View>

          <SecondaryButton title="Open Verified by GS1" icon="open-outline" color={C.primary} onPress={openVerifiedByGs1} />
          <Text style={[styles.smallSoft, { marginVertical: 10 }]}>In GS1, search the GTIN above. Return here and record only what the official GS1 result actually shows. Do not guess missing information.</Text>

          <Text style={styles.h3}>Review result</Text>
          <View style={styles.tagWrap}>
            {[
              ['verified', 'Verified'],
              ['not_found', 'Not found'],
              ['mismatch', 'Mismatch'],
              ['review_required', 'Needs review'],
            ].map(([value, label]) => {
              const active = status === value;
              return <TouchableOpacity key={value} onPress={() => setStatus(value)} style={[styles.choiceTag, active && { backgroundColor: C.primaryBg, borderColor: C.primary }]}><Text style={[styles.choiceTagText, active && { color: C.primary }]}>{label}</Text></TouchableOpacity>;
            })}
          </View>

          <Input label="Licensed company" placeholder="Company shown by Verified by GS1" value={licensedCompany} onChangeText={setLicensedCompany} />
          <Input label="GS1 product description" placeholder="Product description shown by GS1" value={productDescription} onChangeText={setProductDescription} />
          <Input label="GS1 brand" placeholder="Brand shown by GS1" value={brand} onChangeText={setBrand} />
          <Input label="Country of sale" placeholder="If provided by GS1" value={countryOfSale} onChangeText={setCountryOfSale} />
          <Input label="Admin review notes" placeholder="Explain any mismatch or uncertainty" multiline value={notes} onChangeText={setNotes} />
          <PrimaryButton title={busy ? 'Saving review…' : 'Save GS1 Evidence'} disabled={busy} onPress={save} icon="shield-checkmark-outline" />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Barcode Ownership Checks" onBack={() => go('back')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.notice}>
          <Icon name="information-circle-outline" color={C.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>What is this?</Text>
            <Text style={styles.noticeText}>GS1 is the global organisation that issues product barcodes to companies. When a customer scans a barcode we cannot match, it is listed here. Look it up on the Verified by GS1 website, then record which company owns it. Later scans of that barcode will show your result.</Text>
          </View>
        </View>

        <Text style={[styles.h3, { marginBottom: 12 }]}>Barcodes waiting to be checked</Text>
        {!pending.length ? <EmptyState icon="shield-checkmark-outline" title="Nothing waiting" text="New external or manufacturer product scans will create review requests automatically." /> : pending.map((item) => (
          <TouchableOpacity key={item.id} style={styles.listRow} onPress={() => startReview(item)} activeOpacity={0.85}>
            <View style={[styles.avatarSmall, { backgroundColor: C.primaryBg }]}><Icon name="barcode-outline" size={18} color={C.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.productName || 'GTIN awaiting review'}</Text>
              <Text style={styles.rowSub}>{item.brand || 'Brand not identified'} • {item.barcode} • {item.requestCount || 1} scan request{Number(item.requestCount || 1) === 1 ? '' : 's'}</Text>
            </View>
            <StatusPill text="Pending" color={C.cyan} bg={C.surface3} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.h3, { marginTop: 18 }]}>Stored GS1 evidence</Text>
        {!verifications.length ? <EmptyState icon="server-outline" title="No GS1 evidence stored" text="Completed manual checks will appear here and automatically influence future scan results." /> : verifications.slice(0, 50).map((item) => {
          const danger = item.status === 'mismatch';
          const success = item.status === 'verified';
          const color = danger ? C.danger : success ? C.success : C.cyan;
          const bg = danger ? C.dangerBg : success ? C.successBg : C.surface3;
          return (
            <View key={item.id} style={styles.listRow}>
              <View style={[styles.avatarSmall, { backgroundColor: bg }]}><Icon name={success ? 'shield-checkmark-outline' : danger ? 'warning-outline' : 'help-circle-outline'} size={18} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.licensedCompany || item.productDescription || item.barcode}</Text>
                <Text style={styles.rowSub}>{item.barcode} • {gs1StatusLabel(item.status)}</Text>
              </View>
              <StatusPill text={success ? 'Verified' : danger ? 'Mismatch' : 'Reviewed'} color={color} bg={bg} />
            </View>
          );
        })}
      </ScrollView>
      <PortalNav role="admin" screen="admin" go={go} />
    </Screen>
  );
}
