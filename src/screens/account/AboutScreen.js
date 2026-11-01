import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, InfoRow, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';

// Optional: set EXPO_PUBLIC_SUPPORT_EMAIL in .env to show a support contact.
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '';

export default function AboutScreen({ go, role = 'customer' }) {
  return (
    <Screen>
      <TopBar title="About Product Trust" onBack={() => go('back')} />
      <RestorableScrollView screenKey="about" contentContainerStyle={styles.pagePad}>
        <View style={styles.productHero}>
          <View style={[styles.permissionIcon, { backgroundColor: C.primaryBg }]}><Icon name="shield-checkmark-outline" size={38} color={C.primary} /></View>
          <Text style={styles.h2Center}>Product Trust & Verification</Text>
          <Text style={[styles.bodySoft, { textAlign: 'center' }]}>Check what you buy, understand what is in it, and report anything that looks wrong.</Text>
        </View>

        <Text style={styles.sectionTitle}>What we do</Text>
        <View style={styles.cardPad}>
          <InfoRow label="Check" value="Scan a barcode and see what is known about the product." />
          <InfoRow label="Explain" value="Every detail shows where it came from. What we cannot confirm is clearly marked, never guessed." />
          <InfoRow label="Protect" value="Report suspicious, counterfeit or unsafe products so others can be warned." last />
        </View>

        <Text style={styles.sectionTitle}>Where our information comes from</Text>
        <View style={styles.cardPad}>
          <InfoRow label="Product records" value="Barcode and product information from established databases." />
          <InfoRow label="Registered products" value="Products registered directly by the companies that make them." />
          <InfoRow label="Public websites" value="Only pages that list the same barcode or clearly match the product." />
          <InfoRow label="Printed labels" value="Details read from the pack itself, when you choose to scan it." last />
        </View>

        <Text style={styles.sectionTitle}>Your privacy</Text>
        <View style={styles.notice}>
          <Icon name="lock-closed-outline" color={C.cyan} />
          <Text style={styles.noticeText}>Your location is used only when you choose to share it. Reports on the Safety Map show the general area, never your exact position.</Text>
        </View>

        <Text style={styles.sectionTitle}>Please note</Text>
        <View style={styles.notice}>
          <Icon name="information-circle-outline" color={C.primary} />
          <Text style={styles.noticeText}>Product Trust helps you make informed choices. It does not replace the information printed on the product, or advice from a health professional. If you have allergies, always read the label.</Text>
        </View>

        {SUPPORT_EMAIL ? (
          <TouchableOpacity style={styles.statusOption} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
            <View style={{ flex: 1 }}><Text style={styles.statusOptionText}>Contact support</Text><Text style={styles.rowSub}>{SUPPORT_EMAIL}</Text></View>
            <Icon name="mail-outline" color={C.primary} />
          </TouchableOpacity>
        ) : null}
      </RestorableScrollView>
      <PortalNav role={role} screen="about" go={go} />
    </Screen>
  );
}
