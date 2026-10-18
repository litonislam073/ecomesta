import { ImageResponse } from 'next/og';
import { COVER_HEIGHT, COVER_WIDTH, blogCoverDataUri } from '@/lib/marketing/blog-covers';
import { blogPosts } from '@/lib/marketing/content';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return blogPosts().map((post) => ({ slug: post.slug }));
}

/** Share image of a blog post: its cover illustration with the Ecomesta Blog label. */
export function GET(_request: Request, { params }: { params: { slug: string } }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blogCoverDataUri(params.slug)} width={COVER_WIDTH} height={COVER_HEIGHT} alt="" />
        <div
          style={{
            position: 'absolute',
            left: '48px',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 22px',
            borderRadius: '18px',
            background: '#022857',
            color: '#ffffff',
            fontSize: '30px',
            fontWeight: 700,
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#03a581',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            e
          </div>
          Ecomesta Blog
        </div>
      </div>
    ),
    { width: COVER_WIDTH, height: COVER_HEIGHT },
  );
}
