import type { AddonContext } from './types';
import { ImporterPage } from './components/ImporterPage';

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: 'ai-importer',
    icon: <span style={{ fontSize: '18px' }}>📄</span>,
    label: 'AI Importer',
    route: '/ai-importer',
  });

  ctx.router.add({
    path: '/ai-importer',
    component: () => <ImporterPage ctx={ctx} />,
  });

  return {
    disable() {
      sidebarItem.remove();
    },
  };
}
