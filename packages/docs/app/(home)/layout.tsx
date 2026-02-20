import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { baseOptions } from '../../lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <HomeLayout
      {...baseOptions()}
      nav={{
        title: 'Ody',
        transparentMode: 'always',
      }}
      links={[
        {
          text: 'Docs',
          url: '/docs',
        },
      ]}
      className="bg-gray-50 dark:bg-[#0a0e18]"
    >
      {children}
    </HomeLayout>
  );
}
