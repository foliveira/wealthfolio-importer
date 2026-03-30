// Type declarations for Wealthfolio addon SDK
// These match the addon API as documented at https://wealthfolio.app/docs/addons/api-reference/

export interface Account {
  id: string;
  name: string;
  currency: string;
  accountType: string;
}

export interface ActivityImport {
  date: string;
  activityType: string;
  symbol: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  fee: number;
  amount: number;
  isDuplicate?: boolean;
  error?: string;
  lineNumber?: number;
}

export interface SecretsAPI {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AccountsAPI {
  getAll(): Promise<Account[]>;
}

export interface ActivitiesAPI {
  import(activities: ActivityImport[]): Promise<ActivityImport[]>;
  checkImport(accountId: string, activities: ActivityImport[]): Promise<ActivityImport[]>;
}

export interface SidebarItem {
  remove(): void;
}

export interface SidebarAPI {
  addItem(config: { id: string; icon: React.ReactNode; label: string; route: string }): SidebarItem;
}

export interface RouterAPI {
  add(config: { path: string; component: React.ComponentType }): void;
}

export interface AddonContext {
  sidebar: SidebarAPI;
  router: RouterAPI;
  onDisable: (callback: () => void) => void;
  api: {
    accounts: AccountsAPI;
    activities: ActivitiesAPI;
    secrets: SecretsAPI;
  };
}
