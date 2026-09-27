import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/domain.dto';

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/domains', version: '1' })
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @ApiOperation({
    summary: 'List store domains, provisioning the platform subdomain if needed',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.domains.list(user.userId, storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Attach a custom domain and issue its DNS challenge' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateDomainDto,
    @Req() req: Request,
  ) {
    return this.domains.create(user.userId, storeId, dto, req);
  }

  @Get(':domainId')
  @ApiOperation({ summary: 'Get a single store domain' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.domains.get(user.userId, storeId, domainId);
  }

  @Post(':domainId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check the DNS TXT challenge for a custom domain' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.verify(user.userId, storeId, domainId, req);
  }

  @Post(':domainId/regenerate-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Issue a new DNS verification token (returned once; previous token invalidated)',
  })
  regenerateVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.regenerateVerificationToken(
      user.userId,
      storeId,
      domainId,
      req,
    );
  }

  @Post(':domainId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start serving the storefront on a verified domain' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.activate(user.userId, storeId, domainId, req);
  }

  @Post(':domainId/set-primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make an active domain the canonical storefront host' })
  setPrimary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.setPrimary(user.userId, storeId, domainId, req);
  }

  @Post(':domainId/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop serving a custom domain without deleting it' })
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.disable(user.userId, storeId, domainId, req);
  }

  @Delete(':domainId')
  @ApiOperation({ summary: 'Remove a custom domain from the store' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    return this.domains.remove(user.userId, storeId, domainId, req);
  }
}
