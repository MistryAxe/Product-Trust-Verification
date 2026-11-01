import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { ScanCamera } from '../../components/scan/ScanCamera';
import { styles } from '../../theme';
import { Icon, Screen, PrimaryButton, LoadingBlock } from '../../components/common';
import { ManualBarcodeEntry } from '../../components/scan/ManualBarcodeEntry';

export default function ScanScreen({ go, onBarcode }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [torch, setTorch] = useState(false);
  const scanLockRef = useRef(false);
  const lastScanRef = useRef({ barcode: '', at: 0 });
  const [slowCamera, setSlowCamera] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scanHint, setScanHint] = useState('Align the code inside the frame.');
  const candidateRef = useRef({ barcode: '', firstSeenAt: 0, lastSeenAt: 0, hits: 0 });

  useEffect(() => {
    if (permission) return undefined;
    const timer = setTimeout(() => setSlowCamera(true), 4000);
    return () => clearTimeout(timer);
  }, [permission]);

  useEffect(() => {
    if (!permission?.granted || locked) {
      setScannerReady(false);
      return undefined;
    }

    // Give the camera a moment to focus and the user time to place the code
    // inside the frame before barcode events are accepted.
    setScanHint('Align the code inside the frame.');
    candidateRef.current = { barcode: '', firstSeenAt: 0, lastSeenAt: 0, hits: 0 };
    const timer = setTimeout(() => {
      setScannerReady(true);
      setScanHint('Hold the code steady for a moment.');
    }, 1200);

    return () => clearTimeout(timer);
  }, [permission?.granted, locked]);

  const submitTyped = (digits) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setLocked(true);
    Promise.resolve(onBarcode(digits)).catch(() => {});
  };

  // The CameraView itself is physically clipped to the yellow frame below.
  // Older builds also compared scanner coordinates against the frame; on some
  // phones those coordinates use a different camera orientation and valid codes
  // were rejected. Keeping the camera inside the frame gives the same focused
  // experience without the unreliable second coordinate gate.
  const handle = ({ data }) => {
    const scanValue = String(data || '').trim();
    const now = Date.now();

    if (scanLockRef.current || !scannerReady) return;
    if (!scanValue) return;
    if (lastScanRef.current.barcode === scanValue && now - lastScanRef.current.at < 5000) return;

    const current = candidateRef.current;
    if (current.barcode !== scanValue) {
      candidateRef.current = { barcode: scanValue, firstSeenAt: now, lastSeenAt: now, hits: 1 };
      setScanHint('Code detected — keep it steady…');
      return;
    }

    // If detection was interrupted, start the hold-steady timer again.
    if (now - current.lastSeenAt > 500) {
      candidateRef.current = { barcode: scanValue, firstSeenAt: now, lastSeenAt: now, hits: 1 };
      setScanHint('Code detected — keep it steady…');
      return;
    }

    const nextHits = current.hits + 1;
    candidateRef.current = { ...current, lastSeenAt: now, hits: nextHits };

    // Accept only after the same code has remained visible for a short dwell.
    // This avoids the camera firing while the user is still moving/aliging it.
    if (now - current.firstSeenAt < 750 || nextHits < 2) return;

    scanLockRef.current = true;
    lastScanRef.current = { barcode: scanValue, at: now };
    candidateRef.current = { barcode: '', firstSeenAt: 0, lastSeenAt: 0, hits: 0 };
    setLocked(true);
    setScanHint('Code captured.');

    Promise.resolve(onBarcode(scanValue)).catch(() => {});
  };

  const rearmScanner = () => {
    scanLockRef.current = false;
    candidateRef.current = { barcode: '', firstSeenAt: 0, lastSeenAt: 0, hits: 0 };
    setScanHint('Align the code inside the frame.');
    setLocked(false);
  };

  if (!permission) {
    return (
      <Screen dark>
        <LoadingBlock text="Opening camera…" />
        {slowCamera ? <ManualBarcodeEntry onSubmit={submitTyped} startOpen /> : null}
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen dark>
        <View style={styles.centerFill}>
          <View style={styles.permissionIcon}><Icon name="camera-outline" size={38} color="#fff" /></View>
          <Text style={styles.cameraTitle}>Camera permission required</Text>
          <Text style={styles.cameraHelp}>Camera access is used only when you choose to scan a product code.</Text>
          <View style={{ width: '82%', marginTop: 18 }}><PrimaryButton title="Allow Camera" onPress={requestPermission} /></View>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={() => go('search')}><Text style={styles.cameraAltLink}>Search product instead</Text></TouchableOpacity>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}><ManualBarcodeEntry onSubmit={submitTyped} /></View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen dark>
      <View style={styles.cameraHeader}>
        <TouchableOpacity onPress={() => go('home')}><Icon name="arrow-back" color="#fff" /></TouchableOpacity>
        <Text style={styles.cameraHeaderText}>Place the code inside the yellow frame</Text>
        <TouchableOpacity onPress={() => setTorch((v) => !v)}><Icon name={torch ? 'flash' : 'flash-outline'} color="#fff" /></TouchableOpacity>
      </View>

      <View style={styles.cameraStage}>
        <View style={styles.scanViewport}>
          <ScanCamera
            style={StyleSheet.absoluteFill}
            torch={torch}
            onBarcode={locked || !scannerReady ? undefined : handle}
          />
          <View style={styles.scanFrame} pointerEvents="none">
            <View style={styles.scanCornerTopLeft} />
            <View style={styles.scanCornerTopRight} />
            <View style={styles.scanCornerBottomLeft} />
            <View style={styles.scanCornerBottomRight} />
            <View style={styles.scanLine} />
          </View>
        </View>

        <View style={styles.scanInstructionWrap} pointerEvents="none">
          <Text style={styles.scanInstruction}>{scanHint}</Text>
        </View>

        {locked ? (
          <View style={styles.scanPausedCard}>
            <Text style={styles.scanPausedText}>Code captured. Checking the product…</Text>
            <PrimaryButton title="Scan Again" icon="refresh-outline" onPress={rearmScanner} />
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ManualBarcodeEntry onSubmit={submitTyped} busy={locked} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
