import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function parseMoney(value: unknown, field: string): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException(`${field} is required`);
  }
  const asString = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(asString)) {
    throw new BadRequestException(`${field} must be a non-negative amount with up to 2 decimals`);
  }
  const decimal = new Prisma.Decimal(asString);
  if (decimal.isNegative()) {
    throw new BadRequestException(`${field} cannot be negative`);
  }
  return decimal;
}

export function parseOptionalMoney(
  value: unknown,
  field: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return parseMoney(value, field);
}

export function moneyToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value.toFixed(2);
}

export interface OffsetPageQuery {
  page?: number;
  limit?: number;
}

export function normalizePagination(query: OffsetPageQuery): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
