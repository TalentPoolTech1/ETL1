import crypto from 'crypto';

/**
 * Standard AES-256-GCM encryption/decryption for application-level secrets.
 * 
 * Rules:
 *  - Uses 12-byte IV (nonce)
 *  - Includes 16-byte Auth Tag
 *  - Formats result as iv:authTag:encryptedValue (hex)
 */
export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;
  private static readonly ENCODING = 'hex';

  /**
   * Encrypts a plaintext string using the provided key.
   * Key must be 32 bytes (256 bits).
   */
  static encrypt(plaintext: string, key: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.deriveKey(key), iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return `${iv.toString(this.ENCODING)}:${tag.toString(this.ENCODING)}:${encrypted.toString(this.ENCODING)}`;
  }

  /**
   * Decrypts an encrypted string (iv:tag:blob) using the provided key.
   */
  static decrypt(encryptedText: string, key: string): string {
    const [ivHex, tagHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      throw new Error('Invalid encryption format. Expected iv:tag:blob');
    }

    const iv = Buffer.from(ivHex, this.ENCODING);
    const tag = Buffer.from(tagHex, this.ENCODING);
    const encrypted = Buffer.from(encryptedHex, this.ENCODING);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.deriveKey(key), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Ensures the key is exactly 32 bytes.
   * If shorter, it pads; if longer, it trims.
   * In a production system, we might use PBKDF2/scrypt here.
   */
  private static deriveKey(key: string): Buffer {
    return crypto.createHash('sha256').update(key).digest();
  }
}
