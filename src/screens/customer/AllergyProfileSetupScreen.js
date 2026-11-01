import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, RestorableScrollView } from '../../components/common';
import { COMMON_ALLERGENS } from '../../services/ingredientService';
import { updateUserSettings } from '../../services/userService';
import { logout } from '../../services/authService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function AllergyProfileSetupScreen({ uid, profile, refreshProfile, go, onSkip }) {
  const [allergens, setAllergens] = useState(profile?.allergens || []);
  const [customText, setCustomText] = useState((profile?.customAllergens || []).join(', '));
  const [noKnownAllergies, setNoKnownAllergies] = useState(!!profile?.noKnownAllergies);
  const [busy, setBusy] = useState(false);

  const toggle = (item) => {
    setNoKnownAllergies(false);
    setAllergens((old) => old.includes(item) ? old.filter((x) => x !== item) : [...old, item]);
  };

  const save = async () => {
    const customAllergens = customText.split(',').map((item) => item.trim()).filter(Boolean);
    if (!noKnownAllergies && !allergens.length && !customAllergens.length) {
      return Alert.alert('Choose an option', 'Select your allergies, add a custom allergy, or choose “I have no known food allergies”.');
    }
    setBusy(true);
    try {
      await updateUserSettings(uid, {
        allergens: noKnownAllergies ? [] : allergens,
        customAllergens: noKnownAllergies ? [] : customAllergens,
        noKnownAllergies,
        allergyProfileComplete: true,
      });
      await refreshProfile();
      go('home');
    } catch (error) {
      Alert.alert('Unable to save', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  const markNone = () => {
    setNoKnownAllergies(true);
    setAllergens([]);
    setCustomText('');
  };

  // Before the profile is finished there is nowhere to go back to, so the arrow offers to sign out instead of being a dead end.
  const leaveSetup = () => {
    Alert.alert('Leave setup?', 'You can finish your food safety profile the next time you sign in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout().catch(() => {}) },
    ]);
  };

  return (
    <Screen>
      <TopBar title="Food Safety Profile" onBack={profile?.allergyProfileComplete ? () => go('back') : leaveSetup} />
      <RestorableScrollView screenKey="allergySetup" contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <View style={styles.darkNotice}>
          <Icon name="nutrition-outline" color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.darkNoticeTitle}>Tell Product Trust what to watch for</Text>
            <Text style={styles.darkNoticeText}>Your saved allergies are compared with product ingredients, allergen warnings, possible traces and text read from the physical label.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Common food allergies</Text>
        <View style={[styles.tagWrap, { marginVertical: 12 }]}>
          {COMMON_ALLERGENS.map((item) => {
            const selected = allergens.includes(item);
            return (
              <TouchableOpacity key={item} onPress={() => toggle(item)} style={[styles.choiceTag, selected && { backgroundColor: C.primaryBg, borderColor: C.primary }]}>
                <Text style={styles.choiceTagText}>{selected ? '✓ ' : ''}{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Other allergies (comma separated)"
          placeholder="e.g. Kiwi, Lupin"
          value={customText}
          onChangeText={(value) => { setCustomText(value); if (value.trim()) setNoKnownAllergies(false); }}
        />

        <TouchableOpacity onPress={markNone} style={[styles.settingRow, noKnownAllergies && { borderColor: C.primary, backgroundColor: C.primaryBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bodyStrong}>I have no known food allergies</Text>
            <Text style={styles.rowSub}>Choose this only if it accurately reflects your current allergy information.</Text>
          </View>
          <Icon name={noKnownAllergies ? 'checkmark-circle' : 'ellipse-outline'} color={noKnownAllergies ? C.primary : C.textFaint} />
        </TouchableOpacity>

        <Text style={styles.safetyFootnote}>Product Trust supports product-information checks. Always confirm food allergies against the physical label and your medical guidance.</Text>

        <PrimaryButton title={busy ? 'Saving…' : 'Save Food Safety Profile'} icon="shield-checkmark-outline" onPress={save} disabled={busy} />
        {!profile?.allergyProfileComplete && onSkip ? <SecondaryButton title="Skip for now" onPress={onSkip} /> : null}
      </RestorableScrollView>
    </Screen>
  );
}
