import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          // Logo colours: navy #022857 into the icon's blue #0156b6.
          background: 'linear-gradient(135deg, #022857 0%, #0156b6 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#ffffff',
              color: '#03a581',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 700,
            }}
          >
            e
          </div>
          <div style={{ fontSize: '40px', fontWeight: 700 }}>Ecomesta</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '64px', fontWeight: 700, lineHeight: 1.1, maxWidth: '980px' }}>
            Build and manage your online store in Bangladesh
          </div>
          <div style={{ fontSize: '28px', color: '#c9d6ea' }}>
            Products · Inventory · Orders · Payments · Delivery zones
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
