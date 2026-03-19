export interface SyncStatus {
  enabled: boolean;
  provider: 'none' | 'custom';
  lastSyncedAt?: string;
}

export interface SyncGateway {
  getStatus(): Promise<SyncStatus>;
  syncNow(): Promise<void>;
}

export const localSyncGateway: SyncGateway = {
  async getStatus() {
    return {
      enabled: false,
      provider: 'none',
    };
  },
  async syncNow() {
    throw new Error('Sync cloud non ancora configurata.');
  },
};
