import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus, PlatformRole, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type {
  AccessTokenPayload,
  AuthTokens,
  AuthenticatedUser,
  RefreshTokenPayload,
  SafeUserProfile,
  StoreMembershipContext,
  TenantMembershipContext,
} from './types/auth.types';
import { REFRESH_COOKIE_NAME } from './types/auth.types';

const BLOCKED_STATUSES: UserStatus[] = [
  UserStatus.INACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.PENDING,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  async register(dto: RegisterDto, req: Request, res: Response) {
    await this.enforceRateLimit(`register:${this.clientIp(req)}`, 10, 60);

    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        platformRole: PlatformRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const tokens = await this.issueSession(user.id, user.email, user.platformRole, req);
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      success: true as const,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: await this.toSafeProfile(user.id),
      },
    };
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    await this.enforceRateLimit(`login:${this.clientIp(req)}:${dto.email}`, 20, 60);

    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.assertUserCanAuthenticate(user.status);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueSession(user.id, user.email, user.platformRole, req);
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      success: true as const,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: await this.toSafeProfile(user.id),
      },
    };
  }

  async refresh(rawRefreshToken: string | undefined, req: Request, res: Response) {
    await this.enforceRateLimit(`refresh:${this.clientIp(req)}`, 30, 60);

    const token = rawRefreshToken?.trim();
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh' || !payload.sid || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const tokenHash = this.passwordService.hashToken(token);
    if (!this.passwordService.secureCompare(session.tokenHash, tokenHash)) {
      // Possible reuse / theft — revoke session
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.assertUserCanAuthenticate(session.user.status);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueSession(
      session.user.id,
      session.user.email,
      session.user.platformRole,
      req,
    );
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      success: true as const,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  async logout(user: AuthenticatedUser, res: Response) {
    await this.prisma.authSession.updateMany({
      where: {
        id: user.sessionId,
        userId: user.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.clearRefreshCookie(res);

    return {
      success: true as const,
      data: { loggedOut: true },
    };
  }

  async me(userId: string): Promise<{ success: true; data: SafeUserProfile }> {
    return {
      success: true,
      data: await this.toSafeProfile(userId),
    };
  }

  async validateAccessPayload(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session has expired');
    }

    this.assertUserCanAuthenticate(session.user.status);

    return {
      userId: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole,
      status: session.user.status,
      sessionId: session.id,
    };
  }

  async loadMemberships(userId: string): Promise<{
    tenants: SafeUserProfile['memberships']['tenants'];
    stores: SafeUserProfile['memberships']['stores'];
  }> {
    const [tenants, stores] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where: { userId, status: MembershipStatus.ACTIVE },
        select: { tenantId: true, role: true, status: true },
      }),
      this.prisma.storeUser.findMany({
        where: { userId, status: MembershipStatus.ACTIVE },
        select: { storeId: true, role: true, status: true },
      }),
    ]);

    return {
      tenants: tenants.map(
        (item): TenantMembershipContext => ({
          tenantId: item.tenantId,
          role: item.role,
          status: item.status,
        }),
      ),
      stores: stores.map(
        (item): StoreMembershipContext => ({
          storeId: item.storeId,
          role: item.role,
          status: item.status,
        }),
      ),
    };
  }

  private async toSafeProfile(userId: string): Promise<SafeUserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        platformRole: true,
      },
    });

    const memberships = await this.loadMemberships(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      platformRole: user.platformRole,
      memberships,
    };
  }

  private async issueSession(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    req: Request,
  ): Promise<AuthTokens> {
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const session = await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: 'pending',
        expiresAt: new Date(Date.now() + this.parseDurationMs(refreshExpiresIn)),
        userAgent: req.headers['user-agent']?.toString().slice(0, 512) ?? null,
        ipAddress: this.clientIp(req),
      },
    });

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sid: session.id,
      typ: 'access',
      email,
      platformRole,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: session.id,
      typ: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { tokenHash: this.passwordService.hashToken(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  private assertUserCanAuthenticate(status: UserStatus): void {
    if (BLOCKED_STATUSES.includes(status) || status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not allowed to authenticate');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private async enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const allowed = await this.rateLimit.consume(key, limit, windowSeconds);
    if (!allowed) {
      throw new ForbiddenException('Too many requests. Please try again later.');
    }
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth',
      maxAge: this.parseDurationMs(refreshExpiresIn),
    });
  }

  private clearRefreshCookie(res: Response): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth',
    });
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/i.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
