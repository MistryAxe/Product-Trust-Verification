import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getReportEvidence } from './reportService';
import { investigationLabel } from '../utils/display';

// Branded report documents. The same HTML is shown inside the app (preview)
// and turned into a PDF when the person chooses to share or save it.

const BRAND = 'Product Trust & Verification';
const TAGLINE = 'Product safety and verification platform';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateValue(value) {
  if (!value) return '—';
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function rowsHtml(rows = []) {
  return rows
    .filter((row) => row && row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== '' && row[1] !== '—')
    .map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('');
}

function statusChip(status) {
  const key = status || 'new';
  const tone = key === 'confirmed_issue' ? 'red' : key === 'closed_authentic' ? 'green' : 'amber';
  return `<span class="chip ${tone}">${escapeHtml(investigationLabel(key))}</span>`;
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#102014;background:#fff;font-size:13px;line-height:1.55}
.banner{background:#0D5C1A;color:#fff;padding:26px 32px 22px;border-bottom:7px solid #C9F05A}
.banner table{width:100%;border-collapse:collapse}
.banner td{vertical-align:middle;padding:0;border:0}
.logo{width:54px}
.wordmark{font-size:22px;font-weight:800;letter-spacing:.2px}
.tagline{font-size:12px;opacity:.85;margin-top:2px}
.right{text-align:right;font-size:11px;opacity:.9;line-height:1.5}
.page{padding:26px 32px 30px}
.kicker{font-size:11px;font-weight:700;letter-spacing:1.4px;color:#4E8D20;text-transform:uppercase}
h1{margin:4px 0 6px;font-size:23px;line-height:1.25}
.meta{color:#516257;font-size:12px;margin-bottom:4px}
h2{font-size:15px;margin:26px 0 10px;padding-left:10px;border-left:5px solid #C9F05A}
table.data{width:100%;border-collapse:collapse}
table.data td{padding:9px 8px;border-bottom:1px solid #e6ece6;vertical-align:top}
.label{width:34%;font-weight:700;color:#516257}
.chip{display:inline-block;padding:3px 11px;border-radius:999px;font-size:11px;font-weight:700}
.chip.green{background:#E3F4D4;color:#2F6B12}.chip.red{background:#FBE1E1;color:#B03030}.chip.amber{background:#FFF1CC;color:#7A5A00}
.box{background:#F4F8F2;border:1px solid #dbe7d6;border-radius:12px;padding:14px 16px;margin-top:6px}
.photos img{width:47%;margin:1%;border-radius:10px;border:1px solid #dbe7d6}
.card{border:1px solid #dbe7d6;border-radius:14px;padding:6px 16px 10px;margin:16px 0;page-break-inside:avoid}
.card h3{margin:12px 0 4px;font-size:15px}
.footer{margin-top:30px;padding-top:14px;border-top:1px solid #dbe7d6;font-size:10.5px;color:#718074}
`;

const LOGO = `<svg width="46" height="52" viewBox="0 0 46 52" xmlns="http://www.w3.org/2000/svg"><path d="M23 2 4 9v14c0 13 8 22 19 27 11-5 19-14 19-27V9L23 2Z" fill="#C9F05A"/><path d="m14 26 6 6 12-13" fill="none" stroke="#0D5C1A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function banner(documentLabel) {
  return `<div class="banner"><table><tr>
    <td class="logo">${LOGO}</td>
    <td><div class="wordmark">${escapeHtml(BRAND)}</div><div class="tagline">${escapeHtml(TAGLINE)}</div></td>
    <td class="right">${escapeHtml(documentLabel)}<br/>Generated ${escapeHtml(new Date().toLocaleDateString())}</td>
  </tr></table></div>`;
}

const FOOTER = `<div class="footer"><b>${escapeHtml(BRAND)}</b> — This document reflects information stored in the platform at the time it was generated. Product identity evidence and the authenticity of a physical item are separate checks. It may contain information submitted by customers and should be handled as confidential.</div>`;

function wrap(body, documentLabel, title) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${banner(documentLabel)}<div class="page">${body}${FOOTER}</div></body></html>`;
}

function reportHtml(report = {}, title = 'Product Trust Report', photos = []) {
  const reference = report.reportId || report.id || '—';
  const body = `
    <div class="kicker">Product report</div>
    <h1>${escapeHtml(report.productName || 'Unregistered product')}</h1>
    <div class="meta">Reference ${escapeHtml(reference)} &nbsp;•&nbsp; ${statusChip(report.status)}</div>

    <h2>Report details</h2>
    <table class="data">${rowsHtml([
      ['Product', report.productName || 'Unregistered product'],
      ['Barcode', report.barcode],
      ['Manufacturer', report.manufacturerName],
      ['Reason', report.reason],
      ['Store / seller', report.store],
      ['Area', report.area],
      ['Reported', dateValue(report.createdAt)],
      ['Last updated', dateValue(report.updatedAt)],
    ])}</table>

    ${report.details ? `<h2>What was reported</h2><div class="box">${escapeHtml(report.details)}</div>` : ''}
    ${photos.length ? `<h2>Photos</h2><div class="photos">${photos.map((uri) => `<img src="${escapeHtml(uri)}"/>`).join('')}</div>` : ''}
    ${report.adminNote ? `<h2>Update from Product Trust</h2><div class="box">${escapeHtml(report.adminNote)}</div>` : ''}
    ${report.manufacturerResponse ? `<h2>Response from the manufacturer</h2><div class="box">${escapeHtml(report.manufacturerResponse)}</div>` : ''}`;
  return wrap(body, 'Official report', title);
}

function reportsHtml(reports = [], title = 'Product Trust Reports') {
  const cards = reports.map((report) => `
    <div class="card">
      <h3>${escapeHtml(report.productName || 'Unregistered product')} &nbsp; ${statusChip(report.status)}</h3>
      <table class="data">${rowsHtml([
        ['Reference', report.reportId || report.id],
        ['Barcode', report.barcode],
        ['Manufacturer', report.manufacturerName],
        ['Reason', report.reason],
        ['Area', report.area],
        ['Reported', dateValue(report.createdAt)],
        ['Photos', report.evidenceCount || report.evidenceUrls?.length ? String(report.evidenceCount || report.evidenceUrls.length) : ''],
        ['Update from Product Trust', report.adminNote],
        ['Manufacturer response', report.manufacturerResponse],
      ])}</table>
    </div>`).join('');
  const body = `
    <div class="kicker">Report summary</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${reports.length} record${reports.length === 1 ? '' : 's'}</div>
    ${cards || '<div class="box">There are no records to show.</div>'}`;
  return wrap(body, 'Report summary', title);
}

// ---- Public API ------------------------------------------------------------

// Build a document for viewing inside the app. A photo problem never stops it.
export async function prepareReportDocument(report, title = 'Product Trust Report') {
  let photos = [];
  try { photos = (await getReportEvidence(report)).slice(0, 4).map((item) => item.uri); } catch (_) {}
  return { title, html: reportHtml(report, title, photos) };
}

export async function prepareReportsDocument(reports, title = 'Product Trust Reports') {
  return { title, html: reportsHtml(reports, title) };
}

// Turn a prepared document into a PDF and open the share / save sheet.
export async function shareHtmlAsPdf(html, dialogTitle = BRAND) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    await Print.printAsync({ html });
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
}

export async function exportReportPdf(report, title = 'Product Trust Report') {
  const document = await prepareReportDocument(report, title);
  return shareHtmlAsPdf(document.html, title);
}

export async function exportReportsPdf(reports, title = 'Product Trust Reports') {
  const document = await prepareReportsDocument(reports, title);
  return shareHtmlAsPdf(document.html, title);
}
