import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    AuthTokensModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountRecoveryService,
    PasswordService,
    AuthRateLimitService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    RolesGuard,
  ],
  exports: [AuthService, PasswordService, AccessTokenStrategy, RolesGuard],
})
export class AuthModule {}
