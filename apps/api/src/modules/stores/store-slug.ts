import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { isReservedStoreSlug } from '../domains/domain-normalize';

/**
 * One message for "taken by another store" and "reserved by the platform" so
 * the response does not reveal which slugs other tenants own.
 */
export const STORE_SLUG_TAKEN_MESSAGE = 'Store slug is already taken';

/**
 * Store slugs are global because each one is the `{slug}.{root}` storefront
 * host. The unique index is the real guard; this check gives the common case
 * a clean 409 before any rows are written.
 */
export async function assertStoreSlugAvailable(
  prisma: Pick<PrismaService, 'store'>,
  slug: string,
): Promise<void> {
  if (isReservedStoreSlug(slug)) {
    throw new ConflictException(STORE_SLUG_TAKEN_MESSAGE);
  }
  const existing = await prisma.store.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictException(STORE_SLUG_TAKEN_MESSAGE);
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
