import { useDeferredValue, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { mealPlanRepository, recipeRepository, settingsRepository } from '@/data/repositories';
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
import { formatDayLabel } from '@/domain/display';
import { normalizeIngredientName } from '@/domain/normalization';
import { analyzeRecipeNutrition } from '@/domain/nutrition';
import {
  DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
  evaluatePlannerDayBudget,
  PLANNER_DAILY_NUTRITION_BUDGET_SETTING_KEY,
  type PlannerBudgetLevel,
  type PlannerDailyNutritionBudget,
} from '@/domain/plannerNutritionBudget';
import {
  getPlannerDayConstraintError,
  getPlannerDishGroupFromCategory,
  type PlannerDishGroup,
} from '@/domain/plannerConstraints';
import { buildOriginalRecipeSupportMetadata, buildVisibleNutritionMetricBadges } from '@/domain/support';
import { mealPlanInputSchema } from '@/validation/schemas';
import { formatUnitLabel } from '@/domain/units';
import type {
  OriginalRecipeSupportDetailEntry,
} from '@/domain/support';
import type { OriginalRecipeSupportLookupDataset } from '@/data/services/originalRecipeSupportService';

interface PlannerPlanDescriptor {
  id?: string;
  date: string;
  recipeId: string;
  recipeSource: MealPlanSource;
}

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

interface PlannerRecipeNutritionHoverProps {
  title: string;
  badges: PlannerNutritionHoverBadge[];
}

interface PlannerNutritionHoverBadge {
  text: string;
  tone: 'neutral' | 'warn' | 'danger' | 'success';
}

interface PlannerRecipeSuggestion {
  id: string;
  title: string;
  servings: number;
  source: MealPlanSource;
  normalizedTitle: string;
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

function PlannerRecipeNutritionHover({
  title,
  badges,
}: PlannerRecipeNutritionHoverProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const hasDetail = badges.length > 0;

  return (
    <span
      className={`badge-detail ${hasDetail ? 'has-detail' : ''}`}
      onMouseEnter={() => hasDetail && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="planner-recipe-trigger"
        aria-describedby={hasDetail && open ? detailId : undefined}
        aria-expanded={hasDetail ? open : undefined}
        onClick={() => hasDetail && setOpen((current) => !current)}
      >
        {title}
      </button>
      {hasDetail && open ? (
        <span id={detailId} role="tooltip" className="badge-detail-popover planner-recipe-popover">
          <span className="badge-detail-title">{title}</span>
          <span className="badge-row">
            {badges.map((badge) => (
              <StatusBadge key={`${title}-${badge.text}`} tone={badge.tone}>
                {badge.text}
              </StatusBadge>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function formatScaledQuantity(quantity: number, unitLabel: string) {
  const rounded = quantity >= 10 ? Math.round(quantity * 10) / 10 : Math.round(quantity * 100) / 100;
  return `${rounded} ${unitLabel}`;
}

function buildPersonalPlannerNutritionHoverBadges(
  recipe: { servings: number } & Parameters<typeof analyzeRecipeNutrition>[0],
): PlannerNutritionHoverBadge[] {
  const nutrition = analyzeRecipeNutrition(recipe, recipe.servings);
  const energyLabel =
    nutrition.qualitativeLabels.calories.label === nutrition.qualitativeLabels.carbs.label
      ? nutrition.qualitativeLabels.calories.label
      : `${nutrition.qualitativeLabels.calories.label}/${nutrition.qualitativeLabels.carbs.label}`;
  const energyTone =
    nutrition.qualitativeLabels.calories.tone === 'danger' || nutrition.qualitativeLabels.carbs.tone === 'danger'
      ? 'danger'
      : nutrition.qualitativeLabels.calories.tone === 'warn' || nutrition.qualitativeLabels.carbs.tone === 'warn'
        ? 'warn'
        : nutrition.qualitativeLabels.calories.tone === 'success' && nutrition.qualitativeLabels.carbs.tone === 'success'
          ? 'success'
          : 'neutral';

  return [
    { text: `Carbo-kcal ${energyLabel}`, tone: energyTone as PlannerNutritionHoverBadge['tone'] },
    { text: `Prot ${nutrition.qualitativeLabels.protein.label}`, tone: nutrition.qualitativeLabels.protein.tone },
    { text: `Grassi ${nutrition.qualitativeLabels.fat.label}`, tone: nutrition.qualitativeLabels.fat.tone },
  ].filter((badge) => !badge.text.endsWith(' medio'));
}

function buildOriginalPlannerNutritionHoverBadges(detail: OriginalRecipeSupportDetailEntry | null | undefined): PlannerNutritionHoverBadge[] {
  const metadata = detail ? buildOriginalRecipeSupportMetadata(detail) : null;
  const visibleBadges = buildVisibleNutritionMetricBadges(metadata?.nutritionSignals ?? null);
  const caloriesBadge = visibleBadges.find((badge) => badge.key === 'calories');
  const carbsBadge = visibleBadges.find((badge) => badge.key === 'carbs');
  const restBadges = visibleBadges.filter((badge) => badge.key !== 'calories' && badge.key !== 'carbs');
  const badges: PlannerNutritionHoverBadge[] = [];

  if (caloriesBadge || carbsBadge) {
    const energyLabel =
      caloriesBadge && carbsBadge
        ? caloriesBadge.qualitativeLabel.label === carbsBadge.qualitativeLabel.label
          ? caloriesBadge.qualitativeLabel.label
          : `${caloriesBadge.qualitativeLabel.label}/${carbsBadge.qualitativeLabel.label}`
        : caloriesBadge?.qualitativeLabel.label ?? carbsBadge?.qualitativeLabel.label ?? '';
    const energyTone =
      caloriesBadge?.qualitativeLabel.tone === 'danger' || carbsBadge?.qualitativeLabel.tone === 'danger'
        ? 'danger'
        : caloriesBadge?.qualitativeLabel.tone === 'warn' || carbsBadge?.qualitativeLabel.tone === 'warn'
          ? 'warn'
          : caloriesBadge?.qualitativeLabel.tone === 'success' && carbsBadge?.qualitativeLabel.tone === 'success'
            ? 'success'
            : 'neutral';

    badges.push({ text: `Carbo-kcal ${energyLabel}`, tone: energyTone as PlannerNutritionHoverBadge['tone'] });
  }

  badges.push(
    ...restBadges.map((badge) => ({
      text: `${badge.metricLabel} ${badge.qualitativeLabel.label}`,
      tone: badge.qualitativeLabel.tone,
    })),
  );

  return badges;
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

function isPlannerBudgetLevel(value: unknown): value is PlannerBudgetLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

export default function PlannerPage() {
  const data = useLiveQuery(async () => {
    const [recipes, mealPlans] = await Promise.all([recipeRepository.list(), mealPlanRepository.list()]);
    return { recipes, mealPlans };
  }, []);
  const budgetSetting = useLiveQuery(
    () => settingsRepository.get(PLANNER_DAILY_NUTRITION_BUDGET_SETTING_KEY),
    [],
    undefined,
  );
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
  const plannerDailyNutritionBudget = useMemo<PlannerDailyNutritionBudget>(() => {
    const storedValue = budgetSetting?.value;
    if (!storedValue || typeof storedValue !== 'object') {
      return DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET;
    }

    const value = storedValue as Partial<Record<keyof PlannerDailyNutritionBudget, unknown>>;

    return {
      calories: isPlannerBudgetLevel(value.calories) ? value.calories : 'medium',
      protein: isPlannerBudgetLevel(value.protein) ? value.protein : 'medium',
      fat: isPlannerBudgetLevel(value.fat) ? value.fat : 'medium',
      carbs: isPlannerBudgetLevel(value.carbs) ? value.carbs : 'medium',
    };
  }, [budgetSetting]);

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
    const personalMatches: PlannerRecipeSuggestion[] = (query
      ? personalRecipeIndex.filter((recipe) => recipe.normalizedTitle.includes(query) || recipe.normalizedId.includes(query)).slice(0, 6)
      : personalRecipeIndex.slice(0, 8)
    ).map(({ id, title, servings, source, normalizedTitle }) => ({
      id,
      title,
      servings,
      source,
      normalizedTitle,
    }));

    const originalMatches: PlannerRecipeSuggestion[] =
      query.length >= 3
        ? originalRecipeIndex
            .filter((entry) => entry.normalizedTitle.includes(query) || entry.normalizedId.includes(query))
            .slice(0, 5)
            .map(({ id, title, servings, source, normalizedTitle }) => ({
              id,
              title,
              servings,
              source,
              normalizedTitle,
            }))
        : [];

    const deduped = new Map<string, PlannerRecipeSuggestion>();
    [...personalMatches, ...originalMatches].forEach((entry) => {
      if (!deduped.has(entry.normalizedTitle)) {
        deduped.set(entry.normalizedTitle, entry);
      }
    });

    return [...deduped.values()];
  }, [originalRecipeIndex, personalRecipeIndex, settledRecipeTitle]);

  const firstRecipe = data?.recipes[0];
  const selectedWeekPlans = useMemo(
    () => (data?.mealPlans ?? []).filter((plan) => weekDays.includes(plan.date)),
    [data?.mealPlans, weekDays],
  );
  const selectedWeekOriginalPlanIdsKey = useMemo(
    () =>
      selectedWeekPlans
        .filter((plan) => plan.recipeSource === 'original')
        .map((plan) => plan.recipeId)
        .sort()
        .join('|'),
    [selectedWeekPlans],
  );

  useEffect(() => {
    const originalPlans = selectedWeekPlans.filter((plan) => plan.recipeSource === 'original');
    if (!originalLookup || originalPlans.length === 0) {
      setOriginalPlanDetails((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const missingOriginalPlans = originalPlans.filter((plan) => !originalPlanDetails[plan.recipeId]);
    if (missingOriginalPlans.length === 0) {
      return;
    }

    let active = true;
    Promise.all(
      missingOriginalPlans.map(async (plan) => {
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

      const nextEntries = Object.fromEntries(
        pairs.filter((pair): pair is readonly [string, OriginalRecipeSupportDetailEntry] => Boolean(pair)),
      );
      if (Object.keys(nextEntries).length === 0) {
        return;
      }

      setOriginalPlanDetails((current) => ({ ...current, ...nextEntries }));
    });

    return () => {
      active = false;
    };
  }, [originalLookup, originalPlanDetails, selectedWeekOriginalPlanIdsKey, selectedWeekPlans]);

  useEffect(() => {
    const visibleOriginalSuggestions = recipeTitleSuggestions.filter((recipe) => recipe.source === 'original');
    if (!originalLookup || visibleOriginalSuggestions.length === 0) {
      return;
    }

    const missingSuggestions = visibleOriginalSuggestions.filter((recipe) => !originalPlanDetails[recipe.id]);
    if (missingSuggestions.length === 0) {
      return;
    }

    let active = true;
    Promise.all(
      missingSuggestions.map(async (recipe) => {
        const entry = originalLookup.entries.find((item) => item.id === recipe.id);
        if (!entry) {
          return null;
        }

        try {
          const detail = await loadOriginalRecipeSupportDetailByLookup(entry);
          return [recipe.id, detail] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!active) {
        return;
      }

      const nextEntries = Object.fromEntries(
        pairs.filter((pair): pair is readonly [string, OriginalRecipeSupportDetailEntry] => Boolean(pair)),
      );
      if (Object.keys(nextEntries).length === 0) {
        return;
      }

      setOriginalPlanDetails((current) => ({ ...current, ...nextEntries }));
    });

    return () => {
      active = false;
    };
  }, [originalLookup, originalPlanDetails, recipeTitleSuggestions]);

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

  const visiblePersonalNutritionRecipeIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...recipeTitleSuggestions.filter((recipe) => recipe.source === 'personal').map((recipe) => recipe.id),
          ...selectedWeekPlans.filter((plan) => plan.recipeSource === 'personal').map((plan) => plan.recipeId),
        ]),
      ),
    [recipeTitleSuggestions, selectedWeekPlans],
  );

  const personalPlannerNutritionBadgesById = useMemo(
    () =>
      new Map(
        visiblePersonalNutritionRecipeIds
          .map((recipeId) => recipeCatalog.find((recipe) => recipe.id === recipeId))
          .filter((recipe): recipe is NonNullable<typeof recipeCatalog[number]> => Boolean(recipe))
          .map((recipe) => [recipe.id, buildPersonalPlannerNutritionHoverBadges(recipe)]),
      ),
    [recipeCatalog, visiblePersonalNutritionRecipeIds],
  );

  const plannerBudgetByDay = useMemo(
    () =>
      Object.fromEntries(
        weekDays.map((day) => {
          const plansForDay = (data?.mealPlans ?? []).filter((plan) => plan.date === day);
          const nutritionSnapshots = plansForDay.flatMap((plan) => {
            if (plan.recipeSource === 'personal') {
              const recipe = recipeCatalog.find((item) => item.id === plan.recipeId);
              if (!recipe) {
                return [];
              }

              return [{ qualitativeLabels: analyzeRecipeNutrition(recipe, plan.servings).qualitativeLabels }];
            }

            const detail = originalPlanDetails[plan.recipeId];
            const nutritionSignals = detail ? buildOriginalRecipeSupportMetadata(detail).nutritionSignals : null;
            if (!nutritionSignals) {
              return [];
            }

            return [{ qualitativeLabels: nutritionSignals.qualitativeLabels }];
          });

          return [day, evaluatePlannerDayBudget(nutritionSnapshots, plannerDailyNutritionBudget)] as const;
        }),
      ),
    [data?.mealPlans, originalPlanDetails, plannerDailyNutritionBudget, recipeCatalog, weekDays],
  );

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

  async function getOriginalDetailForRecipeId(recipeId: string): Promise<OriginalRecipeSupportDetailEntry | null> {
    if (originalPlanDetails[recipeId]) {
      return originalPlanDetails[recipeId];
    }

    const lookup = originalLookup ?? (await loadOriginalRecipeSupportLookup().catch(() => null));
    if (!lookup) {
      return null;
    }

    if (!originalLookup) {
      setOriginalLookup(lookup);
    }

    const lookupEntry = lookup.entries.find((entry) => entry.id === recipeId);
    if (!lookupEntry) {
      return null;
    }

    try {
      const detail = await loadOriginalRecipeSupportDetailByLookup(lookupEntry);
      setOriginalPlanDetails((current) => (current[recipeId] ? current : { ...current, [recipeId]: detail }));
      return detail;
    } catch {
      return null;
    }
  }

  async function resolvePlannerDishGroup(plan: PlannerPlanDescriptor): Promise<PlannerDishGroup> {
    if (plan.recipeSource === 'personal') {
      const recipe = recipeCatalog.find((item) => item.id === plan.recipeId);
      return getPlannerDishGroupFromCategory(recipe?.category);
    }

    const detail = await getOriginalDetailForRecipeId(plan.recipeId);
    return getPlannerDishGroupFromCategory(detail?.category);
  }

  async function validatePlannerDayConstraints(candidate: PlannerPlanDescriptor): Promise<string | null> {
    if (!data) {
      return null;
    }

    const sameDayPlans = data.mealPlans.filter((plan) => plan.date === candidate.date && plan.id !== candidate.id);
    const entries = await Promise.all(
      [...sameDayPlans, candidate].map(async (plan) => ({
        dishGroup: await resolvePlannerDishGroup({
          id: 'id' in plan ? plan.id : undefined,
          date: plan.date,
          recipeId: plan.recipeId,
          recipeSource: plan.recipeSource ?? 'personal',
        }),
      })),
    );

    return getPlannerDayConstraintError(entries);
  }

  async function handleQuickAddSuggestion(recipe: {
    id: string;
    title: string;
    servings: number;
    source: MealPlanSource;
  }) {
    const dayConstraintError = await validatePlannerDayConstraints({
      date: formState.date,
      recipeId: recipe.id,
      recipeSource: recipe.source,
    });
    if (dayConstraintError) {
      setErrorMessage(dayConstraintError);
      showToast({ tone: 'error', title: 'Limite giornaliero raggiunto', description: dayConstraintError });
      return;
    }

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
    const dayConstraintError = await validatePlannerDayConstraints({
      id: editingId ?? undefined,
      date: payload.date,
      recipeId: payload.recipeId,
      recipeSource: payload.recipeSource ?? 'personal',
    });
    if (dayConstraintError) {
      setErrorMessage(dayConstraintError);
      return;
    }

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

  async function handleBudgetChange(metric: keyof PlannerDailyNutritionBudget, level: PlannerBudgetLevel) {
    await settingsRepository.put({
      key: PLANNER_DAILY_NUTRITION_BUDGET_SETTING_KEY,
      value: {
        ...plannerDailyNutritionBudget,
        [metric]: level,
      },
      updatedAt: new Date().toISOString(),
    });
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
            Dopo il terzo carattere, quando ti fermi un attimo, cerco anche nel ricettario storico. Le ricette originali si possono pianificare, ma non consumare direttamente. I pasti del giorno vengono mostrati in semplice sequenza.
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
                      <PlannerRecipeNutritionHover
                        title={recipe.title}
                        badges={
                          recipe.source === 'personal'
                            ? personalPlannerNutritionBadgesById.get(recipe.id) ?? []
                            : buildOriginalPlannerNutritionHoverBadges(originalPlanDetails[recipe.id])
                        }
                      />
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
          <label>
            <span>Budget energia + carbo / giorno</span>
            <select
              value={plannerDailyNutritionBudget.calories}
              onChange={async (event) => {
                const level = event.target.value as PlannerBudgetLevel;
                await settingsRepository.put({
                  key: PLANNER_DAILY_NUTRITION_BUDGET_SETTING_KEY,
                  value: {
                    ...plannerDailyNutritionBudget,
                    calories: level,
                    carbs: level,
                  },
                  updatedAt: new Date().toISOString(),
                });
              }}
            >
              <option value="low">Basso</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </label>
          <label>
            <span>Budget proteine / giorno</span>
            <select
              value={plannerDailyNutritionBudget.protein}
              onChange={(event) => void handleBudgetChange('protein', event.target.value as PlannerBudgetLevel)}
            >
              <option value="low">Basso</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </label>
          <label>
            <span>Budget grassi / giorno</span>
            <select
              value={plannerDailyNutritionBudget.fat}
              onChange={(event) => void handleBudgetChange('fat', event.target.value as PlannerBudgetLevel)}
            >
              <option value="low">Basso</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </label>
        </div>
        <p className="field-hint">
          Il planner confronta il profilo nutrizionale del giorno con il budget scelto e porta in rosso solo gli scostamenti davvero rilevanti.
        </p>
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
            const plansForDay = data.mealPlans
              .filter((plan) => plan.date === day)
              .slice()
              .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
            const dayBudgetStatus = plannerBudgetByDay[day];
            const energyWarnings = [dayBudgetStatus.calories, dayBudgetStatus.carbs].filter((status) => status.tone === 'danger');
            const groupedBudgetWarnings = [
              ...(energyWarnings.length > 0
                ? [
                    {
                      key: 'energy',
                      tone: 'danger' as const,
                      text:
                        energyWarnings.length === 2
                          ? `Energia: ${energyWarnings.map((status) => status.text.replace(/^(Kcal|Carbo):\s*/i, '')).join(' • ')}`
                          : `Energia: ${energyWarnings[0].text}`,
                    },
                  ]
                : []),
              ...(dayBudgetStatus.protein.tone === 'danger'
                ? [{ key: 'protein', tone: 'danger' as const, text: dayBudgetStatus.protein.text }]
                : []),
              ...(dayBudgetStatus.fat.tone === 'danger'
                ? [{ key: 'fat', tone: 'danger' as const, text: dayBudgetStatus.fat.text }]
                : []),
            ];
            return (
              <article key={day} className="week-day-card">
                {groupedBudgetWarnings.length > 0 ? (
                  <div className="badge-row planner-day-alerts">
                    {groupedBudgetWarnings.map((warning) => (
                      <StatusBadge key={`${day}-${warning.key}`} tone={warning.tone}>
                        {warning.text}
                      </StatusBadge>
                    ))}
                  </div>
                ) : null}
                <h3>{formatDayLabel(day)}</h3>
                {plansForDay.length === 0 ? <p>Nessun piano</p> : null}
                <div className="stack-sm">
                  {plansForDay.map((plan, index) => {
                    const recipe =
                      plan.recipeSource === 'personal'
                        ? data.recipes.find((item) => item.id === plan.recipeId)
                        : null;
                    const title = plan.recipeTitle ?? recipe?.title ?? 'Ricetta rimossa';
                    const originalDetail = plan.recipeSource === 'original' ? originalPlanDetails[plan.recipeId] ?? null : undefined;
                    return (
                      <div key={plan.id} className="mini-plan">
                        <strong>Pasto {index + 1}</strong>
                        <PlannerRecipeNutritionHover
                          title={title}
                          badges={
                            plan.recipeSource === 'personal'
                              ? personalPlannerNutritionBadgesById.get(plan.recipeId) ?? []
                              : buildOriginalPlannerNutritionHoverBadges(originalDetail)
                          }
                        />
                        {plan.recipeSource === 'original' ? <span>Archivio originale</span> : null}
                        <div className="inline-actions mini-plan-actions">
                          <button
                            className="button mini-plan-icon-button"
                            disabled={plan.status === 'consumed' || plan.recipeSource === 'original'}
                            onClick={() => handleConsume(plan.id)}
                            aria-label={plan.recipeSource === 'original' ? 'Da importare prima' : `Segna come consumato ${title}`}
                            title={plan.recipeSource === 'original' ? 'Da importare prima' : 'Segna come consumato'}
                          >
                            <span aria-hidden="true">{plan.recipeSource === 'original' ? '⟂' : '🍽'}</span>
                          </button>
                          <button
                            className="button button-danger mini-plan-icon-button"
                            onClick={() => handleDelete(plan.id)}
                            aria-label={`Elimina ${title}`}
                            title="Elimina"
                          >
                            <span aria-hidden="true">−</span>
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
