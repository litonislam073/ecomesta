import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  AdjustInventoryDto,
  ListInventoryQueryDto,
  ListMovementsQueryDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List inventory items for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListInventoryQueryDto,
  ) {
    return this.inventoryService.list(user.userId, storeId, query);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust inventory quantity and record a movement' })
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: AdjustInventoryDto,
    @Req() req: Request,
  ) {
    return this.inventoryService.adjust(user.userId, storeId, dto, req);
  }

  @Get(':inventoryItemId')
  @ApiOperation({ summary: 'Get an inventory item by id' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('inventoryItemId', ParseUUIDPipe) inventoryItemId: string,
  ) {
    return this.inventoryService.getOne(user.userId, storeId, inventoryItemId);
  }

  @Get(':inventoryItemId/movements')
  @ApiOperation({ summary: 'List movements for an inventory item' })
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('inventoryItemId', ParseUUIDPipe) inventoryItemId: string,
    @Query() query: ListMovementsQueryDto,
  ) {
    return this.inventoryService.listMovements(
      user.userId,
      storeId,
      inventoryItemId,
      query,
    );
  }
}
