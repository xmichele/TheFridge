const GITHUB_PAGES_REDIRECT_KEY = 'gh-pages-spa-redirect';

type RedirectWindow = Pick<Window, 'location' | 'history' | 'sessionStorage'>;

export function consumeGithubPagesRedirect(win: RedirectWindow = window) {
  const pendingPath = win.sessionStorage.getItem(GITHUB_PAGES_REDIRECT_KEY);

  if (!pendingPath) {
    return false;
  }

  win.sessionStorage.removeItem(GITHUB_PAGES_REDIRECT_KEY);

  const currentPath = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  if (pendingPath === currentPath) {
    return false;
  }

  // GitHub Pages serves 404.html for deep SPA links. Once the app boots on the
  // repo root we replay the original path so BrowserRouter sees the right route.
  win.history.replaceState(null, '', pendingPath);
  return true;
}

export function getGithubPagesRedirectStorageKey() {
  return GITHUB_PAGES_REDIRECT_KEY;
}
