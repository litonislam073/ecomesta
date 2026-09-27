import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { DemoCatalogService } from './demo-catalog.service';

@ApiTags('demo-catalog')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/demo-catalog', version: '1' })
export class DemoCatalogController {
  constructor(private readonly demoCatalogService: DemoCatalogService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Whether the optional sample catalog can still be imported',
  })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.demoCatalogService.status(user.userId, storeId);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import the one-time sample catalog (categories, products, stock)',
  })
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Req() req: Request,
  ) {
    return this.demoCatalogService.import(user.userId, storeId, req);
  }
}
