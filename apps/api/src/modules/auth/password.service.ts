import { createHash, timingSafeEqual } from 'crypto';
import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    // @node-rs/argon2 defaults to Argon2id
    return hash(plain, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }

  async verify(hashValue: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashValue, plain);
    } catch {
      return false;
    }
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  secureCompare(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }
}
