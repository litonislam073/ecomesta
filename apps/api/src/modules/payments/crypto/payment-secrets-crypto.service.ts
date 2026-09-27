import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Application-level AES-256-GCM for payment provider secrets at rest.
 * Key: PAYMENT_SECRETS_ENCRYPTION_KEY (32-byte hex or utf8 passphrase hashed to 32 bytes).
 */
@Injectable()
export class PaymentSecretsCryptoService {
  constructor(private readonly config: ConfigService) {}

  encryptJson(value: Record<string, unknown>): string {
    const key = this.resolveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    // format: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decryptJson(ciphertext: string): Record<string, unknown> {
    const key = this.resolveKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new ServiceUnavailableException(
        'Payment secret ciphertext is invalid or unsupported',
      );
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64!, 'base64url');
    const tag = Buffer.from(tagB64!, 'base64url');
    const data = Buffer.from(dataB64!, 'base64url');
    if (tag.length !== AUTH_TAG_LENGTH) {
      throw new ServiceUnavailableException('Payment secret auth tag is invalid');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>;
  }

  private resolveKey(): Buffer {
    const raw = this.config.get<string>('PAYMENT_SECRETS_ENCRYPTION_KEY');
    if (!raw || raw.trim().length < 16) {
      throw new ServiceUnavailableException(
        'PAYMENT_SECRETS_ENCRYPTION_KEY is not configured',
      );
    }
    const trimmed = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    // Derive a 32-byte key from passphrase (not for low-entropy passwords in production).
    return createHash('sha256').update(trimmed, 'utf8').digest();
  }
}
