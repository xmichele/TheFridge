import { useDeferredValue, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { mealPlanRepository, recipeRepository } from '@/data/repositories';
import {
  loadOriginalRecipeSupportDetailByLookup,
  loadOriginalRecipeSupportLookup,
} from '@/data/services/originalRecipeSupportService';
import {
  consumeMealPlan,
  createMealPlan,
  deleteMealPlan,
  updateMealPlan,
  type MealPlanInput,
} from '@/data/services/plannerService';
import { MEAL_SLOT_OPTIONS, type MealPlan, type MealPlanSource } from '@/domain/models';
import { formatDayLabel, MEAL_SLOT_LABELS } from '@/domain/display';
import { normalizeIngredientName } from '@/domain/normalization';
import { mealPlanInputSchema } from '@/validation/schemas';
import { formatUnitLabel } from '@/domain/units';
import type {
  OriginalRecipeSupportDetailEntry,
} from '@/domain/support';
import type { OriginalRecipeSupportLookupDataset } from '@/data/services/originalRecipeSupportService';

interface PlannerIngredientUsageLine {
  recipeTitle: string;
  recipeSource: MealPlanSource;
  quantityLabel: string;
}

interface PlannerIngredientAggregate {
  normalizedName: string;
  displayName: string;
  usages: PlannerIngredientUsageLine[];
}

interface PlannerIngredientBadgeProps {
  ingredient: PlannerIngredientAggregate;
}

function PlannerIngredientBadge({ ingredient }: PlannerIngredientBadgeProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <span
      className="badge-detail has-detail"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="button button-secondary planner-ingredient-button"
        aria-describedby={open ? detailId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {ingredient.displayName}
      </button>
      {open ? (
        <span id={detailId} role="tooltip" className="badge-detail-popover planner-ingredient-popover">
          <span className="badge-detail-title">{ingredient.displayName}</span>
          {ingredient.usages.map((usage) => (
            <span key={`${ingredient.normalizedName}-${usage.recipeTitle}-${usage.quantityLabel}`} className="badge-detail-line">
              <strong>{usage.recipeTitle}</strong> {usage.quantityLabel}
              {usage.recipeSource === 'original' ? ' • archivio' : ''}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function formatScaledQuantity(quantity: number, unitLabel: string) {
  const rounded = quantity >= 10 ? Math.round(quantity * 10) / 10 : Math.round(quantity * 100) / 100;
  return `${rounded} ${unitLabel}`;
}

interface PlannerFormState {
  recipeId: string;
  recipeTitle: string;
  recipeSource: MealPlanSource;
  date: string;
  slot: (typeof MEAL_SLOT_OPTIONS)[number];
  servings: string;
}

function emptyPlannerForm(): PlannerFormState {
  return {
    recipeId: '',
    recipeTitle: '',
    recipeSource: 'personal',
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: 'dinner',
    servings: '2',
  };
}

export default function PlannerPage() {
  const data = useLiveQuery(async () => {
    const [recipes, mealPlans] = await Promise.all([recipeRepository.list(), mealPlanRepository.list()]);
    return { recipes, mealPlans };
  }, []);
  const recipeCatalog = data?.recipes ?? [];
  const [originalLookup, setOriginalLookup] = useState<OriginalRecipeSupportLookupDataset | null>(null);
  const [originalPlanDetails, setOriginalPlanDetails] = useState<Record<string, OriginalRecipeSupportDetailEntry>>({});
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [isRecipeInputFocused, setIsRecipeInputFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlannerFormState>(emptyPlannerForm);
  const [settledRecipeTitle, setSettledRecipeTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();
  const deferredRecipeTitle = useDeferredValue(formState.recipeTitle);

  function ensureOriginalLookupLoaded() {
    if (originalLookup) {
      return;
    }

    loadOriginalRecipeSupportLookup()
      .then((lookup) => setOriginalLookup(lookup))
      .catch(() => setOriginalLookup(null));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettledRecipeTitle(formState.recipeTitle);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [formState.recipeTitle]);

  useEffect(() => {
    const normalizedQuery = normalizeIngredientName(settledRecipeTitle);
    if (normalizedQuery.length < 3 || originalLookup) {
      return;
    }

    let active = true;
    loadOriginalRecipeSupportLookup()
      .then((lookup) => {
        if (active) {
          setOriginalLookup(lookup);
        }
      })
      .catch(() => {
        if (active) {
          setOriginalLookup(null);
        }
      });

    return () => {
      active = false;
    };
  }, [originalLookup, settledRecipeTitle]);

  const personalRecipeIndex = useMemo(
    () =>
      recipeCatalog
        .map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
          normalizedTitle: normalizeIngredientName(recipe.title),
          normalizedId: normalizeIngredientName(recipe.id),
          servings: recipe.servings,
          source: 'personal' as const,
        }))
        .sort((left, right) => left.title.localeCompare(right.title, 'it')),
    [recipeCatalog],
  );

  const originalRecipeIndex = useMemo(
    () =>
      (originalLookup?.entries ?? [])
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          normalizedTitle: normalizeIngredientName(entry.title),
          normalizedId: normalizeIngredientName(entry.id),
          servings: Number(entry.servingsText.match(/\d+/)?.[0] ?? '2'),
          source: 'original' as const,
        }))
        .sort((left, right) => left.title.localeCompare(right.title, 'it')),
    [originalLookup],
  );

  function findRecipeByTitle(title: string) {
    const normalizedTitle = normalizeIngredientName(title);
    return personalRecipeIndex.find(
      (recipe) => recipe.normalizedTitle === normalizedTitle || recipe.normalizedId === normalizedTitle,
    );
  }

  function findOriginalRecipeByTitle(title: string) {
    const normalizedTitle = normalizeIngredientName(title);
    return originalRecipeIndex.find(
      (entry) => entry.normalizedTitle === normalizedTitle || entry.normalizedId === normalizedTitle,
    );
  }

  function resetPlannerForm(recipeId?: string, recipeTitle?: string, servings?: number, recipeSource: MealPlanSource = 'personal') {
    setEditingId(null);
    setFormState({
      ...emptyPlannerForm(),
      recipeId: recipeId ?? '',
      recipeTitle: recipeTitle ?? '',
      recipeSource,
      servings: String(servings ?? 2),
    });
  }

  useEffect(() => {
    if (!recipeCatalog.length) {
      return;
    }

    setFormState((current) =>
      current.recipeId
        ? current
        : {
            ...current,
            recipeId: recipeCatalog[0].id,
            recipeTitle: recipeCatalog[0].title,
            recipeSource: 'personal',
            servings: String(recipeCatalog[0].servings),
          },
    );
  }, [recipeCatalog]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        format(addDays(parseISO(selectedWeekStart), index), 'yyyy-MM-dd'),
      ),
    [selectedWeekStart],
  );
  const recipeTitleSuggestions = useMemo(() => {
    const query = normalizeIngredientName(settledRecipeTitle);
    if (!query) {
      return personalRecipeIndex.slice(0, 8).map(({ id, title, servings, source }) => ({
        id,
        title,
        servings,
        source,
      }));
    }

    const personalMatches = personalRecipeIndex
      .filter((recipe) => recipe.normalizedTitle.includes(query) || recipe.normalizedId.includes(query))
      .slice(0, 6)
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        source: recipe.source,
      }));

    const originalMatches =
      query.length >= 3
        ? originalRecipeIndex
            .filter((entry) => entry.normalizedTitle.includes(query) || entry.normalizedId.includes(query))
            .slice(0, 5)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              servings: entry.servings,
              source: entry.source,
            }))
        : [];

    return [...personalMatches, ...originalMatches];
  }, [originalRecipeIndex, personalRecipeIndex, settledRecipeTitle]);

  const firstRecipe = data?.recipes[0];
  const selectedWeekPlans = (data?.mealPlans ?? []).filter((plan) => weekDays.includes(plan.date));

  useEffect(() => {
    const originalPlans = selectedWeekPlans.filter((plan) => plan.recipeSource === 'original');
    if (!originalLookup || originalPlans.length === 0) {
      setOriginalPlanDetails({});
      return;
    }

    let active = true;
    Promise.all(
      originalPlans.map(async (plan) => {
        const entry = originalLookup.entries.find((item) => item.id === plan.recipeId);
        if (!entry) {
          return null;
        }

        try {
          const detail = await loadOriginalRecipeSupportDetailByLookup(entry);
          return [plan.recipeId, detail] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!active) {
        return;
      }

      setOriginalPlanDetails(
        Object.fromEntries(
          pairs.filter((pair): pair is readonly [string, OriginalRecipeSupportDetailEntry] => Boolean(pair)),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [originalLookup, selectedWeekPlans]);

  const selectedWeekIngredients = useMemo<PlannerIngredientAggregate[]>(() => {
    const aggregateMap = new Map<string, PlannerIngredientAggregate>();

    selectedWeekPlans.forEach((plan) => {
      if (plan.recipeSource === 'personal') {
        const recipe = recipeCatalog.find((item) => item.id === plan.recipeId);
        if (!recipe) {
          return;
        }

        const servingMultiplier = plan.servings / recipe.servings;
        recipe.ingredients.forEach((ingredient) => {
          const key = ingredient.normalizedName;
          const usage: PlannerIngredientUsageLine = {
            recipeTitle: recipe.title,
            recipeSource: 'personal',
            quantityLabel: formatScaledQuantity(ingredient.quantity * servingMultiplier, formatUnitLabel(ingredient.unit)),
          };

          if (!aggregateMap.has(key)) {
            aggregateMap.set(key, {
              normalizedName: key,
              displayName: ingredient.displayName,
              usages: [usage],
            });
            return;
          }

          aggregateMap.get(key)?.usages.push(usage);
        });
        return;
      }

      const detail = originalPlanDetails[plan.recipeId];
      if (!detail) {
        return;
      }

      detail.ingredients
        .filter((ingredient) => !ingredient.isSectionLabel)
        .forEach((ingredient) => {
          const key = ingredient.normalizedName;
          const usage: PlannerIngredientUsageLine = {
            recipeTitle: plan.recipeTitle ?? detail.title,
            recipeSource: 'original',
            quantityLabel: ingredient.quantityText || 'q.b.',
          };

          if (!aggregateMap.has(key)) {
            aggregateMap.set(key, {
              normalizedName: key,
              displayName: ingredient.displayName,
              usages: [usage],
            });
            return;
          }

          aggregateMap.get(key)?.usages.push(usage);
        });
    });

    return Array.from(aggregateMap.values()).sort((left, right) => left.displayName.localeCompare(right.displayName, 'it'));
  }, [originalPlanDetails, recipeCatalog, selectedWeekPlans]);

  if (data === undefined) {
    return <div className="loading-card">Caricamento planner...</div>;
  }

  if (data.recipes.length === 0) {
    return (
      <EmptyState
        title="Nessuna ricetta disponibile"
        description="Crea almeno una ricetta prima di pianificare i pasti."
      />
    );
  }

  function startEdit(plan: MealPlan) {
    setEditingId(plan.id);
    setErrorMessage('');
    setFormState({
      recipeId: plan.recipeId,
      recipeTitle:
        plan.recipeTitle ??
        (plan.recipeSource === 'personal'
          ? recipeCatalog.find((item) => item.id === plan.recipeId)?.title ?? ''
          : ''),
      recipeSource: plan.recipeSource ?? 'personal',
      date: plan.date,
      slot: plan.slot,
      servings: String(plan.servings),
    });
  }

  function applyRecipeSelection(recipeId: string, recipeTitle: string, servings: number, recipeSource: MealPlanSource) {
    setFormState((current) => ({
      ...current,
      recipeId,
      recipeTitle,
      recipeSource,
      servings: String(servings),
    }));
    setIsRecipeInputFocused(false);
  }

  async function handleQuickAddSuggestion(recipe: {
    id: string;
    title: string;
    servings: number;
    source: MealPlanSource;
  }) {
    await createMealPlan({
      date: formState.date,
      slot: formState.slot,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeSource: recipe.source,
      servings: recipe.servings,
    });

    showToast({
      tone: 'success',
      title: 'Pasto pianificato',
      description: `${recipe.title} aggiunta rapidamente al planner.`,
    });

    applyRecipeSelection(recipe.id, recipe.title, recipe.servings, recipe.source);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    if (!data) {
      return;
    }

    if (!formState.recipeId) {
      setErrorMessage('Seleziona una ricetta presente nel database partendo dal suo titolo.');
      return;
    }

    const parsed = mealPlanInputSchema.safeParse({
      date: formState.date,
      slot: formState.slot,
      recipeId: formState.recipeId,
      recipeTitle: formState.recipeTitle,
      recipeSource: formState.recipeSource,
      servings: Number(formState.servings),
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Controlla i dati del planner.');
      return;
    }

    const payload = parsed.data as MealPlanInput;

    if (editingId) {
      await updateMealPlan(editingId, payload);
      showToast({ tone: 'success', title: 'Pasto aggiornato nel planner' });
    } else {
      await createMealPlan(payload);
      showToast({ tone: 'success', title: 'Pasto pianificato' });
    }

    resetPlannerForm(firstRecipe?.id, firstRecipe?.title, firstRecipe?.servings);
  }

  async function handleConsume(id: string) {
    const result = await consumeMealPlan(id);
    if (!result.success) {
      showToast({ tone: 'error', title: 'Consumo non eseguito', description: result.error });
      return;
    }

    showToast({
      tone: 'success',
      title: 'Pasto consumato',
      description:
        result.deficits > 0
          ? `${result.deficits} ingredienti mancanti sono stati aggiunti alla spesa.`
          : 'Dispensa aggiornata senza deficit.',
    });
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questo piano pasto?')) {
      return;
    }

    await deleteMealPlan(id);
    showToast({ tone: 'success', title: 'Pasto rimosso dal planner' });
    if (editingId === id) {
      resetPlannerForm(firstRecipe?.id, firstRecipe?.title, firstRecipe?.servings);
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Planner"
        title="Pianifica e consuma"
        description="Organizza pasti giornalieri e settimanali, poi scala automaticamente dispensa e spesa."
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{editingId ? 'Modifica piano' : 'Nuovo piano pasto'}</h2>
            <p>Il consumo aggiorna la dispensa in modo atomico e previene doppie sottrazioni.</p>
          </div>
        </div>
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>Ricetta dal DB</span>
              <input
                list="planner-recipe-titles"
                value={formState.recipeTitle}
                onFocus={() => {
                  setIsRecipeInputFocused(true);
                }}
                onBlur={() => window.setTimeout(() => setIsRecipeInputFocused(false), 120)}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  const recipe = findRecipeByTitle(nextTitle);
                  const originalRecipe = recipe ? null : findOriginalRecipeByTitle(nextTitle);
                  setFormState((current) => ({
                    ...current,
                    recipeId: recipe?.id ?? (originalRecipe?.id ?? ''),
                    recipeTitle: nextTitle,
                    recipeSource: recipe ? 'personal' : originalRecipe ? 'original' : current.recipeSource,
                    servings: String(recipe?.servings ?? originalRecipe?.servings ?? current.servings),
                  }));
                }}
                placeholder="Inizia dal titolo ricetta"
                required
              />
            </label>
            <label>
              <span>Data</span>
              <input
                type="date"
                value={formState.date}
                onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
              />
            </label>
            <label>
              <span>Slot</span>
              <select
                value={formState.slot}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    slot: event.target.value as PlannerFormState['slot'],
                  }))
                }
              >
                {MEAL_SLOT_OPTIONS.map((slot) => (
                  <option key={slot} value={slot}>
                    {MEAL_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Porzioni</span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={formState.servings}
                onChange={(event) => setFormState((current) => ({ ...current, servings: event.target.value }))}
              />
            </label>
          </div>
          <datalist id="planner-recipe-titles">
            {data.recipes
              .slice()
              .sort((left, right) => left.title.localeCompare(right.title, 'it'))
              .map((recipe) => (
                <option key={recipe.id} value={recipe.title} />
              ))}
          </datalist>
          <p className="field-hint">
            Dopo il terzo carattere, quando ti fermi un attimo, cerco anche nel ricettario storico. Le ricette originali si possono pianificare, ma non consumare direttamente.
          </p>
          {isRecipeInputFocused || formState.recipeTitle.trim() ? (
            <div className="picker-list picker-list-stacked" aria-label="Suggerimenti ricette">
              {recipeTitleSuggestions.map((recipe) => {
                const isActive = formState.recipeId === recipe.id && formState.recipeSource === recipe.source;
                return (
                  <div key={`${recipe.source}-${recipe.id}`} className={`picker-item${isActive ? ' is-active' : ''}`}>
                    <button
                      className="picker-chip picker-chip-main"
                      type="button"
                      onClick={() => applyRecipeSelection(recipe.id, recipe.title, recipe.servings, recipe.source)}
                    >
                      {recipe.title}
                      <span className="picker-chip-meta">{recipe.source === 'original' ? 'Archivio originale' : 'Ricette personali'}</span>
                    </button>
                    <button
                      className="button button-secondary picker-add-button"
                      type="button"
                      aria-label={`Aggiungi rapidamente ${recipe.title} al planner`}
                      onClick={() => void handleQuickAddSuggestion(recipe)}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          <div className="inline-actions">
            <button className="button" type="submit">
              {editingId ? 'Salva piano' : 'Pianifica pasto'}
            </button>
            {editingId ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() => resetPlannerForm(firstRecipe?.id, firstRecipe?.title, firstRecipe?.servings)}
              >
                Annulla
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Settimana</span>
            <input
              type="date"
              value={selectedWeekStart}
              onChange={(event) => setSelectedWeekStart(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Ingredienti pianificati</h2>
            <p>Lista unica senza duplicati per tutta la settimana selezionata.</p>
          </div>
          <StatusBadge>{selectedWeekIngredients.length} ingredienti</StatusBadge>
        </div>
        {selectedWeekIngredients.length === 0 ? (
          <EmptyState
            title="Nessun ingrediente da mostrare"
            description="Pianifica almeno una ricetta per vedere l'aggregazione settimanale."
          />
        ) : (
          <div className="picker-list">
            {selectedWeekIngredients.map((ingredient) => (
              <PlannerIngredientBadge key={ingredient.normalizedName} ingredient={ingredient} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Vista settimanale</h2>
            <p>Dalla settimana che parte il {selectedWeekStart}.</p>
          </div>
        </div>
        <div className="week-grid">
          {weekDays.map((day) => {
            const plansForDay = data.mealPlans.filter((plan) => plan.date === day);
            return (
              <article key={day} className="week-day-card">
                <h3>{formatDayLabel(day)}</h3>
                {plansForDay.length === 0 ? <p>Nessun piano</p> : null}
                <div className="stack-sm">
                  {plansForDay.map((plan) => {
                    const recipe =
                      plan.recipeSource === 'personal'
                        ? data.recipes.find((item) => item.id === plan.recipeId)
                        : null;
                    const title = plan.recipeTitle ?? recipe?.title ?? 'Ricetta rimossa';
                    return (
                      <div key={plan.id} className="mini-plan">
                        <strong>{MEAL_SLOT_LABELS[plan.slot]}</strong>
                        <span>{title}</span>
                        <span>
                          {plan.servings} porzioni
                          {plan.recipeSource === 'original' ? ' • Archivio originale' : ''}
                        </span>
                        <div className="inline-actions">
                          <button className="button button-secondary" onClick={() => startEdit(plan)}>
                            Modifica
                          </button>
                          <button
                            className="button"
                            disabled={plan.status === 'consumed' || plan.recipeSource === 'original'}
                            onClick={() => handleConsume(plan.id)}
                          >
                            {plan.recipeSource === 'original' ? 'Da importare prima' : 'Segna come consumato'}
                          </button>
                          <button className="button button-danger" onClick={() => handleDelete(plan.id)}>
                            Elimina
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
