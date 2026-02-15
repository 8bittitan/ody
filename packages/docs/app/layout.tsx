import type { ReactNode } from 'react';

import { RootProvider } from 'fumadocs-ui/provider';

import './global.css';

export const metadata = {
  title: 'ody docs',
  description: 'Documentation for the ody CLI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
