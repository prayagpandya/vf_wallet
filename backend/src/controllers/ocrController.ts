import { Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { TransactionStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

function detectImageFormat(base64: string, hintMime?: string): { mime: string; filetype: string } {
  if (base64.startsWith('iVBOR')) {
    return { mime: 'image/png', filetype: 'PNG' };
  }
  if (base64.startsWith('/9j/')) {
    return { mime: 'image/jpeg', filetype: 'JPG' };
  }
  if (base64.startsWith('UklGR')) {
    return { mime: 'image/webp', filetype: 'WEBP' };
  }
  if (hintMime?.toLowerCase().includes('png')) {
    return { mime: 'image/png', filetype: 'PNG' };
  }
  return { mime: 'image/jpeg', filetype: 'JPG' };
}

async function callOcrSpaceFromServer(
  base64: string,
  mime: string,
  filetype: string,
  engine: '2' | '1'
): Promise<{ text: string; error?: string }> {
  const keys = ['K87899148788957', 'K88328135888957', 'K89457812888957', 'helloworld'];
  let lastError = '';

  for (const apiKey of keys) {
    try {
      const formData = new FormData();
      formData.append('base64Image', `data:${mime};base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('filetype', filetype);
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', engine);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { apikey: apiKey },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        if (data?.IsErroredOnProcessing) {
          lastError = Array.isArray(data.ErrorMessage)
            ? data.ErrorMessage.join('; ')
            : String(data.ErrorMessage || data.ErrorDetails || 'OCR processing error');
          console.warn(`[OCR] Engine ${engine} error (${apiKey}): ${lastError}`);
          continue;
        }
        const parsedText = data?.ParsedResults?.[0]?.ParsedText?.trim();
        if (parsedText && parsedText.length > 0) {
          return { text: parsedText };
        }
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (err: any) {
      lastError = err?.message || 'Network timeout';
      console.warn(`[OCR] Engine ${engine} attempt (${apiKey}) failed: ${lastError}`);
    }
  }

  return { text: '', error: lastError };
}

/**
 * POST /api/admin/ocr/scan
 * Server-side reliable OCR scanner for Expo Go / Mobile clients.
 * Avoids Android React Native FormData & content:// URI issues.
 */
export const scanReceiptOcr = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { base64: rawBase64, mimeType } = req.body;
    if (!rawBase64 || typeof rawBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Image base64 payload is required for OCR scanning.',
      });
    }

    // Strip data URL prefix if present
    const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (!cleanBase64) {
      return res.status(400).json({
        success: false,
        error: 'Empty image payload.',
      });
    }

    // Compute exact SHA-256 hash on server
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(cleanBase64, 'base64'))
      .digest('hex');

    // Check if this screenshot was already processed
    const existingHash = await prisma.transaction.findFirst({
      where: {
        imageHash: hash,
        status: { in: [TransactionStatus.PENDING, TransactionStatus.APPROVED] },
      },
      select: { id: true, utr: true, amountPaise: true },
    });

    const { mime, filetype } = detectImageFormat(cleanBase64, mimeType);
    const sizeKb = Math.round((cleanBase64.length * 3) / 4 / 1024);
    console.log(`[OCR] Scanning ${filetype} image (~${sizeKb} KB) for staff ${req.user.name}...`);

    // Try Engine 2 first, fallback to Engine 1
    let ocrResult = await callOcrSpaceFromServer(cleanBase64, mime, filetype, '2');
    let engineUsed = '2';

    if (!ocrResult.text) {
      ocrResult = await callOcrSpaceFromServer(cleanBase64, mime, filetype, '1');
      engineUsed = '1';
    }

    if (!ocrResult.text) {
      return res.status(502).json({
        success: false,
        hash,
        isDuplicateHash: Boolean(existingHash),
        error:
          ocrResult.error ||
          `OCR engine could not read text from this image (${sizeKb} KB). Try cropping or a clearer screenshot.`,
      });
    }

    console.log(`[OCR] ✅ Extracted ${ocrResult.text.length} chars via Engine ${engineUsed}.`);

    return res.status(200).json({
      success: true,
      hash,
      rawText: ocrResult.text,
      engineUsed,
      isDuplicateHash: Boolean(existingHash),
      existingTransactionId: existingHash?.id || null,
    });
  } catch (error: any) {
    console.error('[OCR] Server scan error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during OCR scan.',
    });
  }
};
