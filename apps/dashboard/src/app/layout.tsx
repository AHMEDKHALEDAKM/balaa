import LanguageProvider from '../components/LanguageProvider';
import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata: Metadata = {
  title: 'بلاعة | Balaa',
  description:
    'منصة مجتمعية مستقلة ومفتوحة المصدر لتوثيق مشكلات الطرق ومتابعة حلها. نسخة تجريبية بدون تكامل حكومي.',
  robots: { index: false, follow: false },
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icons/icon-192.png`, apple: `${base}/icons/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: 'بلاعة', statusBarStyle: 'default' },
  // Older iPhones only open home-screen apps full screen with this exact tag.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = { themeColor: '#167365' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
