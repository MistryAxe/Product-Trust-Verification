import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { BrandLogo, Screen, FeatureTile, RestorableScrollView } from '../../components/common';
import { subscribeManufacturerBrand } from '../../services/brandService';
import { PortalNav } from '../../components/navigation';

export default function ProfileScreen({ profile, go }) {
  const role = profile?.role || 'customer';
  const initial = (profile?.fullName || profile?.email || '?')[0].toUpperCase();
  const [brand, setBrand] = useState(null);
  useEffect(() => (role === 'manufacturer' ? subscribeManufacturerBrand(profile?.uid, setBrand) : undefined), [role, profile?.uid]);
  return (
    <Screen>
      <View style={styles.profileHeader}>
        {role === 'manufacturer' && brand?.logoDataUri
          ? <View style={{ marginBottom: 6 }}><BrandLogo uri={brand.logoDataUri} name={profile?.organizationName} size={84} /></View>
          : <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>}
        <Text style={styles.h2Center}>{profile?.fullName || 'Account'}</Text>
        {role === 'manufacturer' && profile?.organizationName ? <Text style={styles.bodyStrong}>{profile.organizationName}</Text> : null}
        <Text style={styles.bodySoft}>{profile?.email}</Text>
      </View>
      <RestorableScrollView screenKey="profile" contentContainerStyle={styles.pagePad}>
        <FeatureTile icon="settings-outline" title="Settings" subtitle="Account, safety, privacy and appearance" onPress={() => go('settings')} />
        <FeatureTile icon="information-circle-outline" title="About Product Trust" subtitle="How Product Trust checks and explains product information" color={C.cyan} bg={C.cyanBg} onPress={() => go('about')} />
        {role === 'customer' ? (
          <>
            <FeatureTile icon="nutrition-outline" title="Food Safety Profile" subtitle={profile?.allergyProfileComplete ? 'Your saved allergies and food warnings' : 'Set your allergies so food checks can warn you'} color={C.primary} bg={C.primaryBg} onPress={() => go('allergySetup')} />
            <FeatureTile icon="time-outline" title="Scan History" subtitle="Products you have checked" onPress={() => go('history')} />
            <FeatureTile icon="flag-outline" title="My Reports" subtitle="Track reports you have submitted" color={C.danger} bg={C.dangerBg} onPress={() => go('myReports')} />
          </>
        ) : null}
      </RestorableScrollView>
      <PortalNav role={role} screen="profile" go={go} />
    </Screen>
  );
}
