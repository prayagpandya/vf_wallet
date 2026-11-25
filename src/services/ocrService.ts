import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { ExtractedPaymentDetails, Transaction } from '../types';
import { rupeesToPaise, formatPaiseToINR } from '../utils/currency';
import { adminApi } from './api';

// Dynamic import or lazy link of ML Kit Text Recognition
let NativeTextRecognition: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mlkit = require('@react-native-ml-kit/text-recognition');
  NativeTextRecognition = mlkit.default || mlkit;
} catch {
  NativeTextRecognition = null;
}

interface AmountCandidate {
  value: number;
  score: number;
  source: string;
}

/**
 * Detects real image mime type & filetype from base64 magic bytes.
 */
function detectImageFormat(base64: string, uri: string): { mime: string; filetype: string } {
  if (base64.startsWith('iVBOR')) {
    return { mime: 'image/png', filetype: 'PNG' };
  }
  if (base64.startsWith('/9j/')) {
    return { mime: 'image/jpeg', filetype: 'JPG' };
  }
  if (base64.startsWith('UklGR')) {
    return { mime: 'image/webp', filetype: 'WEBP' };
  }
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return { mime: 'image/png', filetype: 'PNG' };
  return { mime: 'image/jpeg', filetype: 'JPG' };
}

/**
 * Parses an Indian-formatted currency string (e.g. "1,25,000.50" or "3000.00") into a float.
 */
function parseIndianNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 1 || val > 100000000) return null;
  return val;
}

/**
 * Parses Indian English rupee words like:
 * "Rupees One Thousand Nine Hundred Ninety Nine Only" -> 1999
 */
function parseRupeesInWords(text: string): number | null {
  const match = text.match(/rupees\s+([a-z\s\-]+?)(?:\s+only|\)|$|\n\n)/i);
  if (!match || !match[1]) return null;

  const words = match[1]
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'and');

  const small: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const scales: Record<string, number> = {
    hundred: 100,
    thousand: 1000,
    lakh: 100000,
    lac: 100000,
    crore: 10000000,
  };

  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (const w of words) {
    if (small[w] !== undefined) {
      current += small[w];
      matchedAny = true;
    } else if (w === 'hundred') {
      current = (current || 1) * 100;
      matchedAny = true;
    } else if (scales[w] !== undefined) {
      total += (current || 1) * scales[w];
      current = 0;
      matchedAny = true;
    } else if (w === 'only' || w === 'paise') {
      break;
    }
  }

  const result = total + current;
  return matchedAny && result >= 1 && result <= 100000000 ? result : null;
}

/**
 * Checks if a numeric string is likely a year, mobile number, UTR, duration, or masked account digits.
 */
function isNoiseNumber(numStr: string, line: string): boolean {
  const digitsOnly = numStr.replace(/[^0-9]/g, '');
  const val = parseFloat(numStr.replace(/,/g, ''));

  // Ignore "Paid in 1.51s", "Paid in 1.76 Seconds", "Paid in 4 1.51s"
  if (/paid\s+in\b/i.test(line) && /(?:s\b|sec|second)/i.test(line)) {
    return true;
  }
  // Ignore numbers directly followed by 's' (seconds)
  if (new RegExp(`${numStr.replace(/\./g, '\\.')}\\s*(?:s\\b|sec|second)`, 'i').test(line)) {
    return true;
  }
  // Ignore 10-digit Indian mobile numbers (unless clearly prefixed by currency symbol)
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly) && !numStr.includes(',')) {
    return true;
  }
  // Ignore 11+ digit numbers (UTRs, account numbers, order IDs)
  if (digitsOnly.length >= 11 && !numStr.includes('.')) {
    return true;
  }
  // Ignore 4-digit years (2020-2032) unless preceded by currency symbol
  if (
    digitsOnly.length === 4 &&
    val >= 2020 &&
    val <= 2032 &&
    !/[₹¥€£]|Rs\.?|INR/i.test(line)
  ) {
    return true;
  }
  // Ignore masked account digits like XX1234, ****5678, A/C 1234, Bank - 4888
  if (
    new RegExp(
      `(?:x{2,}|\\*{2,}|ending\\s*(?:with|in)?|a\\/c\\s*(?:no\\.?)?|account\\s*(?:no\\.?)?|bank\\s*[-:])\\s*[-:]?\\s*${digitsOnly}`,
      'i'
    ).test(line)
  ) {
    return true;
  }
  // Ignore percentages (battery 99%, cashback 5%)
  if (new RegExp(`${digitsOnly}\\s*%`).test(line)) {
    return true;
  }
  // Ignore time tokens like 12:30 or 10:59
  if (new RegExp(`(?:${digitsOnly}:\\d{2}|\\d{1,2}:${digitsOnly})`).test(line)) {
    return true;
  }
  // Ignore dates like 18 Nov, 18-Nov, 7th Nov, 18/11/2026
  if (
    new RegExp(
      `\\b${digitsOnly}(?:st|nd|rd|th)?[\\s\\-\\/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\\d{1,2}[\\/-])`,
      'i'
    ).test(line)
  ) {
    return true;
  }
  return false;
}

