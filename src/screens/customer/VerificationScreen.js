import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, PrimaryButton, SecondaryButton, StatusPill, RestorableScrollView } from '../../components/common';
import { riskMeta } from '../../utils/display';

import { PortalNav } from '../../components/navigation';
export default function VerificationScreen({ product, verification, go, setReportProduct }) {
  const meta = riskMeta(verification.risk);
  return (
    <Screen>
      <View style={[styles.resultBanner, { backgroundColor: meta.color }]}> 
        <View style={styles.resultIcon}><Icon name={verification.recall ? 'warning' : 'shield-checkmark'} size={42} color="#fff" /></View>
        <Text style={styles.resultTitle}>{verification.recall ? 'Recall Found' : 'Verification Complete'}</Text>
        <Text style={styles.resultSub}>This result uses the latest product, batch and recall information available to Product Trust.</Text>
      </View>
      <RestorableScrollView screenKey={`verification:${product?.id || product?.barcode || product?.name || 'result'}`} contentContainerStyle={styles.pagePad}>
        <View style={[styles.scoreSummary, { backgroundColor: meta.bg }]}>
          <View>
            <Text style={styles.smallSoft}>Trust score</Text>
            <Text style={[styles.bigScore, { color: meta.color }]}>{verification.score}%</Text>
            <Text style={styles.smallSoft}>Checks completed: {verification.coverage ?? 0}%</Text>
          </View>
          <StatusPill text={meta.label} color={meta.color} bg="#fff" />
        </View>

        {verification.recall ? (
          <View style={[styles.notice, { backgroundColor: C.dangerBg }]}>
            <Icon name="warning-outline" color={C.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.smallStrong, { color: C.danger }]}>Active recall</Text>
              <Text style={[styles.noticeText, { color: C.danger }]}>{verification.recall.reason || 'An active recall is registered for this product or batch.'}</Text>
              {verification.recall.recommendation ? <Text style={[styles.noticeText, { color: C.danger, marginTop: 5 }]}>{verification.recall.recommendation}</Text> : null}
            </View>
          </View>
        ) : null}

        <Text style={[styles.h3, { marginBottom: 10 }]}>Why this score?</Text>
        <View style={styles.card}>
          {verification.checks.map((check, index) => {
            const passed = check.status === 'passed';
            const notChecked = check.status === 'not_checked';
            const notApplicable = check.status === 'not_applicable';
            const color = passed ? C.success : (notChecked || notApplicable) ? C.cyan : C.danger;
            const resultText = notApplicable ? 'N/A' : notChecked ? 'Not checked' : `${Math.round(check.weight * check.value)}/${check.weight}`;
            return (
              <View key={check.key} style={[styles.verificationRow, index < verification.checks.length - 1 && styles.infoBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bodyStrong}>{check.label}</Text>
                  <Text style={styles.rowSub}>{check.detail}</Text>
                </View>
                <View style={styles.checkValue}>
                  <Icon name={passed ? 'checkmark-circle' : (notChecked || notApplicable) ? 'remove-circle-outline' : 'close-circle'} size={18} color={color} />
                  <Text style={[styles.smallStrong, { color }]}>{resultText}</Text>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.buttonStack}>
          <SecondaryButton title="Product Details" onPress={() => go('productDetails')} />
          <PrimaryButton title="Report Product" color={verification.recall ? C.danger : C.primary} onPress={() => { setReportProduct(product); go('report'); }} />
        </View>
      </RestorableScrollView>
      <PortalNav role="customer" screen="scan" go={go} />
    </Screen>
  );
}
