export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function isValidUpi(upiId: string): boolean {
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upiId.trim());
}

export function isValidBankAccount(accountNumber: string): boolean {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  return cleaned.length >= 9 && cleaned.length <= 18;
}

export function isValidIfsc(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.trim().toUpperCase());
}

export function cleanNumericInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

