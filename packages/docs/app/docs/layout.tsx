import type { ReactNode } from 'react';

import { DocsLayout } from 'fumadocs-ui/layouts/notebook';

import { baseOptions } from '../../lib/layout.shared';
import { source } from '../../lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions()}
      tree={source.pageTree}
      githubUrl="https://github.com/8bittitan/ody"
      themeSwitch={{
        mode: 'light-dark',
      }}
    >
      {children}
    </DocsLayout>
  );
}
