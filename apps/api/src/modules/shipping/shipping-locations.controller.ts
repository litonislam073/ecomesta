import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { BangladeshLocationsService } from './bangladesh-locations.service';

@ApiTags('shipping-locations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/locations', version: '1' })
export class ShippingLocationsController {
  constructor(
    private readonly locations: BangladeshLocationsService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get('divisions')
  @ApiOperation({
    summary: 'List Bangladesh divisions (global data; requires store access)',
  })
  async listDivisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    await this.authorization.assertStoreAccess(user.userId, storeId);
    return this.locations.listDivisions();
  }

  @Get('districts')
  @ApiOperation({ summary: 'List districts for a division' })
  @ApiQuery({ name: 'divisionId', required: true })
  async listDistricts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('divisionId', ParseUUIDPipe) divisionId: string,
  ) {
    await this.authorization.assertStoreAccess(user.userId, storeId);
    return this.locations.listDistricts(divisionId);
  }

  @Get('upazilas')
  @ApiOperation({ summary: 'List upazilas for a district' })
  @ApiQuery({ name: 'districtId', required: true })
  async listUpazilas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('districtId', ParseUUIDPipe) districtId: string,
  ) {
    await this.authorization.assertStoreAccess(user.userId, storeId);
    return this.locations.listUpazilas(districtId);
  }
}
