import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CreateShippingMethodDto,
  ListShippingMethodsQueryDto,
  UpdateShippingMethodDto,
} from './dto/shipping-method.dto';
import { ShippingService } from './shipping.service';

@ApiTags('shipping-methods')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/shipping-methods', version: '1' })
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a store shipping method' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateShippingMethodDto,
    @Req() req: Request,
  ) {
    return this.shippingService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List shipping methods for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListShippingMethodsQueryDto,
  ) {
    return this.shippingService.list(user.userId, storeId, query);
  }

  @Get(':shippingMethodId')
  @ApiOperation({ summary: 'Get a shipping method' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('shippingMethodId', ParseUUIDPipe) shippingMethodId: string,
  ) {
    return this.shippingService.getOne(
      user.userId,
      storeId,
      shippingMethodId,
    );
  }

  @Patch(':shippingMethodId')
  @ApiOperation({ summary: 'Update a shipping method' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('shippingMethodId', ParseUUIDPipe) shippingMethodId: string,
    @Body() dto: UpdateShippingMethodDto,
    @Req() req: Request,
  ) {
    return this.shippingService.update(
      user.userId,
      storeId,
      shippingMethodId,
      dto,
      req,
    );
  }

  @Delete(':shippingMethodId')
  @ApiOperation({ summary: 'Delete a shipping method' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('shippingMethodId', ParseUUIDPipe) shippingMethodId: string,
    @Req() req: Request,
  ) {
    return this.shippingService.remove(
      user.userId,
      storeId,
      shippingMethodId,
      req,
    );
  }
}
