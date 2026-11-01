// Checks a barcode number typed by hand (the camera is not always available:
// damaged labels, browsers, a failed camera at the worst moment).
export function normalizeTypedBarcode(value) {
  const digits = String(value || '').replace(/[\s\-.]/g, '');
  if (!digits) return { ok: false, digits: '', message: 'Type the number printed under the barcode.' };
  if (!/^\d+$/.test(digits)) return { ok: false, digits, message: 'Use numbers only: the digits printed under the bars.' };
  if (digits.length < 8 || digits.length > 14) {
    return { ok: false, digits, message: `A barcode has 8 to 14 numbers (you typed ${digits.length}).` };
  }
  return { ok: true, digits, message: '' };
}
