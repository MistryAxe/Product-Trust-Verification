import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from '../../components/map/UniversalMap';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, ProductThumb, ChoiceChips } from '../../components/common';
import { newReportId, submitProductReport } from '../../services/reportService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';
import { withDeadline } from '../../utils/netFetch';

const MAX_PHOTOS = 6;
const OTHER = 'Something else';
const REASONS = [
  'Looks fake or counterfeit',
  'Damaged or tampered packaging',
  'Expired or wrong date',
  'Ingredients or label look wrong',
  'Unsafe or made me ill',
  OTHER,
];

// If the customer typed an area but did not share GPS, place the report on the
// map at that area. Returns null when the area cannot be found.
async function locateArea(text) {
  const area = String(text || '').trim();
  if (!area) return null;
  try {
    const query = /africa/i.test(area) ? area : `${area}, South Africa`;
    const results = await withDeadline(Location.geocodeAsync(query), 5000, () => []);
    const first = results?.[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch (_) {
    return null;
  }
}

export default function ReportScreen({ uid, product, prefill, go, clearProduct }) {
  const startingReason = REASONS.includes(prefill?.reason) ? prefill.reason : prefill?.reason ? OTHER : '';
  const [reasonChoice, setReasonChoice] = useState(startingReason);
  const [reasonOther, setReasonOther] = useState(startingReason === OTHER ? prefill?.reason || '' : '');
  const [details, setDetails] = useState(prefill?.details || '');
  const [store, setStore] = useState('');
  const [area, setArea] = useState('');
  const [name, setName] = useState(product?.name || '');
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [evidence, setEvidence] = useState([]);
  const [shareOnMap, setShareOnMap] = useState(true);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  // One id for this whole form, so a slow first attempt followed by a second press never sends two reports.
  const reportIdRef = useRef(null);
  if (!reportIdRef.current) reportIdRef.current = newReportId();

  useEffect(() => {
    setName(product?.name || '');
    setBarcode(product?.barcode || '');
  }, [product]);

  const fetchLocation = async (silent = false) => {
    setLocating(true);
    setLocationNote('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationNote('Location access is off. Type the area below and we will place your report there instead.');
        if (!silent) Alert.alert('Location not shared', 'You can type the area instead and your report will still be placed on the map.');
        return;
      }
      const current = await withDeadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000, () => null);
      if (!current) {
        setLocationNote('We could not get your location in time. Type the area below instead.');
        return;
      }
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch (error) {
      setLocationNote('We could not get your location. Type the area below instead.');
      if (!silent) Alert.alert('Location error', friendlyFirebaseError(error));
    } finally {
      setLocating(false);
    }
  };

  // The report goes on the map by default, so ask for the location up front.
  useEffect(() => {
    if (shareOnMap && !location) fetchLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleShareOnMap = (value) => {
    setShareOnMap(value);
    if (value && !location) fetchLocation(true);
  };

  const pickEvidence = async (camera) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert('Permission required', 'Camera access is needed to take evidence photos.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS });
      if (!result.canceled) setEvidence((old) => [...old, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    } catch (error) {
      Alert.alert('Photo error', friendlyFirebaseError(error));
    }
  };

  const reason = reasonChoice === OTHER ? reasonOther.trim() : reasonChoice;

  const submit = async () => {
    if (!reasonChoice) return Alert.alert('Choose a reason', 'Tell us what is wrong with this product.');
    if (!reason) return Alert.alert('Describe the problem', 'Please describe what is wrong with this product.');
    if (!product && !name.trim() && !barcode.trim()) return Alert.alert('Product required', 'Enter a product name or barcode.');
    setBusy(true);
    setProgress(shareOnMap && !location && area.trim() ? 'Finding your area on the map…' : 'Sending your report…');
    try {
      let finalLocation = shareOnMap ? location : null;
      if (shareOnMap && !finalLocation) finalLocation = await locateArea(area);

      const reportProduct = product || { id: '', name: name.trim() || 'Unregistered product', barcode: barcode.trim(), manufacturerId: '' };
      const result = await submitProductReport({ uid, product: reportProduct, reason, details, store, area, location: finalLocation, evidenceUris: evidence, reportId: reportIdRef.current, onProgress: setProgress });

      const lines = [`Reference: ${result.reportId}`];
      if (result.onMap) lines.push('Your report now appears on the Safety Map. Only the general area is shown, never your exact position.');
      else if (shareOnMap) lines.push('Your report was saved but could not be placed on the map because no location was found. Next time, allow location or type the area.');
      else lines.push('Your report was saved. It is not on the map because you chose not to share a location.');
      if (result.evidenceFailed) lines.push(`${result.evidenceFailed} of your photos could not be attached.`);
      else if (result.evidenceCount) lines.push(`${result.evidenceCount} photo${result.evidenceCount === 1 ? '' : 's'} attached.`);
      lines.push('You can follow progress under My Reports.');
      Alert.alert('Report submitted', lines.join('\n\n'));
      clearProduct();
      go('myReports');
    } catch (error) {
      const code = String(error?.code || '');
      const message = code.includes('permission-denied')
        ? 'We could not send your report. Please sign out and sign in again, then try once more. If it keeps happening, contact support and mention this code: permission-denied.'
        : code === 'app/timeout' ? error.message : friendlyFirebaseError(error);
      Alert.alert('Report not sent', message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Screen>
      <TopBar title="Report a Product" onBack={() => { clearProduct(); go('back'); }} />
      <ScrollView contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Icon name="information-circle-outline" color={C.primary} />
          <Text style={styles.noticeText}>Your report goes to the Product Trust team and, if the product is registered, to its manufacturer. You can follow the outcome under My Reports.</Text>
        </View>

        {product ? (
          <View style={styles.reportProductBar}><ProductThumb /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowSub}>{product.barcode}</Text></View></View>
        ) : (
          <>
            <Input label="Product name" placeholder="Product name" autoCapitalize="words" value={name} onChangeText={setName} />
            <Input label="Barcode (if available)" placeholder="Barcode" keyboardType="number-pad" value={barcode} onChangeText={setBarcode} />
          </>
        )}

        <Text style={styles.fieldLabel}>What is wrong?</Text>
        <ChoiceChips value={reasonChoice} options={REASONS} onChange={setReasonChoice} />
        <View style={{ height: 18 }} />
        {reasonChoice === OTHER ? <Input label="Describe the problem" placeholder="What is wrong with this product?" autoCapitalize="sentences" value={reasonOther} onChangeText={setReasonOther} /> : null}
        <Input label="More details (optional)" placeholder="What did you notice?" autoCapitalize="sentences" multiline value={details} onChangeText={setDetails} />
        <Input label="Store / seller (optional)" placeholder="Where did you buy it?" autoCapitalize="words" value={store} onChangeText={setStore} />
        <Input label="Area (suburb or town)" placeholder="e.g. Sandton, Johannesburg" autoCapitalize="words" value={area} onChangeText={setArea} />

        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={[styles.bodySoft, { marginTop: -6, marginBottom: 14 }]}>Photos of the product, label or receipt help the team check your report. Up to {MAX_PHOTOS}.</Text>
        <View style={styles.twoButtons}>
          <View style={{ flex: 1 }}><SecondaryButton title="Take Photo" icon="camera-outline" onPress={() => pickEvidence(true)} disabled={evidence.length >= MAX_PHOTOS} /></View>
          <View style={{ flex: 1 }}><SecondaryButton title="Gallery" icon="images-outline" onPress={() => pickEvidence(false)} disabled={evidence.length >= MAX_PHOTOS} /></View>
        </View>
        {evidence.length ? (
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 10, paddingBottom: 10, paddingRight: 8 }}>
            {evidence.map((uri, index) => (
              <View key={`${uri}-${index}`}>
                <Image source={{ uri }} style={styles.evidenceThumb} />
                <TouchableOpacity onPress={() => setEvidence((old) => old.filter((_, i) => i !== index))} style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.sectionTitle}>Safety Map</Text>
        <View style={styles.cardPad}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Show this report on the Safety Map</Text>
              <Text style={[styles.bodySoft, { marginTop: 4 }]}>Other shoppers can see that a product was reported in this area. Only the general area is shown, never your exact position.</Text>
            </View>
            <Switch value={shareOnMap} onValueChange={toggleShareOnMap} trackColor={{ true: C.primary, false: C.border }} />
          </View>
          {shareOnMap ? (
            <View style={{ marginTop: 14, gap: 10 }}>
              {locating ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color={C.primary} /><Text style={styles.bodySoft}>Finding your location…</Text></View> : null}
              {!locating && location ? <Text style={[styles.body, { color: C.success }]}>Location added. You can move the pin below.</Text> : null}
              {!locating && !location ? <Text style={styles.bodySoft}>{locationNote || 'No location yet. Tap the button, or type the area above and we will place the report there.'}</Text> : null}
              {!locating ? <SecondaryButton title={location ? 'Update my location' : 'Use my current location'} icon="locate-outline" color={C.primary} onPress={() => fetchLocation(false)} /> : null}
            </View>
          ) : null}
        </View>
        {shareOnMap && location ? (
          <>
            <MapView
              style={styles.reportMap}
              region={{ ...location, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
              onPress={(event) => setLocation(event.nativeEvent.coordinate)}
            >
              <Marker coordinate={location} draggable onDragEnd={(event) => setLocation(event.nativeEvent.coordinate)} />
            </MapView>
            <Text style={styles.mapHint}>Tap the map or drag the pin to where you found the product.</Text>
          </>
        ) : null}

        <View style={{ height: 12 }} />
        <PrimaryButton title={busy ? 'Submitting…' : 'Submit Report'} onPress={submit} disabled={busy} color={C.danger} icon="flag-outline" />
        {busy ? <Text style={[styles.bodySoft, { textAlign: 'center', marginTop: 4 }]}>{progress || 'Working…'}{evidence.length ? ' Photos are made smaller first, so this can take a few seconds.' : ''}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
