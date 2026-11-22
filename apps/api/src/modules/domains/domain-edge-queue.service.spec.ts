import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { DomainEdgeQueueService } from './domain-edge-queue.service';

describe('DomainEdgeQueueService', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ecomesta-edge-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a provision job when the queue dir is configured', async () => {
    const config = {
      get: (key: string) => (key === 'DOMAIN_EDGE_QUEUE_DIR' ? dir : undefined),
    } as unknown as ConfigService;
    const queue = new DomainEdgeQueueService(config);

    await queue.enqueue('provision', 'Shop.Example.COM');

    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    expect(files).toHaveLength(1);
    const body = JSON.parse(readFileSync(join(dir, files[0]!), 'utf8')) as {
      action: string;
      hostname: string;
    };
    expect(body).toMatchObject({ action: 'provision', hostname: 'shop.example.com' });
  });

  it('no-ops when DOMAIN_EDGE_QUEUE_DIR is unset', async () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const queue = new DomainEdgeQueueService(config);
    await expect(queue.enqueue('remove', 'example.com')).resolves.toBeUndefined();
  });

  it('creates the queue directory if needed', async () => {
    const nested = join(dir, 'nested', 'queue');
    const config = {
      get: (key: string) => (key === 'DOMAIN_EDGE_QUEUE_DIR' ? nested : undefined),
    } as unknown as ConfigService;
    mkdirSync(dir, { recursive: true });
    const queue = new DomainEdgeQueueService(config);
    await queue.enqueue('remove', 'gone.example.com');
    expect(readdirSync(nested).some((name) => name.endsWith('.json'))).toBe(true);
  });
});