/**
 * Calls OCR.space cloud API with specified engine (1 or 2).
 */
async function callOcrSpace(
  base64: string,
  mime: string,
  filetype: string,
  engine: '1' | '2'
): Promise<string> {
  const keys = ['K87899148788957', 'K88328135888957', 'K89457812888957', 'helloworld'];

  for (const apiKey of keys) {
    try {
      const params = new URLSearchParams();
      params.append('base64Image', `data:${mime};base64,${base64}`);
      params.append('language', 'eng');
      params.append('isOverlayRequired', 'false');
      params.append('filetype', filetype);
      params.append('detectOrientation', 'true');
      params.append('scale', 'true');
      params.append('OCREngine', engine);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data?.IsErroredOnProcessing) {
          console.warn(
            `OCR.space Engine ${engine} error (${apiKey}):`,
            data.ErrorMessage || data.ErrorDetails
          );
          continue;
        }
        const parsedText = data?.ParsedResults?.[0]?.ParsedText?.trim();
        if (parsedText && parsedText.length > 0) {
          return parsedText;
        }
      }
    } catch (err) {
      console.warn(`OCR Engine ${engine} attempt (${apiKey}) failed:`, err);
    }
  }

  return '';
}

/**
 * Merges two ExtractedPaymentDetails objects (e.g., Engine 2 + Engine 1),
 * keeping the strongest/non-null fields from both.
 */
function mergeExtracted(
  primary: ExtractedPaymentDetails,
  secondary: ExtractedPaymentDetails
): ExtractedPaymentDetails {
  const amountPaise = primary.amountPaise ?? secondary.amountPaise;
  const amountFormatted = amountPaise !== null ? formatPaiseToINR(amountPaise) : null;
  const utrNumber = primary.utrNumber ?? secondary.utrNumber;
  const upiRefNumber = primary.upiRefNumber ?? secondary.upiRefNumber ?? utrNumber;
  const transactionId =
    primary.transactionId ??
    secondary.transactionId ??
    (utrNumber ? `TXN-${utrNumber}` : null);
  const paymentStatus = primary.paymentStatus ?? secondary.paymentStatus;
  const senderName = primary.senderName ?? secondary.senderName;
  const receiverName = primary.receiverName ?? secondary.receiverName;
  const transactionDate = primary.transactionDate ?? secondary.transactionDate;
  const transactionTime = primary.transactionTime ?? secondary.transactionTime;
  const upiId = primary.upiId ?? secondary.upiId;
  const paymentAppName = primary.paymentAppName ?? secondary.paymentAppName;
  const bankDetails = primary.bankDetails ?? secondary.bankDetails;

  const missingFields: string[] = [];
  let confidence = 0;
  if (amountPaise !== null) confidence += 35;
  else missingFields.push('Transaction Amount');
  if (utrNumber !== null) confidence += 30;
  else missingFields.push('UTR / Reference Number');
  if (paymentStatus !== null) confidence += 10;
  if (receiverName !== null || senderName !== null) confidence += 10;
  if (transactionDate !== null || transactionTime !== null) confidence += 10;
  if (paymentAppName !== null || upiId !== null) confidence += 5;

  const combinedRawText =
    primary.rawText && secondary.rawText && primary.rawText !== secondary.rawText
      ? `${primary.rawText}\n--- ENGINE MERGE ---\n${secondary.rawText}`
      : primary.rawText || secondary.rawText;

  return {
    amountPaise,
    amountFormatted,
    senderName,
    receiverName,
    transactionDate,
    transactionTime,
    utrNumber,
    upiRefNumber,
    transactionId,
    paymentStatus,
    upiId,
    paymentAppName,
    bankDetails,
    ocrConfidence: Math.min(100, confidence),
    rawText: combinedRawText,
    isComplete: amountPaise !== null && utrNumber !== null,
    missingFields,
  };
}

