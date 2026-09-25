import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores', version: '1' })
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({
    summary: 'List stores accessible to the current merchant user',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.listAccessible(user.userId);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get a store by id when authorized' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.storesService.getById(user.userId, storeId);
  }
}
