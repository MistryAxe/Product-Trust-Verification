export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value = '') {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function passwordChecks(value = '') {
  const password = String(value || '');
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(value = '') {
  return Object.values(passwordChecks(value)).every(Boolean);
}

export function passwordRequirementMessage() {
  return 'Use at least 8 characters with an uppercase letter, lowercase letter, number and special character.';
}
