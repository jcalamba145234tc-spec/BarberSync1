import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { firebaseStorage } from './firebase';

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

/**
 * Uploads a GCash screenshot and returns its download URL.
 *
 * The path is scoped to the uploader's uid so one barber can no longer
 * overwrite another barber's proof of payment (Storage rules enforce this).
 * Returns null when Storage is not configured, so the caller can keep the
 * local copy and upload it later during sync.
 */
export async function uploadGcashScreenshot(
  localUri: string,
  transactionId: string,
  ownerUid: string
): Promise<string | null> {
  if (!firebaseStorage) return null;
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const fileRef = ref(firebaseStorage, `gcash-screenshots/${ownerUid}/${transactionId}.jpg`);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.warn('[BarberSync] Screenshot upload failed, it will retry on next sync.', error);
    return null;
  }
}
