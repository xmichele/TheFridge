import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SpeechPlaybackButton } from '@/components/ui/SpeechPlaybackButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  loadOriginalRecipeSupportDetailByLookup,
  loadOriginalRecipeSupportLookup,
} from '@/data/services/originalRecipeSupportService';
import {
  buildOriginalRecipeSupportMetadata,
  type OriginalRecipeSupportDetailEntry,
} from '@/domain/support';
import type { OriginalRecipeSupportLookupEntry } from '@/data/services/originalRecipeSupportService';

export default function OriginalArchiveRecipePage() {
  const { id } = useParams();
  const [lookupLoaded, setLookupLoaded] = useState(false);
  const [lookupEntry, setLookupEntry] = useState<OriginalRecipeSupportLookupEntry | null>(null);
  const [detail, setDetail] = useState<OriginalRecipeSupportDetailEntry | null>(null);

  useEffect(() => {
    setLookupLoaded(false);
    loadOriginalRecipeSupportLookup()
      .then((lookup) => {
        setLookupEntry(lookup.entries.find((item) => item.id === id) ?? null);
        setLookupLoaded(true);
      })
      .catch(() => {
        setLookupEntry(null);
        setLookupLoaded(true);
      });
  }, [id]);

  useEffect(() => {
    if (!lookupEntry) {
      return;
    }

    let active = true;
    loadOriginalRecipeSupportDetailByLookup(lookupEntry)
      .then((nextDetail) => {
        if (active) {
          setDetail(nextDetail);
        }
      })
      .catch(() => {
        if (active) {
          setDetail(null);
        }
      });

    return () => {
      active = false;
    };
  }, [lookupEntry]);

  if (!lookupLoaded) {
    return <div className="loading-card">Caricamento ricetta archivio...</div>;
  }

  if (!lookupEntry) {
    return (
      <EmptyState title="Ricetta archivio non trovata" description="Torna all archivio completo per continuare la ricerca.">
        <Link className="button" to="/original-archive">
          Torna all archivio
        </Link>
      </EmptyState>
    );
  }

  const resolvedEntry = detail;
  if (!resolvedEntry) {
    return <div className="loading-card">Caricamento ricetta archivio...</div>;
  }
  const metadata = buildOriginalRecipeSupportMetadata(resolvedEntry);
  const originalIngredients = resolvedEntry.ingredients;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Archivio originale"
        title={resolvedEntry.title}
        description={resolvedEntry.category}
        actions={
          <Link className="button button-secondary" to="/original-archive">
            Torna all archivio
          </Link>
        }
      >
        <div className="badge-row">
          <StatusBadge>{resolvedEntry.servingsText || 'n.d.'} porzioni</StatusBadge>
          {metadata.preparationMinutes ? <StatusBadge tone="success">⏱ {metadata.preparationMinutes} min</StatusBadge> : null}
          {metadata.cookMinutes ? <StatusBadge>🍳 {metadata.cookMinutes} min</StatusBadge> : null}
          {metadata.originPlaces.map((place) => (
            <StatusBadge key={place}>📍 {place}</StatusBadge>
          ))}
        </div>
      </PageHeader>

      <section className="panel">
        <h2>Ingredienti</h2>
        <div className="stack-sm">
          {originalIngredients.map((ingredient, index) =>
            ingredient.isSectionLabel ? (
              <strong key={`${resolvedEntry.id}-section-${index}`}>{ingredient.displayName}</strong>
            ) : (
                <div key={`${resolvedEntry.id}-${ingredient.normalizedName}-${index}`} className="ingredient-line">
                  <span className={ingredient.normalizedName === resolvedEntry.primaryIngredientNormalized ? 'primary-ingredient' : undefined}>
                    {ingredient.displayName}
                  </span>
                  <span>{ingredient.quantityText || 'q.b.'}</span>
                </div>
              ),
          )}
        </div>
      </section>

      {detail?.note ? (
        <section className="panel">
          <h2>Note originali</h2>
          <p>{resolvedEntry.note}</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Descrizione completa</h2>
            <p>Puoi anche ascoltare la preparazione con la voce del browser.</p>
          </div>
          <SpeechPlaybackButton text={resolvedEntry.instructionText} />
        </div>
        <p>{resolvedEntry.instructionText}</p>
      </section>
    </div>
  );
}
