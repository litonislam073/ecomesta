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
import { CustomersService } from './customers.service';
import {
  CreateCustomerAddressDto,
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/customers', version: '1' })
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a customer in a store' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customersService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List customers for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.customersService.list(user.userId, storeId, query);
  }

  @Get(':customerId')
  @ApiOperation({ summary: 'Get a customer with addresses' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.getOne(user.userId, storeId, customerId);
  }

  @Patch(':customerId')
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customersService.update(
      user.userId,
      storeId,
      customerId,
      dto,
      req,
    );
  }

  @Delete(':customerId')
  @ApiOperation({
    summary:
      'Delete a customer when no order/coupon history exists (addresses cascade)',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() req: Request,
  ) {
    return this.customersService.remove(user.userId, storeId, customerId, req);
  }

  @Post(':customerId/addresses')
  @ApiOperation({ summary: 'Create a customer address' })
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerAddressDto,
    @Req() req: Request,
  ) {
    return this.customersService.createAddress(
      user.userId,
      storeId,
      customerId,
      dto,
      req,
    );
  }

  @Get(':customerId/addresses')
  @ApiOperation({ summary: 'List addresses for a customer' })
  listAddresses(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.listAddresses(
      user.userId,
      storeId,
      customerId,
    );
  }

  @Get(':customerId/addresses/:addressId')
  @ApiOperation({ summary: 'Get a customer address' })
  getAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.customersService.getAddress(
      user.userId,
      storeId,
      customerId,
      addressId,
    );
  }

  @Patch(':customerId/addresses/:addressId')
  @ApiOperation({ summary: 'Update a customer address' })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
    @Req() req: Request,
  ) {
    return this.customersService.updateAddress(
      user.userId,
      storeId,
      customerId,
      addressId,
      dto,
      req,
    );
  }

  @Delete(':customerId/addresses/:addressId')
  @ApiOperation({ summary: 'Delete a customer address' })
  deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Req() req: Request,
  ) {
    return this.customersService.deleteAddress(
      user.userId,
      storeId,
      customerId,
      addressId,
      req,
    );
  }
}
