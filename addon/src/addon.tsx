import type { AddonContext } from './types';
import { ImporterPage } from './components/ImporterPage';

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: 'ai-importer',
    icon: <span style={{ fontSize: '18px' }}>📄</span>,
    label: 'AI Importer',
    route: '/ai-importer',
  });

  // Stable component reference to avoid remounting on navigation
  const Page = () => <ImporterPage ctx={ctx} />;

  ctx.router.add({
    path: '/ai-importer',
    component: Page,
  });

  return {
    disable() {
      sidebarItem.remove();
    },
  };
}
