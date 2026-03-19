import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { OriginalRecipeInfoModal } from '@/components/ui/OriginalRecipeInfoModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { loadOriginalRecipeSupportDataset } from '@/data/services/originalRecipeSupportService';
import type { PantryItem } from '@/domain/models';
import {
  buildOriginalRecipeLabelChips,
  buildOriginalRecipeSuggestions,
  buildOriginalRecipeSupportMetadata,
  getOriginalRecipePreviewText,
  type OriginalRecipeSupportDataset,
  type OriginalRecipeSupportEntry,
} from '@/domain/support';

interface OriginalRecipeSupportPanelProps {
  pantryItems: PantryItem[];
}

export function OriginalRecipeSupportPanel({ pantryItems }: OriginalRecipeSupportPanelProps) {
  const [dataset, setDataset] = useState<OriginalRecipeSupportDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<OriginalRecipeSupportEntry | null>(null);

  useEffect(() => {
    let active = true;

    loadOriginalRecipeSupportDataset()
      .then((nextDataset) => {
        if (!active) {
          return;
        }

        setDataset(nextDataset);
        setLoading(false);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : 'Archivio supporto non disponibile.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(
    () => (dataset ? buildOriginalRecipeSuggestions(dataset.entries, pantryItems) : []),
    [dataset, pantryItems],
  );

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Dal ricettario originale</h2>
          <p>Suggerimenti in sola lettura basati sugli ingredienti che hai gia in dispensa.</p>
        </div>
        <StatusBadge>Supporto decisionale</StatusBadge>
      </div>

      {loading ? <div className="loading-card">Analisi archivio originale...</div> : null}
      {!loading && error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && suggestions.length === 0 ? (
        <EmptyState
          title="Nessun suggerimento dall archivio"
          description="Aggiungi piu ingredienti in dispensa per ottenere proposte dal ricettario originale."
        />
      ) : null}
      {!loading && !error && suggestions.length > 0 ? (
        <div className="card-grid">
          {suggestions.map((suggestion) => {
            const metadata = buildOriginalRecipeSupportMetadata(suggestion.entry);
            const chips = buildOriginalRecipeLabelChips(suggestion.entry);

            return (
              <article key={suggestion.entry.id} className="list-card">
                <div className="card-header">
                  <div>
                    <h3>
                      <Link to={`/original-archive/${suggestion.entry.id}`}>{suggestion.entry.title}</Link>
                    </h3>
                    <p>{suggestion.entry.category}</p>
                  </div>
                  <div className="inline-actions">
                    <StatusBadge tone="success">{suggestion.matchedIngredients.length} match</StatusBadge>
                    <button
                      type="button"
                      className="button button-ghost archive-info-button"
                      onClick={() => setSelectedEntry(suggestion.entry)}
                      aria-label={`Apri dettagli completi per ${suggestion.entry.title}`}
                    >
                      <span className="archive-info-icon" aria-hidden="true">
                        i
                      </span>
                    </button>
                  </div>
                </div>
                <div className="badge-row">
                  {metadata.preparationMinutes ? <StatusBadge tone="success">⏱ {metadata.preparationMinutes} min</StatusBadge> : null}
                  {metadata.originPlaces[0] ? <StatusBadge>📍 {metadata.originPlaces[0]}</StatusBadge> : null}
                </div>
                <p className="clamp-3">{getOriginalRecipePreviewText(suggestion.entry)}</p>
                <div className="badge-row">
                  {chips.map((chip) => (
                    <StatusBadge key={`${suggestion.entry.id}-${chip.name}`} tone={chip.isPrimary ? 'success' : 'neutral'}>
                      {chip.isPrimary ? <strong>{chip.name}</strong> : chip.name}
                    </StatusBadge>
                  ))}
                  {suggestion.missingIngredients.slice(0, 2).map((ingredient) => (
                    <StatusBadge key={`${suggestion.entry.id}-missing-${ingredient}`} tone="warn">
                      Manca: {ingredient}
                    </StatusBadge>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {selectedEntry ? <OriginalRecipeInfoModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} /> : null}
    </section>
  );
}
