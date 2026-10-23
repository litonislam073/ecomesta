import { Logger } from '@nestjs/common';

const logger = new Logger('FireAndForget');

/**
 * Runs a non-critical side effect (audit trail, cache purge) without making the
 * HTTP response wait for it. Failures are logged, never thrown.
 */
export function fireAndForget(task: PromiseLike<unknown> | void, label = 'side effect'): void {
  Promise.resolve(task).catch((err: unknown) => {
    logger.warn(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}
