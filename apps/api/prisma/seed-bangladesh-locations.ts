import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

type LocationFile = {
  meta: Record<string, unknown>;
  divisions: { code: string; name: string; nameNormalized: string }[];
  districts: {
    code: string;
    name: string;
    nameNormalized: string;
    divisionCode: string;
  }[];
  upazilas: {
    code: string;
    name: string;
    nameNormalized: string;
    districtCode: string;
  }[];
};

/**
 * Idempotent upsert of global Bangladesh hierarchy by stable `code`.
 */
export async function seedBangladeshLocations(
  prisma: PrismaClient,
): Promise<{ divisions: number; districts: number; upazilas: number }> {
  const filePath = join(__dirname, 'data', 'bangladesh-locations.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as LocationFile;

  const divisionIdByCode = new Map<string, string>();
  for (const row of raw.divisions) {
    const existing = await prisma.bdDivision.findUnique({
      where: { code: row.code },
      select: { id: true },
    });
    const id = existing?.id ?? randomUUID();
    await prisma.bdDivision.upsert({
      where: { code: row.code },
      create: {
        id,
        code: row.code,
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
      update: {
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
    });
    divisionIdByCode.set(row.code, existing?.id ?? id);
  }

  const districtIdByCode = new Map<string, string>();
  for (const row of raw.districts) {
    const divisionId = divisionIdByCode.get(row.divisionCode);
    if (!divisionId) {
      throw new Error(
        `District ${row.code} references missing division ${row.divisionCode}`,
      );
    }
    const existing = await prisma.bdDistrict.findUnique({
      where: { code: row.code },
      select: { id: true },
    });
    const id = existing?.id ?? randomUUID();
    await prisma.bdDistrict.upsert({
      where: { code: row.code },
      create: {
        id,
        divisionId,
        code: row.code,
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
      update: {
        divisionId,
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
    });
    districtIdByCode.set(row.code, existing?.id ?? id);
  }

  let upazilaCount = 0;
  for (const row of raw.upazilas) {
    const districtId = districtIdByCode.get(row.districtCode);
    if (!districtId) {
      throw new Error(
        `Upazila ${row.code} references missing district ${row.districtCode}`,
      );
    }
    const existing = await prisma.bdUpazila.findUnique({
      where: { code: row.code },
      select: { id: true },
    });
    const id = existing?.id ?? randomUUID();
    await prisma.bdUpazila.upsert({
      where: { code: row.code },
      create: {
        id,
        districtId,
        code: row.code,
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
      update: {
        districtId,
        name: row.name,
        nameNormalized: row.nameNormalized,
        active: true,
      },
    });
    upazilaCount += 1;
  }

  return {
    divisions: raw.divisions.length,
    districts: raw.districts.length,
    upazilas: upazilaCount,
  };
}
