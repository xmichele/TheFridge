import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { NutritionMetricBadge } from '@/components/ui/NutritionMetricBadge';
import { NutritionStickerBadge } from '@/components/ui/NutritionStickerBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { recipeRepository, pantryRepository } from '@/data/repositories';
import {
  addRecipeMissingIngredientsToShopping,
  deleteRecipe,
  duplicateRecipe,
} from '@/data/services/recipeService';
import { analyzeRecipeNutrition } from '@/domain/nutrition';
import { scaleRecipeCoverage, scaleRecipeIngredients } from '@/domain/recipes';
import { formatQuantity, formatUnitLabel } from '@/domain/units';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [servings, setServings] = useState<number | null>(null);
  const data = useLiveQuery(async () => {
    if (!id) {
      return null;
    }

    const recipe = await recipeRepository.get(id);
    if (!recipe) {
      return null;
    }

    const pantryItems = await pantryRepository.list();
    return { recipe, pantryItems };
  }, [id]);

  const effectiveServings = servings ?? data?.recipe.servings ?? 1;

  const scaledIngredients = useMemo(() => {
    if (!data?.recipe) {
      return [];
    }

    return scaleRecipeIngredients(data.recipe, effectiveServings);
  }, [data, effectiveServings]);

  const coverage = useMemo(() => {
    if (!data?.recipe) {
      return [];
    }

    return scaleRecipeCoverage(data.recipe, data.pantryItems, effectiveServings);
  }, [data, effectiveServings]);

  const nutrition = useMemo(() => {
    if (!data?.recipe) {
      return null;
    }

    return analyzeRecipeNutrition(data.recipe, effectiveServings);
  }, [data, effectiveServings]);

  if (data === undefined) {
    return <div className="loading-card">Caricamento ricetta...</div>;
  }

  if (!data?.recipe) {
    return (
      <EmptyState
        title="Ricetta non trovata"
        description="Controlla l URL oppure torna alla lista ricette."
      >
        <Link className="button" to="/recipes">
          Torna alle ricette
        </Link>
      </EmptyState>
    );
  }

  const recipe = data.recipe;

  async function handleMissingToShopping() {
    const result = await addRecipeMissingIngredientsToShopping(recipe.id, effectiveServings);
    showToast({
      tone: 'success',
      title: 'Lista aggiornata',
      description:
        result.created > 0
          ? `${result.created} ingredienti mancanti aggiunti o uniti alla spesa.`
          : 'Nessun ingrediente mancante da aggiungere.',
    });
  }

  async function handleDuplicate() {
    await duplicateRecipe(recipe.id);
    showToast({ tone: 'success', title: 'Ricetta duplicata' });
    navigate('/recipes');
  }

  async function handleDelete() {
    if (!window.confirm('Eliminare questa ricetta?')) {
      return;
    }

    await deleteRecipe(recipe.id);
    showToast({ tone: 'success', title: 'Ricetta eliminata' });
    navigate('/recipes');
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Dettaglio ricetta"
        title={recipe.title}
        description={recipe.description ?? 'Ricetta pronta per planner, spesa e consumo.'}
        actions={
          <div className="inline-actions">
            <Link className="button button-secondary" to={`/recipes/${recipe.id}/edit`}>
              Modifica
            </Link>
            <button className="button button-ghost" onClick={handleDuplicate}>
              Duplica
            </button>
            <button className="button button-danger" onClick={handleDelete}>
              Elimina
            </button>
          </div>
        }
      >
        <div className="badge-row">
          {recipe.category ? <StatusBadge>{recipe.category}</StatusBadge> : null}
          {(recipe.tags ?? []).map((tag) => (
            <StatusBadge key={tag}>{tag}</StatusBadge>
          ))}
        </div>
      </PageHeader>

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Porzioni da visualizzare</span>
            <input
              type="number"
              min="1"
              value={effectiveServings}
              onChange={(event) => setServings(Number(event.target.value))}
            />
          </label>
          <div className="info-box">
            <strong>Tempi</strong>
            <p>
              Prep {recipe.prepTimeMinutes ?? 0} min • Cottura {recipe.cookTimeMinutes ?? 0} min
            </p>
          </div>
          <div className="info-box">
            <strong>Azioni smart</strong>
            <p>Controlla subito i mancanti in dispensa e portali in spesa.</p>
          </div>
        </div>
        <div className="inline-actions">
          <button className="button" onClick={handleMissingToShopping}>
            Aggiungi mancanti alla spesa
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Ingredienti scalati</h2>
            <p>Disponibilita aggiornata con la dispensa corrente.</p>
          </div>
        </div>

        <div className="stack-md">
          {scaledIngredients.map((ingredient, index) => {
            const ingredientCoverage = coverage[index];
            const hasDeficit = (ingredientCoverage?.deficitQuantity ?? 0) > 0;
            return (
              <article key={ingredient.id} className="list-card">
                <div className="card-header">
                  <div>
                    <h3>{ingredient.displayName}</h3>
                    <p>
                      {formatQuantity(ingredient.quantity)} {formatUnitLabel(ingredient.unit)}
                    </p>
                  </div>
                  {ingredient.optional ? <StatusBadge>Opzionale</StatusBadge> : null}
                </div>
                <div className="meta-row">
                  <span>
                    Disponibile: {formatQuantity(ingredientCoverage.availableQuantity)}{' '}
                    {formatUnitLabel(ingredient.unit)}
                  </span>
                  <StatusBadge tone={hasDeficit ? 'warn' : 'success'}>
                    {hasDeficit
                      ? `Mancano ${formatQuantity(ingredientCoverage.deficitQuantity)} ${formatUnitLabel(
                          ingredient.unit,
                        )}`
                      : 'Coperto in dispensa'}
                  </StatusBadge>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {nutrition ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Valori nutrizionali stimati</h2>
              <p>
                Sintesi visiva dei macro. I dettagli completi restano nel motore dati e possono essere estesi in seguito.
              </p>
            </div>
          </div>
          {nutrition.editorialLabels.length > 0 ? (
            <div className="badge-row">
              {nutrition.editorialLabels.map((label) => (
                <StatusBadge key={label.label} tone={label.tone}>
                  {label.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
          <div className="badge-row">
            <NutritionMetricBadge
              metricLabel="Calorie"
              qualitativeLabel={nutrition.qualitativeLabels.calories}
              value={
                nutrition.preferredBasis === 'per-100g'
                  ? nutrition.per100g?.calories
                  : nutrition.preferredBasis === 'per-serving'
                    ? nutrition.perServing.calories
                    : nutrition.total.calories
              }
              unit="kcal"
              basisLabel={
                nutrition.preferredBasis === 'per-100g'
                  ? 'per 100 g'
                  : nutrition.preferredBasis === 'per-serving'
                    ? 'per porzione'
                    : 'ricetta intera'
              }
              metricSource={nutrition.metricSources.calories}
            />
            <NutritionMetricBadge
              metricLabel="Carbo"
              qualitativeLabel={nutrition.qualitativeLabels.carbs}
              value={
                nutrition.preferredBasis === 'per-100g'
                  ? nutrition.per100g?.carbs
                  : nutrition.preferredBasis === 'per-serving'
                    ? nutrition.perServing.carbs
                    : nutrition.total.carbs
              }
              unit="g"
              basisLabel={
                nutrition.preferredBasis === 'per-100g'
                  ? 'per 100 g'
                  : nutrition.preferredBasis === 'per-serving'
                    ? 'per porzione'
                    : 'ricetta intera'
              }
              metricSource={nutrition.metricSources.carbs}
            />
            <NutritionMetricBadge
              metricLabel="Proteine"
              qualitativeLabel={nutrition.qualitativeLabels.protein}
              value={
                nutrition.preferredBasis === 'per-100g'
                  ? nutrition.per100g?.protein
                  : nutrition.preferredBasis === 'per-serving'
                    ? nutrition.perServing.protein
                    : nutrition.total.protein
              }
              unit="g"
              basisLabel={
                nutrition.preferredBasis === 'per-100g'
                  ? 'per 100 g'
                  : nutrition.preferredBasis === 'per-serving'
                    ? 'per porzione'
                    : 'ricetta intera'
              }
              metricSource={nutrition.metricSources.protein}
            />
            <NutritionMetricBadge
              metricLabel="Grassi"
              qualitativeLabel={nutrition.qualitativeLabels.fat}
              value={
                nutrition.preferredBasis === 'per-100g'
                  ? nutrition.per100g?.fat
                  : nutrition.preferredBasis === 'per-serving'
                    ? nutrition.perServing.fat
                    : nutrition.total.fat
              }
              unit="g"
              basisLabel={
                nutrition.preferredBasis === 'per-100g'
                  ? 'per 100 g'
                  : nutrition.preferredBasis === 'per-serving'
                    ? 'per porzione'
                    : 'ricetta intera'
              }
              metricSource={nutrition.metricSources.fat}
            />
            {nutrition.stickers.map((sticker) => (
              <NutritionStickerBadge
                key={sticker}
                label={sticker}
                source={nutrition.stickerSources[sticker as 'ricca di fibre' | 'ricca di vitamine']}
              />
            ))}
            <StatusBadge tone={nutrition.preferredBasis === 'per-100g' ? 'success' : 'neutral'}>
              {nutrition.preferredBasis === 'per-100g'
                ? 'lettura per 100 g'
                : nutrition.preferredBasis === 'per-serving'
                  ? 'lettura per porzione'
                  : 'lettura su ricetta intera'}
            </StatusBadge>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Procedimento</h2>
        <ol className="step-list">
          {recipe.steps.map((step, index) => (
            <li key={`${step}-${index}`}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
