import { useEffect, useState } from 'react';

import { NutritionMetricBadge } from '@/components/ui/NutritionMetricBadge';
import { NutritionStickerBadge } from '@/components/ui/NutritionStickerBadge';
import { SpeechPlaybackButton } from '@/components/ui/SpeechPlaybackButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { loadOriginalRecipeSupportDetail } from '@/data/services/originalRecipeSupportService';
import {
  buildOriginalRecipeSupportMetadata,
  type OriginalRecipeSupportDetailEntry,
  type OriginalRecipeSupportEntry,
} from '@/domain/support';

interface OriginalRecipeInfoModalProps {
  entry: OriginalRecipeSupportEntry;
  onClose: () => void;
}

export function OriginalRecipeInfoModal({ entry, onClose }: OriginalRecipeInfoModalProps) {
  const [detail, setDetail] = useState<OriginalRecipeSupportDetailEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadOriginalRecipeSupportDetail(entry)
      .then((nextDetail) => {
        if (!active) {
          return;
        }

        setDetail(nextDetail);
        setLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setDetail(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entry]);

  const resolvedEntry = detail ?? entry;
  const metadata = buildOriginalRecipeSupportMetadata(resolvedEntry);
  const originalIngredients = detail ? detail.ingredients : entry.ingredientPreview;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={`recipe-info-${entry.id}`} onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <div>
            <p className="page-eyebrow">Scheda completa</p>
            <h2 id={`recipe-info-${entry.id}`}>{resolvedEntry.title}</h2>
            <p>{resolvedEntry.category}</p>
          </div>
          <button type="button" className="button button-ghost modal-close-button" onClick={onClose} aria-label="Chiudi dettagli ricetta">
            Chiudi
          </button>
        </div>

        <div className="badge-row">
          <StatusBadge>{resolvedEntry.servingsText || 'n.d.'} porzioni</StatusBadge>
          {metadata.preparationMinutes ? <StatusBadge tone="success">⏱ {metadata.preparationMinutes} min</StatusBadge> : null}
          {metadata.cookMinutes ? <StatusBadge>🍳 {metadata.cookMinutes} min</StatusBadge> : null}
          {metadata.originPlaces.map((place) => (
            <StatusBadge key={`${entry.id}-${place}`}>📍 {place}</StatusBadge>
          ))}
          {metadata.nutritionSignals ? (
            <>
              <NutritionMetricBadge
                metricLabel="Calorie"
                qualitativeLabel={metadata.nutritionSignals.qualitativeLabels.calories}
                value={metadata.nutritionSignals.quantitativeEstimate?.macros.calories}
                unit="kcal"
                basisLabel={metadata.nutritionSignals.quantitativeEstimate?.basisLabel}
                metricSource={metadata.nutritionSignals.metricSources.calories}
              />
              <NutritionMetricBadge
                metricLabel="Carbo"
                qualitativeLabel={metadata.nutritionSignals.qualitativeLabels.carbs}
                value={metadata.nutritionSignals.quantitativeEstimate?.macros.carbs}
                unit="g"
                basisLabel={metadata.nutritionSignals.quantitativeEstimate?.basisLabel}
                metricSource={metadata.nutritionSignals.metricSources.carbs}
              />
              <NutritionMetricBadge
                metricLabel="Proteine"
                qualitativeLabel={metadata.nutritionSignals.qualitativeLabels.protein}
                value={metadata.nutritionSignals.quantitativeEstimate?.macros.protein}
                unit="g"
                basisLabel={metadata.nutritionSignals.quantitativeEstimate?.basisLabel}
                metricSource={metadata.nutritionSignals.metricSources.protein}
              />
              <NutritionMetricBadge
                metricLabel="Grassi"
                qualitativeLabel={metadata.nutritionSignals.qualitativeLabels.fat}
                value={metadata.nutritionSignals.quantitativeEstimate?.macros.fat}
                unit="g"
                basisLabel={metadata.nutritionSignals.quantitativeEstimate?.basisLabel}
                metricSource={metadata.nutritionSignals.metricSources.fat}
              />
              {metadata.nutritionSignals.stickers.map((sticker) => (
                <NutritionStickerBadge
                  key={`${entry.id}-${sticker}`}
                  label={sticker}
                  source={metadata.nutritionSignals?.stickerSources[sticker as 'ricca di fibre' | 'ricca di vitamine']}
                />
              ))}
            </>
          ) : null}
        </div>

        <section className="info-box">
          <h3>Ingredienti originali</h3>
          <div className="stack-sm">
            {originalIngredients.map((ingredient, index) =>
              ingredient.isSectionLabel ? (
                <strong key={`${entry.id}-section-${index}`}>{ingredient.displayName}</strong>
              ) : (
                <div key={`${entry.id}-${ingredient.normalizedName}-${index}`} className="ingredient-line">
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
          <section className="info-box">
            <h3>Note originali</h3>
            <p>{detail.note}</p>
          </section>
        ) : null}

        <section className="info-box">
          <div className="section-heading">
            <div>
              <h3>Preparazione completa</h3>
            </div>
            {detail ? <SpeechPlaybackButton text={detail.instructionText} /> : null}
          </div>
          {detail ? <p>{detail.instructionText}</p> : <p>{loading ? 'Caricamento dettaglio completo...' : 'Dettaglio non disponibile.'}</p>}
        </section>
      </div>
    </div>
  );
}
