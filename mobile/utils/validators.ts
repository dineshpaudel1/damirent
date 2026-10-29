/**
 * Nepal phone number: 98/97/96/95 followed by exactly 8 digits.
 * Accepts optional +977 or 977 country prefix.
 */
export function isValidNepalPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '').replace(/^(\+977|977)/, '');
  return /^(98|97|96|95)\d{8}$/.test(cleaned);
}

/**
 * Strip +977 or 977 prefix and return bare 10-digit phone.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, '').replace(/^(\+977|977)/, '');
}

/**
 * Password: minimum 8 characters.
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * OTP: exactly 6 digits.
 */
export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Email — basic RFC check.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Price: must be a positive integer (NPR, integer-only).
 */
export function isValidNPRAmount(value: string | number): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/**
 * Return a field error string, or undefined if valid.
 */
export function phoneError(phone: string): string | undefined {
  if (!phone.trim()) return 'Phone number is required';
  if (!isValidNepalPhone(phone)) return 'Enter a valid Nepal phone number (e.g. 9801234567)';
  return undefined;
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  if (!isValidEmail(email)) return 'Enter a valid email address';
  return undefined;
}

export function passwordError(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (!isValidPassword(password)) return 'Password must be at least 8 characters';
  return undefined;
}

export function confirmPasswordError(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return undefined;
}

export function fullNameError(name: string): string | undefined {
  if (!name.trim()) return 'Full name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return undefined;
}
