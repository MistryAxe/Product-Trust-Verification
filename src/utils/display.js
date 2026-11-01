import { C } from '../theme/colors';
import { INVESTIGATION_STEPS } from '../constants/investigations';


export function decodeDisplayText(value = '') {
  return String(value || '')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function dateLabel(timestamp) {
  if (!timestamp) return 'Just now';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString();
}

export function riskMeta(risk) {
  if (risk === 'low') return { label: 'Low Risk', color: C.success, bg: C.successBg };
  if (risk === 'mostly_verified') return { label: 'Mostly Verified', color: C.primary, bg: C.primaryBg };
  if (risk === 'medium') return { label: 'Medium Risk', color: C.cyan, bg: C.cyanBg };
  if (risk === 'incomplete') return { label: 'Incomplete Verification', color: C.cyan, bg: C.cyanBg };
  return { label: 'High Risk', color: C.danger, bg: C.dangerBg };
}

export function scanHistoryMeta(scan = {}) {
  if (scan.verificationStage === 'verified' && scan.score !== null && scan.score !== undefined) {
    const meta = riskMeta(scan.risk);
    return { text: `${scan.score}%`, color: meta.color, bg: meta.bg };
  }
  if (['high_risk', 'invalid_gtin', 'gs1_mismatch'].includes(scan.identityStatus)) return { text: 'High Risk', color: C.danger, bg: C.dangerBg };
  if (scan.identityStatus === 'identity_verified') return { text: 'Identity Verified', color: C.success, bg: C.successBg };
  if (scan.identityStatus === 'partner_match') return { text: 'Partner Match', color: C.primary, bg: C.primaryBg };
  if (scan.identityStatus === 'external_match') return { text: 'Identity Found', color: C.primary, bg: C.primaryBg };
  if (scan.identityStatus === 'not_found') return { text: 'Not Found', color: C.cyan, bg: C.cyanBg };
  if (scan.identityStatus === 'lookup_unavailable') return { text: 'Lookup Issue', color: C.cyan, bg: C.cyanBg };
  return { text: 'Scanned', color: C.cyan, bg: C.cyanBg };
}

export function investigationLabel(status) {
  return INVESTIGATION_STEPS.find(([key]) => key === status)?.[1] || status || 'New';
}
