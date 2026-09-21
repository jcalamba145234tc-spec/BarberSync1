import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseStorage } from './firebase';

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
