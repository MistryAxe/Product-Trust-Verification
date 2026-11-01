// Remembers which tab / section a screen was on, but ONLY for one purpose:
// when the person comes back (Back button) from a screen that this screen
// opened, they find it exactly as they left it.
//
// A fresh visit always starts at the beginning. Without this rule the screen
// would reopen on whatever was used last time (for example Settings reopening
// on "Email & security" after signing out, or a newly scanned product opening
// on the "Sources" tab).
const memory = new Map();

// Call whenever the person picks a tab / section.
export function rememberScreenState(screen, itemKey, value) {
  memory.set(screen, { itemKey: String(itemKey ?? ''), value });
}

// Where should the screen start?
//   arrivedByBack - true only when the person got here by pressing Back
//   itemKey       - which item it is about (the account, or the product) so a
//                   different account or product never inherits the memory
export function startingScreenState(screen, itemKey, arrivedByBack, fallback) {
  if (!arrivedByBack) return fallback;
  const saved = memory.get(screen);
  return saved && saved.itemKey === String(itemKey ?? '') ? saved.value : fallback;
}
