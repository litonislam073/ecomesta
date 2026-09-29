import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureCors } from './common/cors/cors.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { trustProxySetting } from './common/utils/request-host.util';
import { REFRESH_COOKIE_NAME } from './modules/auth/types/auth.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.set(
    'trust proxy',
    trustProxySetting({
      TRUST_PROXY: configService.get<string>('TRUST_PROXY'),
      TRUSTED_PROXY_HOPS: configService.get<string>('TRUSTED_PROXY_HOPS'),
    }),
  );
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Platform apps: strict allow-list with credentials. Storefront hosts: only
  // their own public store routes, verified against the DB (see cors.config.ts).
  configureCors(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ecomesta API')
      .setDescription('Multi-tenant SaaS ecommerce platform API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addCookieAuth(REFRESH_COOKIE_NAME)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`OpenAPI docs available at /api/docs`);
  } else {
    logger.log('OpenAPI docs disabled in production');
  }

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);

  logger.log(`API listening on port ${port} (prefix: /api/v1)`);
}

void bootstrap();
