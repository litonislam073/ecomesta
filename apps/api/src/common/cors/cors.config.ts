import type { INestApplication } from '@nestjs/common';
import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { parseCorsOrigins } from '@ecomesta/utils';
import { StorefrontCorsService } from '../../modules/domains/storefront-cors.service';
import {
  STOREFRONT_CORS_HEADERS,
  STOREFRONT_CORS_MAX_AGE_SECONDS,
  STOREFRONT_CORS_METHODS,
  isPlatformOrigin,
  storefrontStoreSlugFromPath,
} from './cors-policy';

/** Platform app origins: CORS_ORIGINS plus WEB_URL / MERCHANT_URL / ADMIN_URL. */
export function platformCorsOrigins(config: ConfigService): string[] {
  const configured = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const apps = [
    config.get<string>('WEB_URL'),
    config.get<string>('MERCHANT_URL'),
    config.get<string>('ADMIN_URL'),
  ].filter((origin): origin is string => Boolean(origin));
  return Array.from(
    new Set([...configured, ...apps].map((origin) => origin.replace(/\/$/, ''))),
  );
}

export function createCorsDelegate(params: {
  platformOrigins: string[];
  storefront: Pick<StorefrontCorsService, 'isStorefrontOriginFor'>;
}): CorsOptionsDelegate<Request> {
  // Unchanged strict policy for platform apps; non-matching origins get no
  // Access-Control-Allow-Origin (the cors package still answers the preflight).
  const platform: CorsOptions = {
    origin: params.platformOrigins.length > 0 ? params.platformOrigins : false,
    credentials: true,
  };

  return (req, callback) => {
    const origin = req.headers.origin;
    const storeSlug = storefrontStoreSlugFromPath(req.originalUrl ?? req.url);

    if (!origin || !storeSlug || isPlatformOrigin(origin, params.platformOrigins)) {
      callback(null, platform);
      return;
    }

    params.storefront
      .isStorefrontOriginFor(origin, storeSlug)
      .then((allowed) => {
        callback(
          null,
          allowed
            ? {
                origin,
                credentials: false,
                methods: [...STOREFRONT_CORS_METHODS],
                allowedHeaders: [...STOREFRONT_CORS_HEADERS],
                maxAge: STOREFRONT_CORS_MAX_AGE_SECONDS,
              }
            : platform,
        );
      })
      .catch(() => callback(null, platform));
  };
}

/** Applies the API CORS policy. Used by main.ts and by e2e tests. */
export function configureCors(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.enableCors(
    createCorsDelegate({
      platformOrigins: platformCorsOrigins(config),
      storefront: app.get(StorefrontCorsService),
    }),
  );
}
