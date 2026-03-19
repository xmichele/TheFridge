import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { NutritionMetricBadge } from '@/components/ui/NutritionMetricBadge';
import { OriginalRecipeInfoModal } from '@/components/ui/OriginalRecipeInfoModal';
import { NutritionStickerBadge } from '@/components/ui/NutritionStickerBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { loadOriginalRecipeSupportDataset } from '@/data/services/originalRecipeSupportService';
import {
  buildVisibleNutritionMetricBadges,
  buildOriginalRecipeSupportMetadata,
  buildOriginalRecipeVisibleIngredients,
  getOriginalRecipePreviewText,
  getOriginalRecipeQuickNote,
  type OriginalRecipeSupportDataset,
  type OriginalRecipeSupportEntry,
  type OriginalRecipeSearchProfile,
} from '@/domain/support';

const IGNORED_INGREDIENT_SUGGESTIONS = new Set([
  'sale',
  'olio',
  'olio d oliva',
  'olio d oliva extra vergine',
  'olio extravergine',
  'aceto',
  'pepe',
  'aglio',
  'rosmarino',
  'origano',
  'prezzemolo',
  'basilico',
]);

export default function OriginalArchivePage() {
  const [dataset, setDataset] = useState<OriginalRecipeSupportDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState<'all' | OriginalRecipeSearchProfile>('main-dish');
  const [originSearch, setOriginSearch] = useState('');
  const [caloriesFilter, setCaloriesFilter] = useState('all');
  const [carbsFilter, setCarbsFilter] = useState('all');
  const [proteinFilter, setProteinFilter] = useState('all');
  const [fatFilter, setFatFilter] = useState('all');
  const [fiberFilter, setFiberFilter] = useState('all');
  const [vitaminsFilter, setVitaminsFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<OriginalRecipeSupportEntry | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [ingredientSuggestionLimit, setIngredientSuggestionLimit] = useState(30);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    function updateSuggestionLimit() {
      setIngredientSuggestionLimit(window.innerWidth < 720 ? 20 : 30);
    }

    updateSuggestionLimit();
    window.addEventListener('resize', updateSuggestionLimit);

    return () => {
      window.removeEventListener('resize', updateSuggestionLimit);
    };
  }, []);

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

        setError(nextError instanceof Error ? nextError.message : 'Archivio originale non disponibile.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () =>
      Array.from(new Set((dataset?.entries ?? []).map((entry) => entry.category).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, 'it'),
      ),
    [dataset],
  );

  const originPlaces = useMemo(
    () =>
      Array.from(new Set((dataset?.entries ?? []).flatMap((entry) => entry.originPlaces))).sort((left, right) =>
        left.localeCompare(right, 'it'),
      ),
    [dataset],
  );

  const ingredientSuggestions = useMemo(
    () => {
      const counts = new Map<string, { label: string; count: number }>();

      (dataset?.entries ?? []).forEach((entry) => {
        const normalized = entry.primaryIngredient.trim().toLowerCase();
        if (!normalized || IGNORED_INGREDIENT_SUGGESTIONS.has(normalized)) {
          return;
        }

        const current = counts.get(normalized);
        counts.set(normalized, {
          label: current?.label ?? entry.primaryIngredient,
          count: (current?.count ?? 0) + 1,
        });
      });

      return Array.from(counts.values())
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.label.localeCompare(right.label, 'it');
        })
        .slice(0, ingredientSuggestionLimit)
        .map((item) => item.label);
    },
    [dataset, ingredientSuggestionLimit],
  );

  const metadataByEntryId = useMemo(
    () =>
      new Map((dataset?.entries ?? []).map((entry) => [entry.id, buildOriginalRecipeSupportMetadata(entry)])),
    [dataset],
  );

  function matchesHighLow(
    filterValue: string,
    tone: 'danger' | 'warn' | 'neutral' | 'success' | undefined,
    mode: 'lower-is-better' | 'higher-is-better',
  ) {
    if (filterValue === 'all' || !tone) {
      return true;
    }

    if (mode === 'lower-is-better') {
      return filterValue === 'low' ? tone === 'success' || tone === 'neutral' : tone === 'warn' || tone === 'danger';
    }

    return filterValue === 'high' ? tone === 'success' || tone === 'neutral' : tone === 'warn' || tone === 'danger';
  }

  const filteredEntries = useMemo(() => {
    if (!dataset) {
      return [];
    }

    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return dataset.entries.filter((entry) => {
      const metadata = metadataByEntryId.get(entry.id);
      const normalizedIngredientFilter = ingredientFilter.trim().toLowerCase();
      const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
      const matchesProfile = profileFilter === 'all' || (metadata?.searchProfiles ?? []).includes(profileFilter);
      const matchesIngredient =
        !normalizedIngredientFilter ||
        entry.primaryIngredient.toLowerCase().includes(normalizedIngredientFilter) ||
        entry.ingredientPreview.some(
          (ingredient) =>
            !ingredient.isSectionLabel && ingredient.displayName.toLowerCase().includes(normalizedIngredientFilter),
        );
      const matchesOrigin =
        !originSearch.trim() ||
        entry.originPlaces.some((place) => place.toLowerCase().includes(originSearch.trim().toLowerCase()));
      if (!matchesCategory) {
        return false;
      }
      if (!matchesProfile) {
        return false;
      }
      if (!matchesIngredient) {
        return false;
      }
      if (!matchesOrigin) {
        return false;
      }
      if (!matchesHighLow(caloriesFilter, metadata?.nutritionSignals?.qualitativeLabels.calories.tone, 'lower-is-better')) {
        return false;
      }
      if (!matchesHighLow(carbsFilter, metadata?.nutritionSignals?.qualitativeLabels.carbs.tone, 'lower-is-better')) {
        return false;
      }
      if (!matchesHighLow(proteinFilter, metadata?.nutritionSignals?.qualitativeLabels.protein.tone, 'higher-is-better')) {
        return false;
      }
      if (!matchesHighLow(fatFilter, metadata?.nutritionSignals?.qualitativeLabels.fat.tone, 'lower-is-better')) {
        return false;
      }
      if (fiberFilter !== 'all') {
        const hasFiber = metadata?.nutritionSignals?.stickers.includes('ricca di fibre') ?? false;
        if ((fiberFilter === 'high' && !hasFiber) || (fiberFilter === 'low' && hasFiber)) {
          return false;
        }
      }
      if (vitaminsFilter !== 'all') {
        const hasVitamins = metadata?.nutritionSignals?.stickers.includes('ricca di vitamine') ?? false;
        if ((vitaminsFilter === 'high' && !hasVitamins) || (vitaminsFilter === 'low' && hasVitamins)) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        entry.title,
        entry.category,
        entry.primaryIngredient,
        entry.notePreview ?? '',
        ...entry.ingredientPreview.map((ingredient) => ingredient.displayName),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [
    caloriesFilter,
    carbsFilter,
    categoryFilter,
    dataset,
    deferredSearch,
    fatFilter,
    fiberFilter,
    ingredientFilter,
    metadataByEntryId,
    originSearch,
    profileFilter,
    proteinFilter,
    vitaminsFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, ingredientFilter, categoryFilter, profileFilter, originSearch, caloriesFilter, carbsFilter, proteinFilter, fatFilter, fiberFilter, vitaminsFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedEntries = useMemo(
    () => filteredEntries.slice((page - 1) * pageSize, page * pageSize),
    [filteredEntries, page, pageSize],
  );
  const shouldShowPagination = !loading && !error && filteredEntries.length > pageSize;

  function renderPaginationControls(position: 'top' | 'bottom') {
    if (!shouldShowPagination) {
      return null;
    }

    return (
      <div className={`section-heading archive-pagination archive-pagination-${position}`}>
        <div>
          <p>
            Pagina {page} di {pageCount}
          </p>
        </div>
        <div className="inline-actions">
          <button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Precedente
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Successiva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Archivio originale"
        title="Ricettario storico"
        description="Consulta il supporto archivio ricavato dal ricettario originale, con ricerca per nome, categoria, origine e profilo alimentare."
      />

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Cerca</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Es. biscotti irlandesi, burro, dolci"
            />
          </label>
          <label>
            <span>Categoria</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Tutte</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Ingrediente di base</span>
            <input
              value={ingredientFilter}
              onChange={(event) => setIngredientFilter(event.target.value)}
              list="archive-ingredient-list"
              placeholder="Es. Acciughe, Farina, Zucca"
            />
            <datalist id="archive-ingredient-list">
              {ingredientSuggestions.map((ingredient) => (
                <option key={ingredient} value={ingredient} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Profilo</span>
            <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value as 'all' | OriginalRecipeSearchProfile)}>
              <option value="all">Tutti</option>
              <option value="main-dish">Main dish</option>
              <option value="meat">Carne</option>
              <option value="fish">Pesce</option>
              <option value="primo">Primo</option>
              <option value="pasta">Pasta</option>
              <option value="pizza">Pizza</option>
              <option value="appetizer">Antipasto</option>
              <option value="soup">Zuppe</option>
              <option value="vegetarian">Vegetariano</option>
              <option value="vegan">Vegano</option>
              <option value="gluten-free">Gluten-free</option>
              <option value="lactose-free">Lactose-free</option>
            </select>
          </label>
          <label>
            <span>Luogo di origine</span>
            <input
              value={originSearch}
              onChange={(event) => setOriginSearch(event.target.value)}
              list="archive-origin-list"
              placeholder="Es. Sicilia, Brasile, Toscana"
            />
            <datalist id="archive-origin-list">
              {originPlaces.map((place) => (
                <option key={place} value={place} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Calorie</span>
            <select value={caloriesFilter} onChange={(event) => setCaloriesFilter(event.target.value)}>
              <option value="all">Tutte</option>
              <option value="low">Basse</option>
              <option value="high">Alte</option>
            </select>
          </label>
          <label>
            <span>Carboidrati</span>
            <select value={carbsFilter} onChange={(event) => setCarbsFilter(event.target.value)}>
              <option value="all">Tutti</option>
              <option value="low">Bassi</option>
              <option value="high">Alti</option>
            </select>
          </label>
          <label>
            <span>Proteine</span>
            <select value={proteinFilter} onChange={(event) => setProteinFilter(event.target.value)}>
              <option value="all">Tutte</option>
              <option value="low">Basse</option>
              <option value="high">Alte</option>
            </select>
          </label>
          <label>
            <span>Grassi</span>
            <select value={fatFilter} onChange={(event) => setFatFilter(event.target.value)}>
              <option value="all">Tutti</option>
              <option value="low">Bassi</option>
              <option value="high">Alti</option>
            </select>
          </label>
          <label>
            <span>Fibre</span>
            <select value={fiberFilter} onChange={(event) => setFiberFilter(event.target.value)}>
              <option value="all">Tutte</option>
              <option value="low">Basse</option>
              <option value="high">Alte</option>
            </select>
          </label>
          <label>
            <span>Vitamine</span>
            <select value={vitaminsFilter} onChange={(event) => setVitaminsFilter(event.target.value)}>
              <option value="all">Tutte</option>
              <option value="low">Basse</option>
              <option value="high">Alte</option>
            </select>
          </label>
          <label>
            <span>Per pagina</span>
            <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Risultati</h2>
            <p>
              {loading
                ? 'Caricamento archivio in corso.'
                : `${filteredEntries.length} ricette nel supporto archivio su ${dataset?.entryCount ?? 0} caricate.`}
            </p>
          </div>
          {dataset ? <StatusBadge>{new Date(dataset.generatedAt).toLocaleDateString('it-IT')}</StatusBadge> : null}
        </div>

        {loading ? <div className="loading-card">Caricamento archivio originale...</div> : null}
        {!loading && error ? <p className="form-error">{error}</p> : null}
        {!loading && !error && filteredEntries.length === 0 ? (
          <EmptyState
            title="Nessuna ricetta trovata"
            description="Prova con un altro termine oppure rimuovi il filtro categoria."
          />
        ) : null}
        {renderPaginationControls('top')}
        {!loading && !error && filteredEntries.length > 0 ? (
          <div className="archive-card-grid">
            {paginatedEntries.map((entry) => {
              const metadata = buildOriginalRecipeSupportMetadata(entry);
              const visibleIngredients = buildOriginalRecipeVisibleIngredients(entry, 6);
              const visibleNutritionBadges = buildVisibleNutritionMetricBadges(metadata.nutritionSignals);
              const quickNote = getOriginalRecipeQuickNote(entry);

              return (
                <article key={entry.id} className="list-card">
                  <div className="card-header">
                    <div>
                      <h2>
                        <Link to={`/original-archive/${entry.id}`}>{entry.title}</Link>
                      </h2>
                      <p>{entry.category}</p>
                    </div>
                    <div className="inline-actions">
                      <StatusBadge>{entry.servingsText || 'n.d.'} porzioni</StatusBadge>
                      <button
                        type="button"
                        className="button button-ghost archive-info-button"
                        onClick={() => setSelectedEntry(entry)}
                        aria-label={`Apri dettagli completi per ${entry.title}`}
                      >
                        <span className="archive-info-icon" aria-hidden="true">
                          i
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="badge-row">
                    {metadata.preparationMinutes ? (
                      <StatusBadge tone="success">⏱ {metadata.preparationMinutes} min</StatusBadge>
                    ) : null}
                    {metadata.originPlaces[0] ? <StatusBadge>📍 {metadata.originPlaces[0]}</StatusBadge> : null}
                    {metadata.cookMinutes ? <StatusBadge tone="neutral">🍳 {metadata.cookMinutes} min</StatusBadge> : null}
                    {metadata.nutritionSignals ? (
                      <>
                        {visibleNutritionBadges.map((badge) => (
                          <NutritionMetricBadge
                            key={`${entry.id}-${badge.key}`}
                            metricLabel={badge.metricLabel}
                            qualitativeLabel={badge.qualitativeLabel}
                            value={badge.value}
                            unit={badge.unit}
                            basisLabel={metadata.nutritionSignals?.quantitativeEstimate?.basisLabel}
                            metricSource={metadata.nutritionSignals?.metricSources[badge.key]}
                          />
                        ))}
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

                  {quickNote ? <p>{quickNote}</p> : null}
                  <p className="clamp-3">{getOriginalRecipePreviewText(entry)}</p>

                  <div className="stack-sm">
                    {visibleIngredients.map((ingredient, index) => (
                      <div key={`${entry.id}-${ingredient.normalizedName}-${index}`} className="ingredient-line">
                        <span className={ingredient.normalizedName === entry.primaryIngredientNormalized ? 'primary-ingredient' : undefined}>
                          {ingredient.displayName}
                        </span>
                        <span>{ingredient.quantityText || 'q.b.'}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {renderPaginationControls('bottom')}
      </section>

      {selectedEntry ? <OriginalRecipeInfoModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} /> : null}
    </div>
  );
}
