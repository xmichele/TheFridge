import { RouterProvider } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import { consumeGithubPagesRedirect } from '@/app/githubPagesRedirect';
import { createAppRouter } from '@/app/router';
import { ToastProvider } from '@/app/ToastProvider';
import { ensureDemoData } from '@/data/services/appService';

export function App() {
  const [ready, setReady] = useState(false);
  const router = useMemo(() => {
    consumeGithubPagesRedirect();
    return createAppRouter();
  }, []);

  useEffect(() => {
    let active = true;

    ensureDemoData().finally(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <div className="app-loading">Preparazione dati offline...</div>;
  }

  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
