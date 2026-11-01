import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, ProductSelector } from '../../components/common';
import { createRecall, subscribeManufacturerProducts } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function CreateRecallScreen({ uid, go }) {
  const [products, setProducts] = useState([]);
  const [index, setIndex] = useState(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [reason, setReason] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeManufacturerProducts(uid, setProducts, () => {}), [uid]);
  const product = products[index];

  const submit = async () => {
    if (!product) return Alert.alert('No product', 'Register a product first.');
    if (!reason.trim()) return Alert.alert('Reason required', 'Enter the recall reason.');
    setBusy(true);
    try {
      await createRecall(uid, { productId: product.id, productName: product.name, batchNumber, reason, recommendation });
      Alert.alert('Recall created', 'Customer verifications will now detect this active recall.');
      go('manufacturer');
    } catch (error) {
      Alert.alert('Unable to create recall', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <TopBar title="Create Recall" onBack={() => go('back')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        <ProductSelector products={products} index={index} setIndex={setIndex} />
        <Input label="Affected batch" placeholder="Optional batch number" autoCapitalize="characters" value={batchNumber} onChangeText={setBatchNumber} />
        <Input label="Reason *" placeholder="Recall reason" autoCapitalize="sentences" multiline value={reason} onChangeText={setReason} />
        <Input label="Recommendation" placeholder="What should customers do?" autoCapitalize="sentences" multiline value={recommendation} onChangeText={setRecommendation} />
        <PrimaryButton title={busy ? 'Publishing…' : 'Create Active Recall'} onPress={submit} disabled={busy} color={C.danger} />
      </ScrollView>
      <PortalNav role="manufacturer" screen="manufacturerRecall" go={go} />
    </Screen>
  );
}
