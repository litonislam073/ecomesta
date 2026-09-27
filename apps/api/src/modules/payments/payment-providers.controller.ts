import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  UpdatePaymentProviderConfigDto,
  UpsertPaymentProviderConfigDto,
} from './dto/payment-provider.dto';
import { PaymentProviderConfigService } from './payment-provider-config.service';

@ApiTags('payment-providers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/payment-providers', version: '1' })
export class PaymentProvidersController {
  constructor(private readonly configs: PaymentProviderConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List payment provider configs for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.configs.list(user.userId, storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or upsert a payment provider config' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertPaymentProviderConfigDto,
    @Req() req: Request,
  ) {
    return this.configs.upsert(user.userId, storeId, dto, req);
  }

  @Patch(':provider')
  @ApiOperation({ summary: 'Update a payment provider config' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('provider', new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
    @Body() dto: UpdatePaymentProviderConfigDto,
    @Req() req: Request,
  ) {
    return this.configs.update(user.userId, storeId, provider, dto, req);
  }

  @Delete(':provider')
  @ApiOperation({ summary: 'Remove a payment provider config' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('provider', new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
    @Req() req: Request,
  ) {
    return this.configs.remove(user.userId, storeId, provider, req);
  }

  @Post(':provider/validate')
  @ApiOperation({
    summary:
      'Validate stored provider secrets (connectivity check; does not charge)',
  })
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('provider', new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
  ) {
    return this.configs.validate(user.userId, storeId, provider);
  }
}
