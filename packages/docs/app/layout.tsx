import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { RootProvider } from 'fumadocs-ui/provider/next';

import './global.css';
import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Ody docs',
  description: 'Documentation for the Ody CLI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.className}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
