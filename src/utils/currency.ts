/**
 * Indian Rupee (INR) formatting and conversion utilities.
 * All internal money calculations MUST use integer paise.
 * 1 Rupee = 100 paise.
 */

/**
 * Converts Rupee amount (number or string) to integer paise.
 * Safely rounds to avoid floating-point precision issues.
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to Rupee decimal amount.
 */
export function paiseToRupees(paise: number): number {
  if (isNaN(paise)) return 0;
  return Math.floor(paise) / 100;
}

/**
 * Formats integer paise into standard Indian Rupee string (₹).
 * Follows the Indian numbering system: 1,00,000 (Lakhs), 1,00,00,000 (Crores).
 *
 * @param paise integer amount in paise
 * @param includeDecimals whether to always include .00
 */
export function formatPaiseToINR(paise: number, includeDecimals: boolean = false): string {
  if (isNaN(paise)) return '₹0';

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  // Format rupees according to Indian numbering format
  const rupeesStr = rupees.toString();
  let lastThree = rupeesStr.substring(rupeesStr.length - 3);
  const otherNumbers = rupeesStr.substring(0, rupeesStr.length - 3);

  let formatted = '';
  if (otherNumbers !== '') {
    const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = withCommas + ',' + lastThree;
  } else {
    formatted = lastThree;
  }

  if (includeDecimals || remainderPaise > 0) {
    const paiseFormatted = remainderPaise.toString().padStart(2, '0');
    formatted += `.${paiseFormatted}`;
  }

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Formats a plain rupee number to INR string.
 */
export function formatRupeesToINR(rupees: number, includeDecimals: boolean = false): string {
  return formatPaiseToINR(rupeesToPaise(rupees), includeDecimals);
}

