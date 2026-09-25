import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { parseCorsOrigins } from '@ecomesta/utils';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { REFRESH_COOKIE_NAME } from './modules/auth/types/auth.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
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

  const configuredOrigins = parseCorsOrigins(configService.get<string>('CORS_ORIGINS'));
  const appOrigins = [
    configService.get<string>('WEB_URL'),
    configService.get<string>('MERCHANT_URL'),
    configService.get<string>('ADMIN_URL'),
  ].filter((origin): origin is string => Boolean(origin));

  const corsOrigins = Array.from(new Set([...configuredOrigins, ...appOrigins]));

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ecomesta API')
    .setDescription('Multi-tenant SaaS ecommerce platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);

  logger.log(`API listening on port ${port} (prefix: /api/v1)`);
  logger.log(`OpenAPI docs available at /api/docs`);
}

void bootstrap();
