import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaPrompts() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(media.matches);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    media.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      media.removeEventListener('change', handleChange);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="pwa-stack" aria-live="polite">
      {needRefresh[0] ? (
        <div className="pwa-card">
          <div>
            <strong>Nuova versione disponibile</strong>
            <p>Aggiorna per usare l ultima versione offline.</p>
          </div>
          <button className="button button-secondary" onClick={() => updateServiceWorker(true)}>
            Aggiorna
          </button>
        </div>
      ) : null}
      {!isStandalone && deferredPrompt ? (
        <div className="pwa-card">
          <div>
            <strong>Installa The Fridge</strong>
            <p>Aggiungi l app alla schermata home per usarla come PWA.</p>
          </div>
          <button className="button" onClick={handleInstall}>
            Installa
          </button>
        </div>
      ) : null}
    </div>
  );
}
