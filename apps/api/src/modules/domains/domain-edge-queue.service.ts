import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export type DomainEdgeAction = 'provision' | 'remove';

/**
 * Asks the shared-host domain-edge agent to add or drop an OpenLiteSpeed +
 * nginx edge for a merchant custom domain. No-ops when DOMAIN_EDGE_QUEUE_DIR
 * is unset (local/dev) or the directory is not writable.
 */
@Injectable()
export class DomainEdgeQueueService {
  private readonly logger = new Logger(DomainEdgeQueueService.name);
  private readonly queueDir: string | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('DOMAIN_EDGE_QUEUE_DIR')?.trim();
    this.queueDir = raw ? raw : null;
  }

  async enqueue(action: DomainEdgeAction, hostname: string): Promise<void> {
    if (!this.queueDir) return;
    const host = hostname.trim().toLowerCase();
    if (!host) return;

    try {
      await mkdir(this.queueDir, { recursive: true });
      const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
      const path = join(this.queueDir, `${id}.json`);
      await writeFile(
        path,
        JSON.stringify({ action, hostname: host, enqueuedAt: new Date().toISOString() }),
        { encoding: 'utf8', mode: 0o664 },
      );
      this.logger.log(`Queued domain edge ${action} for ${host}`);
    } catch (err) {
      this.logger.warn(
        `Could not queue domain edge ${action} for ${host}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
