import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AuthTokenPurpose, Prisma, type AuthToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type TokenInspection =
  | { status: 'valid'; token: AuthToken }
  | { status: 'invalid' | 'expired' | 'used' };

/** 32 random bytes, base64url: 43 characters. */
export const AUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashAuthToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Single-use emailed tokens (password reset, email verification). The raw
 * token only ever exists in memory and in the emailed link; the database
 * keeps its SHA-256 hash.
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a fresh token and deletes the user's other unused tokens of the same purpose. */
  async issue(
    userId: string,
    purpose: AuthTokenPurpose,
    ttlMs: number,
    requestedIp?: string | null,
  ): Promise<{ id: string; token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMs);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
      return tx.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: hashAuthToken(token),
          expiresAt,
          requestedIp: requestedIp ?? null,
        },
        select: { id: true },
      });
    });
    return { id: record.id, token, expiresAt };
  }

  async inspect(rawToken: string, purpose: AuthTokenPurpose): Promise<TokenInspection> {
    if (!AUTH_TOKEN_PATTERN.test(rawToken)) return { status: 'invalid' };
    const token = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashAuthToken(rawToken) },
    });
    if (!token || token.purpose !== purpose) return { status: 'invalid' };
    if (token.usedAt) return { status: 'used' };
    if (token.expiresAt.getTime() <= Date.now()) return { status: 'expired' };
    return { status: 'valid', token };
  }

  /**
   * Atomically marks a token used. Returns false when another request consumed
   * it first or it expired in between, so a token can never be used twice.
   */
  async consume(tx: Prisma.TransactionClient, tokenId: string, now = new Date()): Promise<boolean> {
    const result = await tx.authToken.updateMany({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return result.count === 1;
  }
}
