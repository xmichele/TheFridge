export interface AuthAccountSummary {
  status: 'guest' | 'authenticated' | 'unavailable';
  provider: string | null;
  email?: string;
}

export interface AuthGateway {
  getAccountSummary(): Promise<AuthAccountSummary>;
  signIn(provider: 'google' | 'apple' | 'github' | 'oidc'): Promise<void>;
  signOut(): Promise<void>;
}

export const localAuthGateway: AuthGateway = {
  async getAccountSummary() {
    return {
      status: 'guest',
      provider: null,
    };
  },
  async signIn() {
    throw new Error('OAuth/OIDC non ancora configurato.');
  },
  async signOut() {
    return;
  },
};
