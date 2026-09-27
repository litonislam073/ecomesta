import {
  marketingRobotsTxt,
  requestIsMarketingHost,
  storefrontRobotsTxt,
} from '@/lib/marketing/seo-files';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const body = requestIsMarketingHost(request.headers)
    ? marketingRobotsTxt()
    : storefrontRobotsTxt();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
