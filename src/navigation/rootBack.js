// What the Android back button does before the person is inside the app. One small rule set, so it can be tested.
//   not signed in, on a sign-in / sign-up screen  -> back to the welcome screen
//   signed in but still at the "enter your code" step -> leave: sign out and return to the welcome screen
//   anywhere else -> nothing special (Android decides)
export function rootBackAction({ firebaseUser, authEntry, needsCode, codeOk }) {
  if (!firebaseUser) return authEntry ? 'closeAuth' : 'none';
  if (needsCode && !codeOk) return 'signOut';
  return 'none';
}