export const ocrService = {
  /**
   * Generates SHA-256 cryptographic hash of image file for duplicate screenshot detection.
   */
  async computeImageHash(imageUri: string): Promise<string> {
    try {
      if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (fileInfo.exists) {
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            base64
          );
        }
      }
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        imageUri
      );
    } catch (e) {
      console.warn('Could not compute exact file hash, generating URI hash:', e);
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${imageUri}-${Date.now()}`
      );
    }
  },

  /**
   * Performs multi-engine text recognition on the given image URI.
   */
  async recognizeText(imageUri: string): Promise<string> {
    // 1. Primary: Native ML Kit (Dev Build / Standalone APK)
    try {
      if (NativeTextRecognition && typeof NativeTextRecognition.recognize === 'function') {
        const result = await NativeTextRecognition.recognize(imageUri);
        if (result && result.text && result.text.trim().length > 0) {
          return result.text.trim();
        }
      }
    } catch {
      console.warn('Native ML Kit unavailable in Expo Go. Using cloud dual-engine OCR...');
    }

    // 2. Secondary: Cloud OCR.space Engine 2 -> Engine 1
    try {
      if (imageUri && (imageUri.startsWith('file://') || imageUri.startsWith('content://'))) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (base64) {
          const { mime, filetype } = detectImageFormat(base64, imageUri);
          const text2 = await callOcrSpace(base64, mime, filetype, '2');
          if (text2) return text2;
          const text1 = await callOcrSpace(base64, mime, filetype, '1');
          if (text1) return text1;
        }
      }
    } catch (fallbackError) {
      console.warn('Fallback OCR error:', fallbackError);
    }

    return '';
  },

  /**
   * High-accuracy structured parsing engine tuned on real Indian payment receipts:
   * WhatsApp Pay, Paytm, PhonePe, Google Pay, BHIM UPI, Axis Bank UPI,
   * ICICI/HDFC/SBI Bank NEFT/IMPS, CRED, Amazon Pay, and more.
   */
  parsePaymentText(rawText: string): ExtractedPaymentDetails {
    // 1. Normalize unicode whitespace & common OCR misreads of the ₹ symbol:
    //    OCR engines frequently read ₹ as · (middle dot U+00B7), ミ (Katakana U+30DF),
    //    • (bullet U+2022), ・ (U+30FB), ₨, 〒, ‡, †
    let normalizedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
      .replace(/[₹₨]/g, '₹');

    // Normalize Rs / Rs. / INR / inr before a number to ₹
    normalizedText = normalizedText.replace(/\b(?:rs\.?|inr)\s*([0-9])/gi, '₹$1');

    // Convert OCR-corrupted rupee glyphs (·, ミ, ・, 〒, ‡, †, •, *, ~, =, ^, ¢, €, ¥, £, ₽, ?) directly before amounts into ₹
    // Also lowercase/uppercase z/Z or R/F/T/p directly before a number when looking like rupee
    normalizedText = normalizedText.replace(
      /(^|[\s\n])([·・ミ〒‡†•*~=^¢€¥£₽?]|(?:[zZRFTrp])\s*)([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]{2,7}(?:\.[0-9]{1,2})?)(?!\s*(?:s\b|sec|second|%|am\b|pm\b|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|:|\/|-|\d{2}))/gim,
      '$1₹$3'
    );

    const lines = normalizedText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let amountPaise: number | null = null;
    let amountFormatted: string | null = null;
    let senderName: string | null = null;
    let receiverName: string | null = null;
    let transactionDate: string | null = null;
    let transactionTime: string | null = null;
    let utrNumber: string | null = null;
    let upiRefNumber: string | null = null;
    let transactionId: string | null = null;
    let paymentStatus: string | null = null;
    let upiId: string | null = null;
    let paymentAppName: string | null = null;
    let bankDetails: string | null = null;

    const lowerText = normalizedText.toLowerCase();

    // =========================================================================
    // 1. DETECT PAYMENT APP (Priority order prevents false cross-app matches)
    // =========================================================================
    if (
      lowerText.includes('payments on whatsapp') ||
      lowerText.includes('whatsapp pay') ||
      lowerText.includes('whatsapp')
    ) {
      paymentAppName = 'WhatsApp Pay';
    } else if (
      lowerText.includes('bhim') ||
      lowerText.includes("bharat's own payments app")
    ) {
      paymentAppName = 'BHIM UPI';
    } else if (
      lowerText.includes('phonepe transaction id') ||
      lowerText.includes('powered by phonepe') ||
      (lowerText.includes('phonepe') && !lowerText.includes('via phonepe')) ||
      lowerText.includes('phone pe') ||
      (lowerText.includes('transaction successful') && /\bt\d{18,}/i.test(normalizedText))
    ) {
      paymentAppName = 'PhonePe';
    } else if (
      lowerText.includes('paytm') ||
      lowerText.includes('раутт') || // Cyrillic OCR misread of stylized Paytm logo
      /\bpaym\b/i.test(normalizedText) ||
      (lowerText.includes('money sent successfully') && lowerText.includes('upi ref no'))
    ) {
      paymentAppName = 'Paytm';
    } else if (
      lowerText.includes('google pay') ||
      lowerText.includes('gpay') ||
      lowerText.includes('google transaction id')
    ) {
      paymentAppName = 'Google Pay';
    } else if (lowerText.includes('axis bank')) {
      paymentAppName = 'Axis Bank UPI';
    } else if (lowerText.includes('cred')) {
      paymentAppName = 'CRED';
    } else if (lowerText.includes('amazon pay')) {
      paymentAppName = 'Amazon Pay';
    } else if (lowerText.includes('fampay')) {
      paymentAppName = 'FamPay';
    } else if (lowerText.includes('super.money') || lowerText.includes('supermoney')) {
      paymentAppName = 'Super.money';
    } else if (lowerText.includes('navi')) {
      paymentAppName = 'Navi UPI';
    } else if (lowerText.includes('mobikwik')) {
      paymentAppName = 'MobiKwik';
    } else if (lowerText.includes('bharatpe')) {
      paymentAppName = 'BharatPe';
    } else if (/\bneft\b/i.test(normalizedText)) {
      paymentAppName = 'Bank NEFT';
    } else if (/\bimps\b/i.test(normalizedText)) {
      paymentAppName = 'Bank IMPS';
    } else if (/\brtgs\b/i.test(normalizedText)) {
      paymentAppName = 'Bank RTGS';
    } else if (
      lowerText.includes('yono') ||
      lowerText.includes('imobile') ||
      lowerText.includes('hdfc') ||
      lowerText.includes('icici') ||
      lowerText.includes('kotak') ||
      lowerText.includes('state bank of india') ||
      lowerText.includes('bank of india')
    ) {
      paymentAppName = 'Bank UPI / Transfer';
    }

    // =========================================================================
    // 2. DETECT PAYMENT STATUS
    // =========================================================================
    if (
      /\b(paid|success|successful|successfully|completed|payment successful|payment completed|transaction successful|money sent successfully|sent successfully|transferred|credited)\b/i.test(
        normalizedText
      )
    ) {
      paymentStatus = 'SUCCESS';
    } else if (/\b(pending|processing|in progress|awaiting)\b/i.test(normalizedText)) {
      paymentStatus = 'PENDING';
    } else if (/\b(failed|declined|rejected|unsuccessful)\b/i.test(normalizedText)) {
      paymentStatus = 'FAILED';
    }

    // =========================================================================
    // 3. HIGH-ACCURACY SCORED AMOUNT EXTRACTION
    // =========================================================================
    const candidates: AmountCandidate[] = [];
    const addCandidate = (rawNum: string, score: number, line: string, source: string) => {
      if (isNoiseNumber(rawNum, line)) return;
      const val = parseIndianNumber(rawNum);
      if (val !== null) {
        let adjustedScore = score;
        if (rawNum.includes(',')) adjustedScore += 15;
        if (/\.\d{2}$/.test(rawNum)) adjustedScore += 12;
        if (val < 10 && score < 95) adjustedScore -= 25;
        candidates.push({ value: val, score: adjustedScore, source });
      }
    };

    // Pass A: Explicit currency symbol anywhere (₹, Rs., Rs, INR, ¥, €, £) — now includes normalized · & ミ!
    const currencyGlobalRegex =
      /(?:₹|Rs\.?|INR|¥|€|£)\s*[\n]?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
    let m: RegExpExecArray | null;
    while ((m = currencyGlobalRegex.exec(normalizedText)) !== null) {
      const surrounding = normalizedText.slice(
        Math.max(0, m.index - 25),
        Math.min(normalizedText.length, m.index + m[0].length + 25)
      );
      const isRewardOrCashback = /cashback|reward|scratch|off|discount|fee|charge|gst|convenience/i.test(
        surrounding
      );
      addCandidate(m[1], isRewardOrCashback ? 35 : 120, surrounding, 'explicit-currency');
    }

    // Pass B: Amount written in words (e.g. "Rupees One Thousand Nine Hundred Ninety Nine Only")
    const wordsAmount = parseRupeesInWords(normalizedText);
    if (wordsAmount !== null) {
      candidates.push({ value: wordsAmount, score: 110, source: 'rupees-in-words' });
    }

    // Pass C: Contextual line-by-line scanning
    const amountLabelRegex =
      /\b(?:total\s*amount|bill\s*amount|paid\s*amount|transfer(?:red)?\s*amount|amount\s*paid|net\s*amount|you\s*paid|amount|debited|transferred|sum\s*of|received|paid|sent|payment\s*of|transfer\s*of|payment\s*to|paid\s*to|transfer\s*to)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

      // Skip duration lines ("Paid in 1.51s", "Paid in 1.76 Seconds") and promo/cashback lines
      if (/paid\s+in\b/i.test(line)) continue;
      if (/cashback|reward|offer|earn|discount|points|interest\s+rate/i.test(line)) continue;

      // C1. Labeled amount on same line
      const sameLineLabeled = line.match(
        /(?:total\s*amount|bill\s*amount|paid\s*amount|amount\s*paid|you\s*paid|amount|debited|transferred|total|paid|sent|payment\s*of|transfer\s*of)\s*[:=\-]?\s*(?:₹|Rs\.?|INR|¥|€|£|[RFT?r])?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]{2,7}(?:\.[0-9]{1,2})?)\b/i
      );
      if (sameLineLabeled && sameLineLabeled[1]) {
        addCandidate(sameLineLabeled[1], 105, line, 'labeled-same-line');
      }

      // C2. Hero standalone numeric line (with or without currency symbol, with or without /-)
      const heroLine = line.match(
        /^(?:₹|Rs\.?|INR|¥|€|£|₽|[RFTtr?]|2\s+)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]{2,7}(?:\.[0-9]{1,2})?)\s*(?:\/-)?$/i
      );
      if (heroLine && heroLine[1]) {
        const isTopStatusBarNoise = i < 2 && heroLine[1].length <= 2;
        if (!isTopStatusBarNoise) {
          const nearContext =
            amountLabelRegex.test(prevLine) ||
            amountLabelRegex.test(nextLine) ||
            /successful|completed|paid|sent|debited|payment\s*details|money\s*sent|transferred|payment\s*to/i.test(prevLine) ||
            /successful|completed|paid|rupees|bank|utr|pay\s*again|split|view\s*details/i.test(nextLine);
          const hasCommaOrDecimal =
            heroLine[1].includes(',') || heroLine[1].includes('.');
          const isPrefixedWithCurrency = /^(?:₹|Rs\.?|INR|¥|€|£|₽)/i.test(line);
          const score = isPrefixedWithCurrency
            ? 115
            : nearContext
            ? 98
            : hasCommaOrDecimal
            ? 82
            : 60;
          addCandidate(heroLine[1], score, line, 'hero-amount');
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score || b.value - a.value);
      const best = candidates[0];
      amountPaise = rupeesToPaise(best.value);
      amountFormatted = formatPaiseToINR(amountPaise);
    }

    // =========================================================================
    // 4. HIGH-ACCURACY MULTILINE UTR / TRANSACTION REFERENCE EXTRACTION
    // =========================================================================
    // Helper: repairs single-char OCR digit confusions inside explicitly labeled numeric UTRs
    const repairNumericRef = (raw: string): string => {
      const cleaned = raw
        .replace(/[\s\-]/g, '')
        .replace(/[Oo]/g, '0')
        .replace(/[Il|]/g, '1')
        .replace(/[^0-9]/g, '');
      return cleaned.length >= 12 ? cleaned.slice(0, 12) : cleaned;
    };

    // Priority 1: Explicit 12-digit UTR / UPI Ref / LIPI Ref / RRN across all payment apps
    const explicitUtrRegexes = [
      /\b(?:UTR(?:\s*No\.?|\s*Number)?|(?:UPI|LIPI|UP1)\s*Ref(?:erence)?\s*(?:No\.?|ID|Number|Num)?|(?:UPI|LIPI|UP1)\s*transaction\s*(?:ID|No\.?)|RRN(?:\s*No\.?)?|IMPS\s*Ref(?:erence)?\s*(?:No\.?)?|NEFT\s*Ref(?:erence)?\s*(?:No\.?)?|Bank\s*Ref(?:erence)?\s*(?:No\.?|ID|Number)?|Transaction\s*Ref(?:erence)?\s*(?:No\.?|ID|Number)?|Txn\s*Ref(?:erence)?\s*(?:No\.?|ID|Number)?|Ref(?:erence)?\s*(?:No\.?|ID|Number)?|Chq[\/\s]*Ref\s*No\.?|Journal\s*(?:No\.?|Number)|Approval\s*(?:Code|Ref))\s*[:#\-\.\s]*\n?\s*([0-9OoIl|]{12}|[0-9OoIl|]{4}[\s\-][0-9OoIl|]{4}[\s\-][0-9OoIl|]{4}|[0-9OoIl|]{3,6}[\s\-][0-9OoIl|]{3,6}(?:[\s\-][0-9OoIl|]{3,6})?|[0-9OoIl|]{10,18})(?![0-9])/i,
    ];

    for (const regex of explicitUtrRegexes) {
      const match = normalizedText.match(regex);
      if (match && match[1]) {
        const clean = repairNumericRef(match[1]);
        if (/^[0-9]{12}$/.test(clean)) {
          utrNumber = clean;
          upiRefNumber = clean;
          break;
        }
      }
    }

    // Priority 2: Explicit Bank NEFT/RTGS/IMPS Reference ("Transaction reference no.- 2614770283", "Ref No: N321...", etc.)
    if (!utrNumber) {
      const bankRefMatch = normalizedText.match(
        /\b(?:Transaction\s*ref(?:erence)?\s*(?:no\.?|number|id)?|Txn\s*Ref(?:erence)?\s*(?:no\.?|number|id)?|Ref(?:erence)?\s*(?:no\.?|number|id)|NEFT\s*Ref(?:erence)?\s*(?:no\.?)?|RTGS\s*Ref(?:erence)?\s*(?:no\.?)?)\s*[:#\-\.\s]*\n?\s*([A-Z]{0,6}[0-9]{8,18})(?![0-9])/i
      );
      if (bankRefMatch && bankRefMatch[1]) {
        utrNumber = bankRefMatch[1].trim();
        upiRefNumber = utrNumber;
      }
    }

    // Priority 3: Explicit "Transaction ID" / "UPI Ref" / "UTR" multiline window (handles 2-column layouts like BHIM, WhatsApp Pay, GPay!)
    if (!utrNumber) {
      for (let i = 0; i < lines.length; i++) {
        if (
          /\b(?:UTR|UIR|UPI\s*Ref|LIPI\s*Ref|UPI\s*transaction|Transaction\s*ID|Txn\s*ID|Txn\s*No|Transaction\s*No|Reference\s*(?:No|ID|Number)|Ref\s*No|RRN|Order\s*ID|Bank\s*Ref)\b/i.test(
            lines[i]
          )
        ) {
          // Check same line + up to 3 lines below (handles 2-column layouts like BHIM "Transaction ID\nDate & Time\n105010452488")
          const windowText = [
            lines[i],
            lines[i + 1] || '',
            lines[i + 2] || '',
            lines[i + 3] || '',
          ].join(' ');

          // Prefer 10-16 digit numeric ref (tolerating glued copy-icon char like 105010452488D)
          const idDigits = windowText.match(/(?<![0-9])([0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{2,6}|[0-9]{12})(?![0-9])/);
          if (idDigits && idDigits[1]) {
            const clean = repairNumericRef(idDigits[1]);
            if (clean.length >= 10 && clean.length <= 16 && !/^91[6-9][0-9]{9}$/.test(clean)) {
              utrNumber = clean.length >= 12 ? clean.slice(0, 12) : clean;
              upiRefNumber = utrNumber;
              break;
            }
          }
        }
      }
    }

    // Priority 4: Standalone 12-digit numeric fallback (STRICTLY excluding Bank Account numbers & 91-phones, tolerating glued copy-icon!)
    if (!utrNumber) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prevLine = i > 0 ? lines[i - 1] : '';
        const prev2Line = i > 1 ? lines[i - 2] : '';
        if (
          /\b(?:a\/c|account|payment\s*from|payment\s*to|neft|rtgs|phone|mobile)\b/i.test(
            `${prev2Line} ${prevLine} ${line}`
          )
        ) {
          continue;
        }
        const m12 = line.match(/(?<![0-9])([0-9OoIl|]{4}[\s\-]?[0-9OoIl|]{4}[\s\-]?[0-9OoIl|]{4}|[0-9OoIl|]{12})(?![0-9])/);
        if (m12 && m12[1]) {
          const clean = repairNumericRef(m12[1]);
          if (/^91[6-9][0-9]{9}$/.test(clean) || /^[6-9][0-9]{9}$/.test(clean)) continue;
          if (clean.length === 12) {
            utrNumber = clean;
            upiRefNumber = clean;
            break;
          }
        }
      }
    }

    // =========================================================================
    // 5. TRANSACTION ID (Alphanumeric PhonePe T..., GPay CICAg..., Order ID...)
    // =========================================================================
    const txnIdMatch = normalizedText.match(
      /\b(?:PhonePe\s*Transaction\s*ID|Google\s*transaction\s*ID|Transaction\s*ID|Txn\s*ID|Payment\s*ID|Order\s*ID)\s*[:#\-\s]*\n?\s*([A-Z]?[A-Za-z0-9_-]{8,36})\b/i
    );
    if (
      txnIdMatch &&
      txnIdMatch[1] &&
      !/^(?:date|time|status|amount|details|successful|completed|failed)$/i.test(
        txnIdMatch[1]
      )
    ) {
      transactionId = txnIdMatch[1].trim();
      // If no numeric UTR was visible on receipt, use the real alphanumeric Transaction ID as ref
      if (!utrNumber && /[0-9]{4,}/.test(transactionId)) {
        utrNumber = transactionId;
        upiRefNumber = transactionId;
      }
    } else if (utrNumber) {
      transactionId = `TXN-${utrNumber}`;
    }

    // =========================================================================
    // 6. UPI ID (VPA) — also handles wrapped lines like "9033437447-2\n@axl"
    // =========================================================================
    const unwrappedForUpi = normalizedText.replace(/\n\s*@/g, '@');
    const upiMatches = unwrappedForUpi.matchAll(
      /\b([a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32})\b/g
    );
    for (const uMatch of upiMatches) {
      const candidateVpa = uMatch[1].trim();
      if (/@(?:gmail|yahoo|outlook|hotmail|icloud|protonmail)\./i.test(candidateVpa)) {
        continue;
      }
      upiId = candidateVpa;
      break;
    }

    // =========================================================================
    // 7. RECEIVER & SENDER NAME (Single-line + Multiline + Receipt Phrasing)
    // =========================================================================
    // Special WhatsApp / BHIM sentence patterns
    const receivedByMatch = normalizedText.match(
      /(?:Payment\s*received\s*by|Payment\s*should\s*now\s*be\s*in)\s+([A-Za-z][A-Za-z\s.&]{2,45}?)(?:'s\s+bank|\n\n|Hide\s+details|$)/i
    );
    if (receivedByMatch && receivedByMatch[1]) {
      receiverName = receivedByMatch[1].replace(/\s+/g, ' ').trim();
    }

    const initiatedByMatch = normalizedText.match(
      /(?:Payment\s*initiated\s*by)\s+([A-Za-z][A-Za-z\s.&]{2,40}?)(?:\n\n|Payment\s*transferred|$)/i
    );
    if (initiatedByMatch && initiatedByMatch[1]) {
      senderName = initiatedByMatch[1].replace(/\s+/g, ' ').trim();
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

      if (!receiverName) {
        const recSame = line.match(
          /^(?:Paid\s*to|To|Banking\s*Name|Transfer(?:red)?\s*to|Biller(?:\s*Name)?|Merchant)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s.&]{2,38})$/i
        );
        if (recSame && recSame[1]) {
          receiverName = recSame[1].replace(/[•·]+$/, '').trim();
        } else if (
          /^(?:Paid\s*to|To|Banking\s*Name|Transfer(?:red)?\s*to)\s*[:\-]?$/i.test(line) &&
          nextLine &&
          /^[A-Za-z][A-Za-z0-9\s.&]{2,38}$/.test(nextLine)
        ) {
          receiverName = nextLine.trim();
        }
      }

      if (!senderName) {
        const sendSame = line.match(
          /^(?:From|Sent\s*by|Paid\s*by|Sender|Received\s*from|Customer\s*Name)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s.&]{2,38})$/i
        );
        if (sendSame && sendSame[1]) {
          senderName = sendSame[1].trim();
        } else if (
          /^(?:From|Sent\s*by|Paid\s*by|Sender)\s*[:\-]?$/i.test(line) &&
          nextLine &&
          /^[A-Za-z][A-Za-z0-9\s.&]{2,38}$/.test(nextLine)
        ) {
          senderName = nextLine.trim();
        }
      }
    }

    // =========================================================================
    // 8. DATE & TIME (Handles "18-Nov-2026", "16 Nov '26", "7th Nov 26", etc.)
    // =========================================================================
    const datePatterns = [
      /\b(\d{1,2}(?:st|nd|rd|th)?[\s\-]+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?[\s\-]+'?\d{2,4})\b/i,
      /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+'?\d{2,4})\b/i,
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
      /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/,
    ];
    for (const dp of datePatterns) {
      const dm = normalizedText.match(dp);
      if (dm && dm[1]) {
        transactionDate = dm[1].trim();
        break;
      }
    }

    const timeMatch = normalizedText.match(
      /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/
    );
    if (timeMatch && timeMatch[1]) {
      transactionTime = timeMatch[1].trim();
    }

    // =========================================================================
    // 9. BANK DETAILS
    // =========================================================================
    const bankMatch = normalizedText.match(
      /\b((?:State\s*Bank\s*of\s*India|SBI|HDFC\s*Bank|ICICI\s*Bank|Axis\s*Bank|Kotak\s*Mahindra(?:\s*Bank)?|Punjab\s*National\s*Bank|PNB|Bank\s*of\s*Baroda|BOB|Canara\s*Bank|Union\s*Bank|Yes\s*Bank|IndusInd\s*Bank|IDFC\s*First\s*Bank|Federal\s*Bank|Bank\s*of\s*India|Paytm\s*Payments\s*Bank|Airtel\s*Payments\s*Bank)(?:\s*[-–]?\s*(?:A\/C|Account|XX|X{2,}|\*{2,})?)?(?:\s*[0-9]{4})?)\b/i
    );
    if (bankMatch && bankMatch[1]) {
      bankDetails = bankMatch[1].trim();
    }

    // =========================================================================
    // 10. CONFIDENCE SCORE
    // =========================================================================
    let confidencePoints = 0;
    const missingFields: string[] = [];

    if (amountPaise !== null) {
      confidencePoints += 35;
    } else {
      missingFields.push('Transaction Amount');
    }

    if (utrNumber !== null) {
      confidencePoints += 30;
    } else {
      missingFields.push('UTR / Reference Number');
    }

    if (paymentStatus !== null) {
      confidencePoints += 10;
    }

    if (receiverName !== null || senderName !== null) {
      confidencePoints += 10;
    }

    if (transactionDate !== null || transactionTime !== null) {
      confidencePoints += 10;
    }

    if (paymentAppName !== null || upiId !== null) {
      confidencePoints += 5;
    }

    const ocrConfidence = Math.min(100, confidencePoints);
    const isComplete = amountPaise !== null && utrNumber !== null;

    return {
      amountPaise,
      amountFormatted,
      senderName,
      receiverName,
      transactionDate,
      transactionTime,
      utrNumber,
      upiRefNumber,
      transactionId,
      paymentStatus,
      upiId,
      paymentAppName,
      bankDetails,
      ocrConfidence,
      rawText: normalizedText,
      isComplete,
      missingFields,
    };
  },

  /**
   * Checks if screenshot or UTR reference has already been submitted locally.
   */
  checkDuplicate(
    screenshotHash: string,
    utrNumber: string | null,
    transactions: Transaction[]
  ): {
    isDuplicate: boolean;
    duplicateReason?: string;
    duplicateType?: 'hash' | 'utr';
    existingTransactionId?: string;
  } {
    if (screenshotHash) {
      const matchHash = transactions.find(
        (t) => t.screenshotHash === screenshotHash
      );
      if (matchHash) {
        return {
          isDuplicate: true,
          duplicateReason:
            'This payment screenshot has already been submitted.',
          duplicateType: 'hash',
          existingTransactionId: matchHash.id,
        };
      }
    }

    if (utrNumber && utrNumber.trim()) {
      const cleanUtr = utrNumber.trim();
      const matchUtr = transactions.find(
        (t) => t.utrNumber === cleanUtr && t.status !== 'rejected'
      );
      if (matchUtr) {
        return {
          isDuplicate: true,
          duplicateReason: 'This transaction reference already exists.',
          duplicateType: 'utr',
          existingTransactionId: matchUtr.id,
        };
      }
    }

    return { isDuplicate: false };
  },

  /**
   * Main High-Reliability OCR processing pipeline:
   * 1. Uses pre-captured base64 (from ImagePicker base64:true) or reads file cleanly.
   * 2. Tries Native ML Kit (standalone APK) -> Server-side OCR API (/api/admin/ocr/scan) -> Direct urlencoded fallback.
   * 3. Parses Indian UPI / Bank receipts with 100% tuned patterns.
   */
  async processScreenshot(
    imageUri: string,
    knownBase64?: string | null,
    mimeType?: string | null
  ): Promise<{
    hash: string;
    extracted: ExtractedPaymentDetails;
    isDuplicateHash?: boolean;
    scanError?: string;
  }> {
    let base64 = knownBase64
      ? knownBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim()
      : '';

    if (!base64 && imageUri) {
      try {
        base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e) {
        console.warn('Could not read image base64 from URI:', e);
      }
    }

    let hash = '';
    if (base64) {
      hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        base64
      );
    } else {
      hash = await this.computeImageHash(imageUri);
    }

    // 1. Primary (APK / Dev Build): Native ML Kit
    let mlKitParsed: ExtractedPaymentDetails | null = null;
    try {
      if (NativeTextRecognition && typeof NativeTextRecognition.recognize === 'function') {
        const result = await NativeTextRecognition.recognize(imageUri);
        if (result && result.text && result.text.trim().length > 0) {
          const parsed = this.parsePaymentText(result.text.trim());
          if (parsed.amountPaise !== null && (parsed.utrNumber !== null || parsed.transactionId !== null)) {
            return { hash, extracted: parsed };
          }
          mlKitParsed = parsed;
        }
      }
    } catch {
      // Fall through to backend OCR
    }

    // 2. Primary (Expo Go / Mobile): Reliable Server-Side OCR Proxy
    if (base64) {
      const { mime, filetype } = detectImageFormat(base64, mimeType || imageUri);

      try {
        const serverRes = await adminApi.scanReceiptOcr(base64, mime);
        if (serverRes.success && serverRes.rawText) {
          const parsed = this.parsePaymentText(serverRes.rawText);
          const finalExtracted = mlKitParsed ? mergeExtracted(mlKitParsed, parsed) : parsed;
          return {
            hash: serverRes.hash || hash,
            extracted: finalExtracted,
            isDuplicateHash: Boolean(serverRes.isDuplicateHash),
          };
        } else if (serverRes.error) {
          console.warn('Server OCR returned error, trying direct fallback:', serverRes.error);
        }
      } catch (err) {
        console.warn('Server OCR unreachable, trying direct fallback:', err);
      }

      // If server OCR failed but Native ML Kit got text on-device, return ML Kit result!
      if (mlKitParsed && (mlKitParsed.amountPaise !== null || mlKitParsed.utrNumber !== null || mlKitParsed.rawText)) {
        return { hash, extracted: mlKitParsed };
      }

      // 3. Direct Client Fallback (URL-encoded POST — safe on Android React Native)
      const textEngine2 = await callOcrSpace(base64, mime, filetype, '2');
      const parsedEngine2 = this.parsePaymentText(textEngine2);

      if (parsedEngine2.amountPaise !== null && parsedEngine2.utrNumber !== null) {
        return { hash, extracted: parsedEngine2 };
      }

      const textEngine1 = await callOcrSpace(base64, mime, filetype, '1');
      const parsedEngine1 = this.parsePaymentText(textEngine1);

      let merged = mergeExtracted(parsedEngine2, parsedEngine1);
      if (mlKitParsed) {
        merged = mergeExtracted(mlKitParsed, merged);
      }

      return {
        hash,
        extracted: merged,
        scanError:
          !merged.rawText
            ? 'Could not extract text from image. Please ensure screenshot is clear.'
            : undefined,
      };
    }

    if (mlKitParsed) {
      return { hash, extracted: mlKitParsed };
    }

    return {
      hash,
      extracted: this.parsePaymentText(''),
      scanError: 'Could not read image data from device.',
    };
  },
};
