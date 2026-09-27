import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import type { Request } from 'express';
import {
  InitiatePublicPaymentDto,
  RetryPublicPaymentDto,
} from './dto/payment-provider.dto';
import { PaymentOrchestrationService } from './payment-orchestration.service';

@ApiTags('public-payments')
@Controller({ path: 'public', version: '1' })
export class PublicPaymentsController {
  constructor(private readonly orchestration: PaymentOrchestrationService) {}

  @Get('stores/:storeSlug/payment-providers')
  @ApiOperation({
    summary: 'List offline + enabled online payment options for checkout',
  })
  listProviders(@Param('storeSlug') storeSlug: string) {
    return this.orchestration.listPublicProviders(storeSlug);
  }

  @Post('stores/:storeSlug/payments/create')
  @ApiOperation({
    summary:
      'Initiate online payment for an existing order (amount from Order.grandTotal)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  initiate(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: InitiatePublicPaymentDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orchestration.initiatePublicPayment(
      storeSlug,
      {
        publicReference: dto.publicReference,
        provider: dto.provider,
        email: dto.email,
        phone: dto.phone,
        idempotencyKey: idempotencyKey ?? null,
      },
      req,
    );
  }

  @Post('stores/:storeSlug/payments/retry')
  @ApiOperation({
    summary: 'Retry a failed/cancelled online payment without a new order',
  })
  retry(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: RetryPublicPaymentDto,
    @Req() req: Request,
  ) {
    return this.orchestration.retryPublicPayment(
      storeSlug,
      {
        publicReference: dto.publicReference,
        provider: dto.provider,
        email: dto.email,
        phone: dto.phone,
      },
      req,
    );
  }

  @Get('stores/:storeSlug/payments/:internalReference')
  @ApiOperation({
    summary: 'Fetch payment status (informational; never marks paid)',
  })
  getStatus(
    @Param('storeSlug') storeSlug: string,
    @Param('internalReference') internalReference: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.orchestration.getPublicPaymentStatus(
      storeSlug,
      internalReference,
      { email, phone },
    );
  }

  @Post('payment-webhooks/:provider')
  @ApiOperation({
    summary:
      'Provider webhook (signature-verified). Redirect pages must NOT mark paid.',
  })
  webhook(
    @Param('provider', new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() _body: unknown,
  ) {
    const rawBody =
      req.rawBody ??
      Buffer.from(
        typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {}),
        'utf8',
      );
    return this.orchestration.handleWebhook(provider, rawBody, req.headers);
  }
}
