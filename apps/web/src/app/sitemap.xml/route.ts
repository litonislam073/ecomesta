import { marketingSitemapXml, requestIsMarketingHost } from '@/lib/marketing/seo-files';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  if (!requestIsMarketingHost(request.headers)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return new Response(marketingSitemapXml(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
