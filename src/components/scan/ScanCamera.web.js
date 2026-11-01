import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BarcodeDetector as ReaderBarcodeDetector, setZXingModuleOverrides } from 'barcode-detector/ponyfill';

// Camera that reads barcodes: the WEBSITE version (including the iPhone home-screen icon).
// iPhone Safari has no barcode reader of its own, so this brings one (a small program, "zxing", that runs in the page).
// Its engine file is published next to the site by `npm run deploy:web` (see scripts/prepare-web-deploy.mjs).
export const WEB_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128', 'code_39', 'code_93', 'codabar', 'qr_code', 'data_matrix'];
export const ENGINE_URL = '/zxing_reader.wasm';
const SCAN_EVERY_MS = 250;
const SAME_CODE_AGAIN_MS = 1500;

let engineConfigured = false;
function configureEngine() {
  if (engineConfigured) return;
  engineConfigured = true;
  try {
    setZXingModuleOverrides({ locateFile: (file, prefix) => (String(file).endsWith('.wasm') ? ENGINE_URL : `${prefix}${file}`) });
  } catch (_) { /* the default location is used */ }
}

// The browser's own reader when it has one (Chrome on Android), otherwise ours.
export function createDetector(scope = globalThis) {
  if (typeof scope.BarcodeDetector === 'function') {
    try { return { detector: new scope.BarcodeDetector({ formats: WEB_FORMATS }), native: true }; } catch (_) { /* fall through to ours */ }
  }
  configureEngine();
  return { detector: new ReaderBarcodeDetector({ formats: WEB_FORMATS }), native: false };
}

const MESSAGES = {
  unsupported: 'This browser cannot open the camera here. Open the site over https in Safari or Chrome, or type the barcode number below.',
  denied: 'Camera access is blocked. Allow the camera for this site in your browser settings, or type the barcode number below.',
  nocamera: 'No camera was found. Type the barcode number below.',
  reader: 'The barcode reader could not start. Check your internet connection and try again, or type the number below.',
};

export function ScanCamera({ style, torch = false, onBarcode, onError }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const handlerRef = useRef(onBarcode);
  const errorRef = useRef(onError);
  handlerRef.current = onBarcode;
  errorRef.current = onError;
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;
    let active = null;
    let busy = false;
    let failures = 0;
    let last = { value: '', at: 0 };
    const fail = (code) => { if (stopped) return; setProblem(code); if (errorRef.current) errorRef.current(code); };

    (async () => {
      const media = globalThis.navigator && globalThis.navigator.mediaDevices;
      if (!media || typeof media.getUserMedia !== 'function') { fail('unsupported'); return; }
      try {
        stream = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (error) {
        fail(/NotAllowed|Permission|Security/i.test(String((error && error.name) || error)) ? 'denied' : 'nocamera');
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      trackRef.current = (stream.getVideoTracks && stream.getVideoTracks()[0]) || null;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', 'true'); // iPhone: play inside the page instead of full screen
      try { await video.play(); } catch (_) { /* autoplay will start it */ }

      active = createDetector();
      timer = setInterval(async () => {
        if (busy || stopped || video.readyState < 2) return;
        busy = true;
        try {
          const codes = await active.detector.detect(video);
          failures = 0;
          const hit = (codes || []).find((c) => c && c.rawValue);
          if (hit) {
            const now = Date.now();
            if (hit.rawValue !== last.value || now - last.at > SAME_CODE_AGAIN_MS) {
              last = { value: hit.rawValue, at: now };
              // Only the code is sent (no position), so the scan screen accepts it wherever it is in the picture.
              if (handlerRef.current) handlerRef.current({ data: hit.rawValue, type: hit.format });
            }
          }
        } catch (_) {
          failures += 1;
          // The browser's own reader may exist but not work (some desktop browsers): switch to ours once.
          if (active.native && failures === 1) { configureEngine(); active = { detector: new ReaderBarcodeDetector({ formats: WEB_FORMATS }), native: false }; failures = 0; }
          else if (failures >= 4) { clearInterval(timer); fail('reader'); }
        } finally {
          busy = false;
        }
      }, SCAN_EVERY_MS);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop()); // release the camera (the green dot goes away)
    };
  }, []);

  // Torch (where the phone's browser supports it; iPhone Safari does not, and that is fine).
  useEffect(() => {
    const track = trackRef.current;
    if (track && typeof track.applyConstraints === 'function') track.applyConstraints({ advanced: [{ torch: Boolean(torch) }] }).catch(() => {});
  }, [torch]);

  return (
    <View style={[{ backgroundColor: '#000', overflow: 'hidden' }, style]}>
      {React.createElement('video', {
        ref: videoRef, autoPlay: true, muted: true, playsInline: true,
        style: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
      })}
      {problem ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.78)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{MESSAGES[problem] || MESSAGES.reader}</Text>
        </View>
      ) : null}
    </View>
  );
}
