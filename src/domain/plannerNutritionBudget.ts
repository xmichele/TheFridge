import type { NutrientLevelLabel } from '@/domain/nutrition';

export type PlannerBudgetLevel = 'low' | 'medium' | 'high';
export type PlannerBudgetMetric = 'calories' | 'protein' | 'fat' | 'carbs';

export interface PlannerDailyNutritionBudget {
  calories: PlannerBudgetLevel;
  protein: PlannerBudgetLevel;
  fat: PlannerBudgetLevel;
  carbs: PlannerBudgetLevel;
}

export interface PlannerDayBudgetMetricStatus {
  metric: PlannerBudgetMetric;
  tone: 'neutral' | 'danger';
  text: string;
  matchedMeals: number;
  totalMeals: number;
}

interface PlannerPlanNutritionSnapshot {
  qualitativeLabels: Record<PlannerBudgetMetric, NutrientLevelLabel>;
}

export const PLANNER_DAILY_NUTRITION_BUDGET_SETTING_KEY = 'planner-daily-nutrition-budget';

export const DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET: PlannerDailyNutritionBudget = {
  calories: 'medium',
  protein: 'medium',
  fat: 'medium',
  carbs: 'medium',
};

const LOWER_IS_BETTER_SCORE: Record<string, number> = {
  leggero: 0,
  medio: 1,
  alto: 2,
  'molto alto': 3,
};

const PROTEIN_SCORE: Record<string, number> = {
  scarso: 0,
  basso: 1,
  medio: 2,
  alto: 3,
};

const LOWER_IS_BETTER_TARGET: Record<PlannerBudgetLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const PROTEIN_TARGET: Record<PlannerBudgetLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function scoreMetric(metric: PlannerBudgetMetric, label: string): number | null {
  if (metric === 'protein') {
    return PROTEIN_SCORE[label] ?? null;
  }

  return LOWER_IS_BETTER_SCORE[label] ?? null;
}

function getMetricLabel(metric: PlannerBudgetMetric): string {
  switch (metric) {
    case 'calories':
      return 'Kcal';
    case 'protein':
      return 'Proteine';
    case 'fat':
      return 'Grassi';
    case 'carbs':
      return 'Carbo';
  }
}

function evaluateMetricStatus(
  metric: PlannerBudgetMetric,
  budgetLevel: PlannerBudgetLevel,
  snapshots: PlannerPlanNutritionSnapshot[],
): PlannerDayBudgetMetricStatus {
  const scores = snapshots
    .map((snapshot) => scoreMetric(metric, snapshot.qualitativeLabels[metric].label))
    .filter((score): score is number => score !== null);

  const label = getMetricLabel(metric);
  if (scores.length === 0) {
    return {
      metric,
      tone: 'neutral',
      text: `${label}: n.d.`,
      matchedMeals: 0,
      totalMeals: snapshots.length,
    };
  }

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const targetScore = metric === 'protein' ? PROTEIN_TARGET[budgetLevel] : LOWER_IS_BETTER_TARGET[budgetLevel];
  const hasEnoughCoverageForUpperWarning = scores.length >= 3;
  const hasEnoughCoverageForLowerWarning = scores.length >= 3;

  if (metric === 'protein') {
    if (hasEnoughCoverageForUpperWarning && averageScore > targetScore + 0.75) {
      return {
        metric,
        tone: 'danger',
        text: `${label}: sopra budget`,
        matchedMeals: scores.length,
        totalMeals: snapshots.length,
      };
    }

    if (hasEnoughCoverageForLowerWarning && averageScore < targetScore - 0.5) {
      return {
        metric,
        tone: 'danger',
        text: `${label}: sotto budget`,
        matchedMeals: scores.length,
        totalMeals: snapshots.length,
      };
    }
  } else {
    if (hasEnoughCoverageForUpperWarning && averageScore > targetScore + 0.5) {
      return {
        metric,
        tone: 'danger',
        text: `${label}: sopra budget`,
        matchedMeals: scores.length,
        totalMeals: snapshots.length,
      };
    }

    if (metric !== 'fat' && hasEnoughCoverageForLowerWarning && averageScore < targetScore - 0.75) {
      return {
        metric,
        tone: 'danger',
        text: `${label}: sotto budget`,
        matchedMeals: scores.length,
        totalMeals: snapshots.length,
      };
    }
  }

  return {
    metric,
    tone: 'neutral',
    text: `${label}: in target`,
    matchedMeals: scores.length,
    totalMeals: snapshots.length,
  };
}

export function evaluatePlannerDayBudget(
  snapshots: PlannerPlanNutritionSnapshot[],
  budget: PlannerDailyNutritionBudget,
): Record<PlannerBudgetMetric, PlannerDayBudgetMetricStatus> {
  return {
    calories: evaluateMetricStatus('calories', budget.calories, snapshots),
    protein: evaluateMetricStatus('protein', budget.protein, snapshots),
    fat: evaluateMetricStatus('fat', budget.fat, snapshots),
    carbs: evaluateMetricStatus('carbs', budget.carbs, snapshots),
  };
}
