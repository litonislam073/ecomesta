import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { EmailTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/account-recovery.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthenticatedUser } from './types/auth.types';
import { REFRESH_COOKIE_NAME } from './types/auth.types';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, req, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  @Get('providers')
  @ApiOperation({ summary: 'List enabled third-party sign-in providers and their public client IDs' })
  providers() {
    return this.authService.authProviders();
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in or register with a Google Identity Services ID token' })
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.googleSignIn(dto, req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    return this.authService.refresh(dto.refreshToken ?? cookieToken, req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Revoke the current auth session (Bearer and/or refresh cookie) and clear the refresh cookie',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authorization = req.headers.authorization;
    return this.authService.logoutFlexible(
      req,
      res,
      typeof authorization === 'string' ? authorization : undefined,
    );
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user profile and memberships' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email password reset instructions (generic response whether or not the account exists)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.recovery.forgotPassword(dto.email, req);
  }

  @Post('reset-password/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check that a password reset token is valid, unused and unexpired' })
  validateResetToken(@Body() dto: EmailTokenDto, @Req() req: Request) {
    return this.recovery.validateResetToken(dto.token, req);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password with a reset token and revoke all sessions' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.recovery.resetPassword(dto.token, dto.password, req);
  }

  @Post('email-verification/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Email a verification link to the signed-in user' })
  sendEmailVerification(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.recovery.requestEmailVerification(user.userId, req);
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address with a verification token' })
  confirmEmailVerification(@Body() dto: EmailTokenDto, @Req() req: Request) {
    return this.recovery.confirmEmailVerification(dto.token, req);
  }
}
