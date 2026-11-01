// Product Trust & Verification: email sign-in code service (Cloudflare Worker).
//
//   POST /send    the signed-in customer asks for a 6-digit code to be emailed to them
//   POST /verify  the customer types the code; resolves { verified: true } when correct
//   GET  /health  { ok: true }
//
// Every call must carry the customer's Firebase login token:  Authorization: Bearer <ID token>.
// The Worker checks that token itself, so nobody can request or test codes for someone else.
// Codes live 10 minutes, allow 5 wrong tries, one new code per 30 seconds, at most 6 per hour.
// Only a salted hash of each code is stored. Runs on Cloudflare's free plan (Workers + D1)
// and sends mail through Brevo's free plan.

const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Safety limits. The defaults are the real values; the optional environment overrides exist only so tests need not wait minutes.
const DEFAULTS = { CODE_TTL_MS: 10 * 60 * 1000, RESEND_WAIT_MS: 30 * 1000, MAX_ATTEMPTS: 5, MAX_PER_HOUR: 6 };
const limit = (env, name) => (Number(env && env[name]) > 0 ? Number(env[name]) : DEFAULTS[name]);
const HOUR_MS = 60 * 60 * 1000;
const KEYS_TTL_MS = 60 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
});
const fail = (status, code, message) => json(status, { error: { code, message } });

