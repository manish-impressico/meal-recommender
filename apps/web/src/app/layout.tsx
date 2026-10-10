import 'bootstrap/dist/css/bootstrap.min.css';
// Self-hosted variable font from npm: no build- or run-time call to Google, works offline on localhost.
import '@fontsource-variable/manrope';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppNav } from '@/ui/AppNav';

export const metadata: Metadata = { title: 'Meal Recommender', description: 'What should we cook today?' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FFFFFF' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        <main className="mr-shell">{children}</main>
      </body>
    </html>
  );
}
