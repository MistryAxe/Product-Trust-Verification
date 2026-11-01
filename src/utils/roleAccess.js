// Who may do what, in one place. The database rules enforce the same thing; this lets the app explain it up
// front instead of letting a form fail at the very end.

// Reports can only be created by customer accounts (see firebase/firestore.rules).
export function canSendReports(role) {
  return role === 'customer' || role === 'consumer';
}
