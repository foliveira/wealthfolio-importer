// Type declarations for Wealthfolio addon SDK
// Based on @wealthfolio/addon-sdk source at github.com/afadil/wealthfolio

import React from 'react';

export interface Account {
  id: string;
  name: string;
  currency: string;
  accountType: string;
}

export interface ActivityImport {
  id?: string;
  accountId: string;
  currency?: string;
  activityType: string;
  subtype?: string;
  date?: Date | string;
  symbol?: string;
  amount?: number | string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  fee?: number | string | null;
  fxRate?: number | string | null;
  accountName?: string;
  symbolName?: string;
  exchangeMic?: string;
  quoteCcy?: string;
  instrumentType?: string;
  quoteMode?: string;
  errors?: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  duplicateOfId?: string;
  duplicateOfLineNumber?: number;
  isValid: boolean;
  lineNumber?: number;
  isDraft: boolean;
  comment?: string;
}

export interface ImportActivitiesResult {
  activities: ActivityImport[];
  importRunId: string;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    duplicates: number;
  };
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
  import(activities: ActivityImport[]): Promise<ImportActivitiesResult>;
  checkImport(activities: ActivityImport[]): Promise<ActivityImport[]>;
}

export interface SidebarItemHandle {
  remove(): void;
}

export interface SidebarAPI {
  addItem(config: { id: string; icon: React.ReactNode; label: string; route: string; order?: number }): SidebarItemHandle;
}

export interface RouterAPI {
  add(config: { path: string; component: React.LazyExoticComponent<React.ComponentType<unknown>> }): void;
}

export interface HostAPI {
  accounts: AccountsAPI;
  activities: ActivitiesAPI;
  secrets: SecretsAPI;
  query: { getClient(): unknown };
  logger: { info(msg: string): void; error(msg: string): void; debug(msg: string): void };
  navigation: { navigate(path: string): void };
}

export interface AddonContext {
  sidebar: SidebarAPI;
  router: RouterAPI;
  onDisable: (callback: () => void) => void;
  api: HostAPI;
}
