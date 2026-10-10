// Phase 6A: HMAC-SHA256 signing + AES-256-GCM encryption via Node crypto
import crypto from 'crypto';

export const SECRET_KEY_LEN = 32; // AES-256-GCM

export function generateSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function encryptSecret(plaintext: string, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const auth = cipher.getAuthTag();
  return Buffer.concat([iv, auth, enc]);
}

export function decryptSecret(encrypted: Buffer, key: Buffer): string {
  const iv = encrypted.slice(0, 12);
  const auth = encrypted.slice(12, 28);
  const enc = encrypted.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(auth);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function signPayload(body: string, secret: string, deliveryId: string, timestamp: number): string {
  const payload = `${deliveryId}|${timestamp}|${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
