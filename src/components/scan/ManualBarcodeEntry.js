import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { PrimaryButton } from '../common';
import { normalizeTypedBarcode } from '../../utils/typedBarcode';

// "Can't scan? Type the number." Works with or without a camera.
export function ManualBarcodeEntry({ onSubmit, busy = false, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const result = normalizeTypedBarcode(value);
    if (!result.ok) { setError(result.message); return; }
    setError('');
    onSubmit(result.digits);
  };

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} style={{ alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
        <Text style={styles.cameraAltLink}>Can’t scan? Type the barcode number</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', gap: 10 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Type the barcode number</Text>
      <TextInput
        value={value}
        onChangeText={(text) => { setValue(text); if (error) setError(''); }}
        keyboardType="number-pad"
        returnKeyType="search"
        maxLength={20}
        placeholder="e.g. 6001234567890"
        placeholderTextColor="rgba(255,255,255,0.55)"
        onSubmitEditing={submit}
        style={{ color: '#FFFFFF', fontSize: 20, letterSpacing: 2, fontWeight: '700', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(0,0,0,0.35)' }}
      />
      {error ? <Text style={{ color: '#FFB4B4', fontSize: 13 }}>{error}</Text> : null}
      <PrimaryButton title={busy ? 'Checking…' : 'Check this product'} icon="search-outline" onPress={submit} disabled={busy} />
      <TouchableOpacity onPress={() => { setOpen(false); setError(''); }} style={{ alignSelf: 'center', paddingVertical: 6 }}>
        <Text style={styles.cameraAltLink}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}
