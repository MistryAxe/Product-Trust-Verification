import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { BrandLogo, SecondaryButton } from '../common';
import { compressLogoToDataUri } from '../../services/storageService';
import { removeManufacturerBrand, saveManufacturerBrand, subscribeManufacturerBrand } from '../../services/brandService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

// Lets a manufacturer add its company logo. The logo is shown on its dashboard
// and profile, and to customers on the product pages of its registered products.
export function CompanyLogoEditor({ uid, organizationName }) {
  const [brand, setBrand] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeManufacturerBrand(uid, setBrand), [uid]);

  const choose = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled) return;
      setBusy(true);
      const logoDataUri = await compressLogoToDataUri(result.assets[0].uri);
      await saveManufacturerBrand(uid, { name: organizationName, logoDataUri });
    } catch (error) {
      Alert.alert('Could not save the logo', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => Alert.alert('Remove logo?', 'Your products will show your company name without a logo.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => removeManufacturerBrand(uid).catch((error) => Alert.alert('Could not remove the logo', friendlyFirebaseError(error))) },
  ]);

  return (
    <View style={[styles.cardPad, { gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <BrandLogo uri={brand?.logoDataUri} name={organizationName} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.rowTitle}>Company logo</Text>
          <Text style={styles.bodySoft}>Shown on your dashboard and profile, and to customers on your registered products.</Text>
        </View>
      </View>
      <SecondaryButton title={busy ? 'Saving…' : brand?.logoDataUri ? 'Change logo' : 'Choose logo'} icon="image-outline" color={C.primary} onPress={choose} disabled={busy} />
      {brand?.logoDataUri ? <SecondaryButton title="Remove logo" icon="trash-outline" color={C.danger} onPress={remove} disabled={busy} /> : null}
    </View>
  );
}
