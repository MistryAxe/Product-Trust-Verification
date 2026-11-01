// Sign-in security switches. Both are OFF unless turned on in `.env`, so out of
// the box signing in is simply email + password.
const on = (value) => String(value || '').trim().toLowerCase() === 'true';
const off = (value) => String(value || '').trim().toLowerCase() === 'false';
const list = (value) => String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

export const FEATURES = {
  // Every time the app opens it starts on the welcome screen and the person signs in again (the original behaviour).
  // Set EXPO_PUBLIC_START_SIGNED_OUT=false in `.env` to keep people signed in between opens instead.
  startSignedOut: !off(process.env.EXPO_PUBLIC_START_SIGNED_OUT),
  // Customers type a 6-digit code that is emailed to them at every sign-in.
  // Turn ON only after the sign-in code service is set up (see docs/setup/LOGIN-CODE.md);
  // otherwise customers could not get in.
  requireLoginCode: on(process.env.EXPO_PUBLIC_REQUIRE_LOGIN_CODE),
  // Customers must open a "verify your email" link once before entering.
  requireEmailVerification: on(process.env.EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION),
  // Accounts that skip the code step, e.g. the demo account given to App Store / Google Play
  // reviewers, who cannot receive email at your address. Comma-separated.
  loginCodeExemptEmails: list(process.env.EXPO_PUBLIC_LOGIN_CODE_EXEMPT_EMAILS),
};

// Who has to type the emailed code: customers who sign in with a password,
// unless their email is on the exempt list.
export function shouldRequireLoginCode({ features = FEATURES, role, email, usesPassword }) {
  const isCustomer = role === 'customer' || role === 'consumer';
  const exempt = features.loginCodeExemptEmails.includes(String(email || '').trim().toLowerCase());
  return Boolean(features.requireLoginCode && isCustomer && usesPassword && !exempt);
}
