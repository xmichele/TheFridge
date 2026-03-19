import { describe, expect, it, vi } from 'vitest';

import { consumeGithubPagesRedirect, getGithubPagesRedirectStorageKey } from '@/app/githubPagesRedirect';

describe('consumeGithubPagesRedirect', () => {
  it('restores the pending deep link from sessionStorage', () => {
    const replaceState = vi.fn();
    const storage = new Map<string, string>([
      [getGithubPagesRedirectStorageKey(), '/TheFridge/original-archive/originale-9?foo=1#bar'],
    ]);

    const consumed = consumeGithubPagesRedirect({
      location: {
        pathname: '/TheFridge/',
        search: '',
        hash: '',
      } as Window['location'],
      history: { replaceState } as unknown as Window['history'],
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
      } as unknown as Storage,
    });

    expect(consumed).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/TheFridge/original-archive/originale-9?foo=1#bar');
    expect(storage.size).toBe(0);
  });

  it('does nothing when there is no pending redirect', () => {
    const replaceState = vi.fn();

    const consumed = consumeGithubPagesRedirect({
      location: {
        pathname: '/TheFridge/',
        search: '',
        hash: '',
      } as Window['location'],
      history: { replaceState } as unknown as Window['history'],
      sessionStorage: {
        getItem: (_key: string) => null,
        removeItem: vi.fn(),
      } as unknown as Storage,
    });

    expect(consumed).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
