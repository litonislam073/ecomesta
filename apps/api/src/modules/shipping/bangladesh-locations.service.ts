import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BangladeshLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDivisions() {
    const items = await this.prisma.bdDivision.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
    return { success: true as const, data: items };
  }

  /** Districts of one division, or every active district when no division is given. */
  async listDistricts(divisionId?: string) {
    if (divisionId) {
      const division = await this.prisma.bdDivision.findFirst({
        where: { id: divisionId, active: true },
        select: { id: true },
      });
      if (!division) {
        throw new NotFoundException('Division not found');
      }
    }
    const items = await this.prisma.bdDistrict.findMany({
      where: divisionId
        ? { divisionId, active: true }
        : { active: true, division: { active: true } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        divisionId: true,
      },
    });
    return { success: true as const, data: items };
  }

  async listUpazilas(districtId: string) {
    const district = await this.prisma.bdDistrict.findFirst({
      where: { id: districtId, active: true },
      select: { id: true },
    });
    if (!district) {
      throw new NotFoundException('District not found');
    }
    const items = await this.prisma.bdUpazila.findMany({
      where: { districtId, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        districtId: true,
      },
    });
    return { success: true as const, data: items };
  }

  async resolveSnapshotNames(location: {
    divisionId?: string | null;
    districtId?: string | null;
    upazilaId?: string | null;
  }) {
    const [division, district, upazila] = await Promise.all([
      location.divisionId
        ? this.prisma.bdDivision.findUnique({
            where: { id: location.divisionId },
            select: { id: true, name: true },
          })
        : null,
      location.districtId
        ? this.prisma.bdDistrict.findUnique({
            where: { id: location.districtId },
            select: { id: true, name: true, divisionId: true },
          })
        : null,
      location.upazilaId
        ? this.prisma.bdUpazila.findUnique({
            where: { id: location.upazilaId },
            select: {
              id: true,
              name: true,
              districtId: true,
              district: { select: { divisionId: true, name: true } },
            },
          })
        : null,
    ]);

    let divisionId = location.divisionId ?? null;
    let districtId = location.districtId ?? null;
    let upazilaId = location.upazilaId ?? null;
    let divisionName = division?.name ?? null;
    let districtName = district?.name ?? null;
    let upazilaName = upazila?.name ?? null;

    if (upazila) {
      upazilaId = upazila.id;
      upazilaName = upazila.name;
      districtId = upazila.districtId;
      if (!districtName) {
        districtName = upazila.district.name;
      }
      divisionId = upazila.district.divisionId;
      if (!divisionName && divisionId) {
        const div = await this.prisma.bdDivision.findUnique({
          where: { id: divisionId },
          select: { name: true },
        });
        divisionName = div?.name ?? null;
      }
    } else if (district) {
      districtId = district.id;
      districtName = district.name;
      divisionId = district.divisionId;
      if (!divisionName) {
        const div = await this.prisma.bdDivision.findUnique({
          where: { id: divisionId },
          select: { name: true },
        });
        divisionName = div?.name ?? null;
      }
    }

    return {
      divisionId,
      districtId,
      upazilaId,
      divisionName,
      districtName,
      upazilaName,
    };
  }
}
