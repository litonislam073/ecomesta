import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REFRESH_COOKIE_NAME, type RefreshTokenPayload } from '../types/auth.types';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.cookies?.[REFRESH_COOKIE_NAME]) {
            return req.cookies[REFRESH_COOKIE_NAME] as string;
          }
          const bodyToken = (req?.body as { refreshToken?: string } | undefined)?.refreshToken;
          return bodyToken ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): {
    payload: RefreshTokenPayload;
    rawToken: string;
  } {
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rawToken =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken;

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return { payload, rawToken };
  }
}
