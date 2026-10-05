import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site';

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social card; product pages can add their own once photography exists. */
export default function OpengraphImage() {
  const keys = Array.from({ length: 4 * 12 }, (_, i) => i);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#16171b',
        color: '#f3f0ea',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 600 }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#f3f0ea',
            display: 'flex',
          }}
        />
        CSE Keyboards
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: 760 }}>
        {keys.map((i) => (
          <div
            key={i}
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: i === 0 || i === 35 ? '#c8743f' : '#3b3e45',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -2 }}>{siteConfig.tagline}</div>
    </div>,
    size,
  );
}
