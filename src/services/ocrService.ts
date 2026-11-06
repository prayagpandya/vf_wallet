import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { ExtractedPaymentDetails, Transaction } from '../types';
import { rupeesToPaise, formatPaiseToINR } from '../utils/currency';

// Dynamic import or lazy link of ML Kit Text Recognition
let NativeTextRecognition: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mlkit = require('@react-native-ml-kit/text-recognition');
  NativeTextRecognition = mlkit.default || mlkit;
} catch (e) {
  // Graceful fallback if native module is not linked in development environment
  NativeTextRecognition = null;
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
          // Read chunk or base64 to compute hash
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            base64
          );
        }
      }
      // Fallback hash from URI string
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
   * Performs text recognition on the given image URI.
   * Uses @react-native-ml-kit/text-recognition if native module is present.
   * In Expo Go (where native modules are not bundled), gracefully falls back
   * to a cloud OCR engine so scanning works everywhere.
   */
  async recognizeText(imageUri: string): Promise<string> {
    // 1. Primary: Native ML Kit Text Recognition (Development Build & Standalone APK)
    try {
      if (NativeTextRecognition && typeof NativeTextRecognition.recognize === 'function') {
        const result = await NativeTextRecognition.recognize(imageUri);
        if (result && result.text && result.text.trim().length > 0) {
          return result.text;
        }
      }
    } catch (nativeError) {
      console.warn('Native ML Kit unavailable in Expo Go. Engaging OCR engine fallback...');
    }

    // 2. Secondary Fallback: Works seamlessly inside Expo Go
    try {
      if (imageUri) {
        let base64 = '';
        if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        if (base64) {
          const formData = new FormData();
          formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
          formData.append('language', 'eng');
          formData.append('isOverlayRequired', 'false');
          formData.append('filetype', 'JPG');
          formData.append('detectOrientation', 'true');
          formData.append('scale', 'true');
          formData.append('OCREngine', '2');

          const keys = ['K87899148788957', 'helloworld'];
          for (const apiKey of keys) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000);

              const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                headers: {
                  apikey: apiKey,
                },
                body: formData,
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (response.ok) {
                const data = await response.json();
                if (
                  data &&
                  data.ParsedResults &&
                  data.ParsedResults[0] &&
                  data.ParsedResults[0].ParsedText
                ) {
                  const text = data.ParsedResults[0].ParsedText.trim();
                  if (text.length > 0) {
                    return text;
                  }
                }
              }
            } catch (err) {
              console.warn(`OCR fallback attempt with key ${apiKey} failed:`, err);
            }
          }
        }
      }
    } catch (fallbackError) {
      console.warn('Fallback OCR error:', fallbackError);
    }

    return '';
  },

  /**
   * Structured parsing engine for Indian UPI Payment screenshots.
   * Parses Google Pay, PhonePe, Paytm, BHIM UPI, Bank IMPS/NEFT receipts,
   * utility bill payments (Electricity, Water, Gas), and merchant receipts.
   */
  parsePaymentText(rawText: string): ExtractedPaymentDetails {
    const lines = rawText
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

    // 1. Detect Payment App
    const lowerText = rawText.toLowerCase();
    if (lowerText.includes('google pay') || lowerText.includes('gpay')) {
      paymentAppName = 'Google Pay';
    } else if (
      lowerText.includes('phonepe') ||
      lowerText.includes('phone pe') ||
      lowerText.includes('bill payment successful') ||
      lowerText.includes('electricity bill paid') ||
      lowerText.includes('pgvcl') ||
      lowerText.includes('ugvcl') ||
      lowerText.includes('dgvcl') ||
      lowerText.includes('mgvcl')
    ) {
      paymentAppName = 'PhonePe';
    } else if (lowerText.includes('paytm')) {
      paymentAppName = 'Paytm';
    } else if (lowerText.includes('bhim')) {
      paymentAppName = 'BHIM UPI';
    } else if (lowerText.includes('cred')) {
      paymentAppName = 'CRED';
    } else if (lowerText.includes('amazon pay')) {
      paymentAppName = 'Amazon Pay';
    } else if (
      lowerText.includes('axis') ||
      lowerText.includes('icici') ||
      lowerText.includes('hdfc') ||
      lowerText.includes('sbi')
    ) {
      paymentAppName = 'Bank UPI App';
    }

    // 2. Detect Payment Status
    if (
      /\b(paid|success|successful|completed|payment successful|payment completed|bill payment successful)\b/i.test(
        rawText
      )
    ) {
      paymentStatus = 'SUCCESS';
    } else if (/\b(pending|processing|in progress)\b/i.test(rawText)) {
      paymentStatus = 'PENDING';
    } else if (/\b(failed|declined|rejected)\b/i.test(rawText)) {
      paymentStatus = 'FAILED';
    }

    // 3. Detect Amount (₹ symbol, Total Amount, or INR/Rs prefix)
    const amountRegexes = [
      /(?:total\s*amount|bill\s*amount)\s*[:=]?\s*₹?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
      /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
      /(?:paid|amount|transferred|transfer|sum of)\s*[:=]?\s*₹?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
      /^[₹\s]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)$/m,
    ];

    for (const regex of amountRegexes) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        const cleanedStr = match[1].replace(/,/g, '');
        const val = parseFloat(cleanedStr);
        if (!isNaN(val) && val > 0 && val < 100000000) {
          amountPaise = rupeesToPaise(val);
          amountFormatted = formatPaiseToINR(amountPaise);
          break;
        }
      }
    }

    // 4. Detect UTR (12-digit reference number)
    const utrRegexes = [
      /\b(?:UTR|UTR\s*No|UTR\s*Number|UPI\s*Ref(?:erence)?\s*(?:No|ID|Number)?|RRN|Ref\s*No)\s*[:#\-]?\s*([0-9]{12})\b/i,
      /\b(?:Reference|Ref)\s*(?:Number|No)?\s*[:#\-]?\s*([0-9]{12})\b/i,
      /\b([0-9]{12})\b/, // 12 continuous digits typical for Indian bank UTR
    ];

    for (const regex of utrRegexes) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        utrNumber = match[1];
        upiRefNumber = match[1];
        break;
      }
    }

    // 5. Detect Transaction ID
    const txnIdMatch = rawText.match(
      /\b(?:Transaction\s*ID|Txn\s*ID|Google\s*transaction\s*ID|Payment\s*ID|Reference\s*ID)\s*[:#\-]?\s*([A-Za-z0-9_-]{8,35})\b/i
    );
    if (txnIdMatch && txnIdMatch[1]) {
      transactionId = txnIdMatch[1];
    } else if (utrNumber) {
      transactionId = `TXN-${utrNumber}`;
    }

    // 6. Detect UPI ID (VPA)
    const upiMatch = rawText.match(
      /\b([a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32})\b/
    );
    if (upiMatch && upiMatch[1]) {
      upiId = upiMatch[1].trim();
    }

    // 7. Detect Receiver & Sender Name
    const receiverMatch = rawText.match(
      /(?:Electricity\s*bill\s*paid|To|Paid\s*to|Transfer(?:red)?\s*to|Sent\s*to|Biller(?:\s*Name)?)\s*[:\-]?\s*([A-Za-z0-9\s&.]{3,35})(?:\n|$|\s{2,}|@|₹)/i
    );
    if (receiverMatch && receiverMatch[1]) {
      receiverName = receiverMatch[1].trim();
    }

    const senderMatch = rawText.match(
      /(?:From|Debited\s*from|Sender|Customer\s*Name)\s*[:\-]?\s*([A-Za-z0-9\s&.]{3,35})(?:\n|$|\s{2,})/i
    );
    if (senderMatch && senderMatch[1]) {
      senderName = senderMatch[1].trim();
    }

    // 8. Detect Date & Time
    const dateMatch1 = rawText.match(
      /\b(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4})\b/i
    );
    const dateMatch2 = rawText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);

    if (dateMatch1 && dateMatch1[1]) {
      transactionDate = dateMatch1[1];
    } else if (dateMatch2 && dateMatch2[1]) {
      transactionDate = dateMatch2[1];
    }

    const timeMatch = rawText.match(
      /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/
    );
    if (timeMatch && timeMatch[1]) {
      transactionTime = timeMatch[1];
    }

    // 9. Detect Bank Details
    const bankMatch = rawText.match(
      /\b((?:State\s*Bank\s*of\s*India|SBI|HDFC\s*Bank|ICICI\s*Bank|Axis\s*Bank|Kotak\s*Mahindra|Punjab\s*National\s*Bank|PNB|Bank\s*of\s*Baroda|Canara\s*Bank|Yes\s*Bank|IndusInd\s*Bank)(?:\s*(?:A\/C|Account|XX|X{2,}))?(?:\s*[0-9]{4})?)\b/i
    );
    if (bankMatch && bankMatch[1]) {
      bankDetails = bankMatch[1].trim();
    }

    // 10. Calculate Confidence Score
    let confidencePoints = 0;
    const missingFields: string[] = [];

    if (amountPaise !== null) {
      confidencePoints += 30;
    } else {
      missingFields.push('Transaction Amount');
    }

    if (utrNumber !== null) {
      confidencePoints += 25;
    } else {
      missingFields.push('UTR / Reference Number');
    }

    if (paymentStatus !== null) {
      confidencePoints += 15;
    } else {
      missingFields.push('Payment Status');
    }

    if (receiverName !== null || senderName !== null) {
      confidencePoints += 10;
    } else {
      missingFields.push('Name');
    }

    if (transactionDate !== null || transactionTime !== null) {
      confidencePoints += 10;
    } else {
      missingFields.push('Date & Time');
    }

    if (paymentAppName !== null || upiId !== null) {
      confidencePoints += 10;
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
      rawText,
      isComplete,
      missingFields,
    };
  },

  /**
   * Checks if screenshot or UTR reference has already been submitted.
   * Prevents duplicate transactions per requirements Section 7.
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
    // 1. Check Screenshot File Hash
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

    // 2. Check UTR / Reference Number
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
   * Main OCR processing pipeline.
   * Takes image URI, hashes file, recognizes text, and parses structured fields.
   */
  async processScreenshot(imageUri: string): Promise<{
    hash: string;
    extracted: ExtractedPaymentDetails;
  }> {
    const hash = await this.computeImageHash(imageUri);
    const rawText = await this.recognizeText(imageUri);
    const extracted = this.parsePaymentText(rawText);

    return {
      hash,
      extracted,
    };
  },
};

