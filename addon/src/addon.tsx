import React from 'react';
import type { AddonContext } from './types';
import { ImporterPage } from './components/ImporterPage';

export default function enable(ctx: AddonContext) {
  const addedItems: { remove: () => void }[] = [];

  const sidebarItem = ctx.sidebar.addItem({
    id: 'ai-importer',
    icon: <span style={{ fontSize: '18px' }}>📄</span>,
    label: 'AI Importer',
    route: '/addon/ai-importer',
  });
  addedItems.push(sidebarItem);

  const PageComponent = () => <ImporterPage ctx={ctx} />;

  ctx.router.add({
    path: '/addon/ai-importer',
    component: React.lazy(() =>
      Promise.resolve({ default: PageComponent })
    ),
  });

  ctx.onDisable(() => {
    addedItems.forEach((item) => item.remove());
  });
}
