import type { NextConfig } from 'next';

// `npm run build:pages` sets NEXT_PUBLIC_STATIC_DEMO=1 to produce the phone demo for
// GitHub Pages: plain files, no server, data kept on each device (components/localApi.ts).
const deviceDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === '1';

const config: NextConfig = {
  transpilePackages: ['@balaa/types', '@balaa/config', '@balaa/geo', '@balaa/ui'],
  poweredByHeader: false,
  ...(deviceDemo
    ? {
        output: 'export',
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
        trailingSlash: true,
        // Only .tsx pages: leaves out the API route (route.ts), which needs a server.
        pageExtensions: ['tsx'],
      }
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
              ],
            },
          ];
        },
      }),
};
export default config;
