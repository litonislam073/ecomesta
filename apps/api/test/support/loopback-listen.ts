import type { Server } from 'http';
import { NestApplication } from '@nestjs/core';

/**
 * SuperTest starts an unbound server with `server.listen(0)` — the wildcard
 * address on a random port — and then sends every request to 127.0.0.1. On
 * macOS another process may already listen on 127.0.0.1 at that same port
 * (e.g. VS Code or Adobe helpers in the 49152–65535 range): the wildcard bind
 * still succeeds, but the request reaches that process, which answers 401/404,
 * and the test fails without the app ever seeing the request.
 *
 * Each e2e app therefore listens on 127.0.0.1 itself as part of `init()`. The
 * OS never hands out a port that is taken on 127.0.0.1, and SuperTest reuses
 * the existing address instead of binding its own. `app.close()` stops it.
 */
const originalInit = NestApplication.prototype.init;

NestApplication.prototype.init = async function init(this: NestApplication) {
  const app = await originalInit.call(this);
  const server = this.getHttpServer() as Server;
  if (!server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  }
  return app;
};
