import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mícháš? — prototyp náklonu tácu',
  description: 'Pohybová studie: rozvíření stylizované krupicové kaše v kulaté míse. Náklon tácu ovládaný myší.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs" className="dark"><body>{children}</body></html>;
}
