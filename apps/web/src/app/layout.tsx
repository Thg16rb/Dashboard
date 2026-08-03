import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono } from 'next/font/google';

const mono = IBM_Plex_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'TrafficIntel — Console',
  description: 'Terminal de inteligência para tráfego pago e gestão financeira',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={mono.variable}>
      <body style={{ margin: 0, background: '#0b0d0c', minHeight: '100vh', fontFamily: 'var(--font-mono), ui-monospace, Menlo, monospace' }}>
        {children}
      </body>
    </html>
  );
}
