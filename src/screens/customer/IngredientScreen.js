import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, StatusPill, RestorableScrollView } from '../../components/common';
import { apiConfigured } from '../../config/api';
import { extractProductLabelExternally } from '../../services/externalApiService';
import { analyseIngredientText, saveIngredientCheck } from '../../services/ingredientService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function IngredientScreen({ uid, profile, go, onReport }) {
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [detected, setDetected] = useState([]);
  const [ocrResult, setOcrResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const chooseImage = async (camera = false) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permission required', 'Allow camera access to photograph an ingredient label.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.42, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.42, base64: true });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      setImageUri(asset?.uri || '');
      if (asset?.base64 && apiConfigured('ocrSpaceApiKey')) {
        setBusy(true);
        try {
          const ocr = await extractProductLabelExternally({ imageBase64: asset.base64 });
          setOcrResult(ocr);
          if (ocr?.fields?.ingredientsText) setText(ocr.fields.ingredientsText);
        } catch (error) {
          Alert.alert('Label reading unavailable', friendlyFirebaseError(error));
        } finally {
          setBusy(false);
        }
      }
    } catch (error) {
      Alert.alert('Image error', friendlyFirebaseError(error));
    }
  };

  const analyse = () => {
    if (!text.trim()) return Alert.alert('Ingredient text required', 'Type, paste or scan the ingredients printed on the product label.');
    setDetected(analyseIngredientText(text, profile?.allergens || [], profile?.customAllergens || []));
  };

  const save = async () => {
    if (!text.trim()) return Alert.alert('Nothing to save', 'Enter ingredient text first.');
    const currentDetected = analyseIngredientText(text, profile?.allergens || [], profile?.customAllergens || []);
    setBusy(true);
    try {
      const result = await saveIngredientCheck(uid, { ingredientText: text, detectedAllergens: currentDetected, imageUri });
      setDetected(currentDetected);
      Alert.alert('Saved', result.imageUploadFailed ? 'The ingredient check was saved, but the label image could not be uploaded.' : 'This ingredient check was saved to your account.');
    } catch (error) {
      Alert.alert('Unable to save', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Ingredient & Allergen Check" onBack={() => go('back')} />
      <RestorableScrollView screenKey="ingredients" contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Icon name="information-circle-outline" color={C.primary} />
          <Text style={styles.noticeText}>{apiConfigured('ocrSpaceApiKey') ? 'Take a clear photo of the ingredient label. Product Trust will read the text and compare it with your saved allergies. Always review the label before relying on the result.' : 'Automatic label reading is not available yet. You can still type or paste the ingredient list and check it against your saved allergies.'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Your allergen alerts</Text>
        <View style={[styles.cardPad, { marginTop: 8 }]}>
          {(profile?.allergens?.length || profile?.customAllergens?.length) ? <View style={styles.tagWrap}>{[...(profile?.allergens || []), ...(profile?.customAllergens || [])].map((a) => <StatusPill key={a} text={a} color={C.primary} bg={C.primaryBg} />)}</View> : profile?.noKnownAllergies ? <Text style={styles.bodySoft}>Your profile says you have no known food allergies.</Text> : <Text style={styles.bodySoft}>No allergy profile selected. Add it in Food Safety Profile.</Text>}
        </View>

        <View style={styles.twoButtons}>
          <View style={{ flex: 1 }}><SecondaryButton title="Take Photo" icon="camera-outline" onPress={() => chooseImage(true)} /></View>
          <View style={{ flex: 1 }}><SecondaryButton title="Gallery" icon="images-outline" onPress={() => chooseImage(false)} /></View>
        </View>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.labelImage} /> : null}
        {busy ? <View style={{ marginVertical: 10 }}><ActivityIndicator color={C.primary} /></View> : null}
        {ocrResult ? <Text style={styles.smallSoft}>Label read. Review the ingredient text below before checking allergens.</Text> : null}

        <Input
          label="Ingredient label text"
          placeholder="Type, paste or scan the ingredient list"
          autoCapitalize="sentences"
          multiline
          value={text}
          onChangeText={setText}
        />
        <PrimaryButton title="Check My Allergens" onPress={analyse} icon="nutrition-outline" />

        {text.trim() && detected.length === 0 ? (
          <View style={[styles.notice, { backgroundColor: C.successBg, marginTop: 14 }]}>
            <Icon name="checkmark-circle-outline" color={C.success} />
            <Text style={[styles.noticeText, { color: C.success }]}>No selected allergens were found in the reviewed text.</Text>
          </View>
        ) : null}
        {detected.length ? (
          <View style={[styles.notice, { backgroundColor: C.dangerBg, marginTop: 14 }]}>
            <Icon name="warning-outline" color={C.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.smallStrong, { color: C.danger }]}>Allergen warning</Text>
              <Text style={[styles.noticeText, { color: C.danger }]}>Detected: {detected.join(', ')}</Text>
            </View>
          </View>
        ) : null}
        <View style={{ marginTop: 10 }}><SecondaryButton title={busy ? 'Saving…' : 'Save Check'} onPress={save} /></View>
        {onReport ? (
          <View style={{ marginTop: 22, gap: 4 }}>
            <Text style={styles.h3}>Something wrong with this label?</Text>
            <Text style={styles.bodySoft}>If the ingredients look wrong, are missing, or the product looks fake, send it to the Product Trust team. The text you entered is included.</Text>
            <SecondaryButton
              title="Report a Concern About This Label"
              icon="flag-outline"
              color={C.danger}
              onPress={() => onReport({ reason: 'Ingredients or label look wrong', details: text.trim() ? `Ingredient label text:\n${text.trim()}` : '' })}
            />
          </View>
        ) : null}
      </RestorableScrollView>
      <PortalNav role="customer" screen="ingredients" go={go} />
    </Screen>
  );
}
