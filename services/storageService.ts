import * as ImageManipulator from 'expo-image-manipulator';

/** Firestore documents are capped at 1 MiB, so the base64 copy must stay well
 * under that. 350 KB of base64 text leaves plenty of room for the rest of
 * the transaction fields. */
const MAX_BASE64_CHARS = 350_000;

/**
 * Resizes and compresses a screenshot, then returns it as base64 text.
 * This is what lets ANY device (including the admin's, on a different phone)
 * see the screenshot straight from Firestore, without needing the paid
 * Firebase Storage (Blaze) plan.
 */
export async function getGcashScreenshotBase64(localUri: string): Promise<string | null> {
  try {
    let width = 900;
    let quality = 0.5;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (result.base64 && result.base64.length <= MAX_BASE64_CHARS) {
        return result.base64;
      }
      // Still too big: shrink further and try again.
      width = Math.round(width * 0.7);
      quality = Math.max(0.3, quality - 0.1);
    }
    console.warn('[BarberSync] Screenshot too large even after compression, skipping base64 copy.');
    return null;
  } catch (error) {
    console.warn('[BarberSync] Screenshot compression failed.', error);
    return null;
  }
}

