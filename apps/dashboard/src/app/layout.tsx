import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'بلاعة | بلّغ. تابع. خلّي الطريق أأمن.',
  description:
    'منصة مواطنية مستقلة ومفتوحة المصدر لتوثيق مشكلات الطرق ومتابعة حلها. نسخة تجريبية بدون تكامل حكومي.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
