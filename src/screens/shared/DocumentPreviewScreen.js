import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { C } from '../../theme';
import { Screen, TopBar, PrimaryButton } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { HtmlViewer } from '../../components/reports/HtmlViewer';
import { shareHtmlAsPdf } from '../../services/reportExportService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

// Opens a report or summary inside the app, exactly as it will look as a PDF.
export default function DocumentPreviewScreen({ document, go, role = 'customer' }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try { await shareHtmlAsPdf(document.html, document.title); }
    catch (error) { Alert.alert('Could not create the PDF', friendlyFirebaseError(error)); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar title={document?.title || 'Document'} onBack={() => go('back')} />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {document?.html ? <HtmlViewer html={document.html} /> : null}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, backgroundColor: C.bg }}>
        <PrimaryButton title={busy ? 'Preparing PDF…' : 'Share / Save as PDF'} icon="share-outline" onPress={share} disabled={busy} />
      </View>
      <PortalNav role={role} screen="documentPreview" go={go} />
    </Screen>
  );
}