// ---- small crypto helpers ---------------------------------------------------
function b64urlToBytes(value) {
  const base = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base + '='.repeat((4 - (base.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const decodePart = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashCode(salt, code) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${code}`)));
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomCode() {
  // Uniform 6 digits (no modulo bias).
  const limit = 4294967296 - (4294967296 % 1000000);
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return String(buf[0] % 1000000).padStart(6, '0');
}
const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

function maskEmail(email = '') {
  const [name = '', domain = ''] = String(email).split('@');
  return domain ? `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}` : '';
}

// ---- Firebase login token check ----------------------------------------------
let keyCache = { keys: null, at: 0 };
async function loadKeys(env, force = false) {
  const now = Date.now();
  if (!force && keyCache.keys && now - keyCache.at < KEYS_TTL_MS) return keyCache.keys;
  const response = await fetch(env.JWKS_URL || GOOGLE_JWKS);
  if (!response.ok) throw new Error('Could not load Google signing keys');
  keyCache = { keys: (await response.json()).keys || [], at: now };
  return keyCache.keys;
}

// Returns the token's claims when it is a genuine, unexpired login token for THIS Firebase project.
async function verifyFirebaseToken(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let header; let payload;
  try { header = decodePart(parts[0]); payload = decodePart(parts[1]); } catch (_) { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;       // refuses "alg: none" and anything unexpected
  const project = env.FIREBASE_PROJECT_ID;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!project || payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}`) return null;
  if (typeof payload.sub !== 'string' || !payload.sub) return null;
  if (!(payload.exp > nowSeconds) || payload.iat > nowSeconds + 300) return null;

  let jwk = (await loadKeys(env)).find((key) => key.kid === header.kid);
  if (!jwk) jwk = (await loadKeys(env, true)).find((key) => key.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  return valid ? payload : null;
}

// ---- email ---------------------------------------------------------------------
async function sendCodeEmail(env, to, code) {
  const response = await fetch(env.EMAIL_API_URL || BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY || '', 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: env.SENDER_NAME || 'Product Trust & Verification', email: env.SENDER_EMAIL },
      to: [{ email: to }],
      subject: `Your Product Trust sign-in code: ${code}`,
      textContent: `Your Product Trust & Verification sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not try to sign in, ignore this email and change your password.`,
      htmlContent: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto"><div style="background:#0D5C1A;color:#fff;padding:18px 22px;border-bottom:5px solid #C9F05A;font-size:18px;font-weight:700">Product Trust &amp; Verification</div><div style="padding:22px"><p>Your sign-in code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:8px 0">${code}</p><p style="color:#516257">It expires in 10 minutes. If you did not try to sign in, ignore this email and change your password.</p></div></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Email service returned ${response.status}`);
}

// ---- /send ---------------------------------------------------------------------
async function handleSend(env, claims) {
  const email = String(claims.email || '').trim();
  if (!email) return fail(400, 'failed-precondition', 'This account has no email address.');
  const uid = claims.sub;
  const now = Date.now();

  const existing = await env.DB.prepare('SELECT sent_at, window_start, window_count FROM login_codes WHERE uid = ?').bind(uid).first();
  const sameWindow = existing && existing.window_start && now - existing.window_start < HOUR_MS;
  const windowStart = sameWindow ? existing.window_start : now;
  const windowCount = sameWindow ? existing.window_count : 0;
  if (windowCount >= limit(env, 'MAX_PER_HOUR')) return fail(429, 'resource-exhausted', 'Too many codes were requested. Please try again in an hour.');

  const code = randomCode();
  const salt = randomSalt();
  // One atomic step: only proceeds if the last code was sent more than 30 seconds ago.
  const saved = await env.DB.prepare(
    `INSERT INTO login_codes (uid, code_hash, salt, sent_at, expires_at, attempts, window_start, window_count)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)
     ON CONFLICT(uid) DO UPDATE SET code_hash = excluded.code_hash, salt = excluded.salt, sent_at = excluded.sent_at,
       expires_at = excluded.expires_at, attempts = 0, window_start = excluded.window_start, window_count = excluded.window_count
     WHERE login_codes.sent_at <= ?8`,
  ).bind(uid, await hashCode(salt, code), salt, now, now + limit(env, 'CODE_TTL_MS'), windowStart, windowCount + 1, now - limit(env, 'RESEND_WAIT_MS')).run();
  if (!saved.meta || !saved.meta.changes) return fail(429, 'resource-exhausted', 'Please wait a moment before asking for another code.');

  try {
    await sendCodeEmail(env, email, code);
  } catch (_) {
    // Nothing was delivered: discard the code and let the customer retry straight away.
    await env.DB.prepare("UPDATE login_codes SET code_hash = '', sent_at = 0, window_count = ?2 WHERE uid = ?1").bind(uid, windowCount).run();
    return fail(503, 'unavailable', 'The code could not be emailed right now. Please try again in a moment.');
  }
  return json(200, { sent: true, expiresInMinutes: limit(env, 'CODE_TTL_MS') / 60000, email: maskEmail(email) });
}

// ---- /verify -------------------------------------------------------------------
async function handleVerify(env, claims, body) {
  const code = String(body?.code || '').replace(/\D/g, '');
  if (code.length !== 6) return fail(400, 'invalid-argument', 'Enter the 6-digit code from your email.');
  const uid = claims.sub;
  const now = Date.now();

  // Count this attempt atomically, and only while the code is live, unused and under the attempt limit.
  const row = await env.DB.prepare(
    `UPDATE login_codes SET attempts = attempts + 1
     WHERE uid = ?1 AND code_hash != '' AND attempts < ?2 AND expires_at > ?3
     RETURNING code_hash, salt, attempts`,
  ).bind(uid, limit(env, 'MAX_ATTEMPTS'), now).first();

  if (!row) {
    const current = await env.DB.prepare('SELECT code_hash, expires_at FROM login_codes WHERE uid = ?').bind(uid).first();
    if (!current || !current.code_hash) return fail(400, 'failed-precondition', 'There is no active code. Please request a new one.');
    await env.DB.prepare("UPDATE login_codes SET code_hash = '' WHERE uid = ?").bind(uid).run();
    return fail(400, 'failed-precondition', current.expires_at <= now
      ? 'This code has expired. Please request a new one.'
      : 'Too many wrong attempts. Please request a new code.');
  }

  if (!safeEqual(await hashCode(row.salt, code), row.code_hash)) {
    const left = limit(env, 'MAX_ATTEMPTS') - row.attempts;
    return fail(400, 'invalid-argument', left > 0
      ? `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : 'That code is not correct. Please request a new code.');
  }

  // Correct: use it up exactly once, even if two requests arrive at the same moment.
  const used = await env.DB.prepare("UPDATE login_codes SET code_hash = '', verified_at = ?3 WHERE uid = ?1 AND code_hash = ?2").bind(uid, row.code_hash, now).run();
  if (!used.meta || !used.meta.changes) return fail(400, 'failed-precondition', 'There is no active code. Please request a new one.');
  return json(200, { verified: true });
}

// ---- entry point -----------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json(200, { ok: true });
    if (request.method !== 'POST' || !['/send', '/verify'].includes(url.pathname)) return fail(404, 'not-found', 'Not found.');

    const bearer = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    let claims = null;
    try { claims = bearer ? await verifyFirebaseToken(bearer[1], env) : null; } catch (_) { return fail(503, 'unavailable', 'Sign-in could not be checked right now. Please try again.'); }
    if (!claims) return fail(401, 'unauthenticated', 'Please sign in again.');

    if (url.pathname === '/send') return handleSend(env, claims);
    let body = {};
    try { body = await request.json(); } catch (_) { /* handled by validation */ }
    return handleVerify(env, claims, body);
  },
};
