import { useEffect, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { localAuthGateway } from '@/auth/authGateway';
import { localSyncGateway } from '@/sync/syncGateway';
import { settingsRepository } from '@/data/repositories';
import { exportAppData, importAppData, resetToDemoData } from '@/data/services/appService';
import type { AuthAccountSummary } from '@/auth/authGateway';
import type { SyncStatus } from '@/sync/syncGateway';

function downloadJsonFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const settings = useLiveQuery(() => settingsRepository.list(), [], []);
  const [accountSummary, setAccountSummary] = useState<AuthAccountSummary | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    localAuthGateway.getAccountSummary().then(setAccountSummary);
    localSyncGateway.getStatus().then(setSyncStatus);
  }, []);

  if (settings === undefined) {
    return <div className="loading-card">Caricamento impostazioni...</div>;
  }

  async function handleExport() {
    const payload = await exportAppData();
    downloadJsonFile(`the-fridge-export-v${payload.version}.json`, JSON.stringify(payload, null, 2));
    showToast({ tone: 'success', title: 'Export completato' });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = await importAppData(text);
    if (!result.success) {
      showToast({ tone: 'error', title: 'Import non valido', description: result.error });
      event.target.value = '';
      return;
    }

    showToast({ tone: 'success', title: 'Import completato' });
    event.target.value = '';
  }

  async function handleReset() {
    if (!window.confirm('Ripristinare tutti i dati demo? Le modifiche locali andranno perse.')) {
      return;
    }

    await resetToDemoData();
    showToast({ tone: 'success', title: 'Demo ripristinata' });
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Impostazioni"
        title="Dati, account e futuro sync"
        description="Mantieni export versionati, importa in sicurezza e prepara il perimetro per account e sincronizzazione."
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Area account</h2>
            <p>Spazio riservato a futuri provider OAuth/OIDC senza vincolare il core locale.</p>
          </div>
          <StatusBadge tone={accountSummary?.status === 'guest' ? 'neutral' : 'success'}>
            {accountSummary?.status === 'guest' ? 'Guest locale' : 'Pronto'}
          </StatusBadge>
        </div>
        <p>Provider correnti previsti: Google, Apple, GitHub, OIDC generico.</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Sync</h2>
            <p>Boundary pronta per separare persistenza locale e futura sincronizzazione cloud.</p>
          </div>
          <StatusBadge tone={syncStatus?.enabled ? 'success' : 'neutral'}>
            {syncStatus?.enabled ? 'Attiva' : 'Solo locale'}
          </StatusBadge>
        </div>
        <p>Stato corrente: nessun backend richiesto, dati disponibili offline dopo il primo caricamento.</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Import, export e reset</h2>
            <p>Il formato export e versionato e l import viene validato prima di toccare IndexedDB.</p>
          </div>
        </div>
        <div className="inline-actions">
          <button className="button" onClick={handleExport}>
            Esporta JSON
          </button>
          <label className="button button-secondary file-button">
            <input type="file" accept="application/json" onChange={handleImport} />
            Importa JSON
          </label>
          <button className="button button-danger" onClick={handleReset}>
            Reset demo
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Impostazioni salvate</h2>
        <div className="stack-md">
          {settings.map((setting) => (
            <article key={setting.key} className="list-card compact">
              <div className="card-header">
                <h3>{setting.key}</h3>
                <StatusBadge>Persistita</StatusBadge>
              </div>
              <pre className="json-preview">{JSON.stringify(setting.value, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
