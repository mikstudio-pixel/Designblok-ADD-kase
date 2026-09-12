import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mícháš? — prototyp náklonu tácu',
  description: 'Pohybová studie: rozvíření stylizované krupicové kaše náklonem iPadu, myší nebo dotykem.',
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: 'Mícháš?', statusBarStyle: 'black' },
  // Vinext emits mobile-web-app-capable; keep Apple's legacy tag for older iPads.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/favicon.svg` },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs" className="dark"><body>{children}</body></html>;
}
