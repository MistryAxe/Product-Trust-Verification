import React from 'react';
import { CameraView } from 'expo-camera';

// Camera that reads barcodes: the phone app version (iOS / Android). The website version is ScanCamera.web.js.
export const NATIVE_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128', 'code39', 'code93', 'codabar', 'qr', 'datamatrix'];

export function ScanCamera({ style, torch = false, onBarcode }) {
  return (
    <CameraView
      style={style}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: NATIVE_BARCODE_TYPES }}
      onBarcodeScanned={onBarcode}
    />
  );
}
