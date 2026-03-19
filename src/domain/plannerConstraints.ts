export type PlannerDishGroup = 'primo' | 'secondo' | null;

export interface PlannerDayConstraintEntry {
  dishGroup: PlannerDishGroup;
}

export const PLANNER_MAX_ENTRIES_PER_DAY = 6;
export const PLANNER_MAX_PRIMI_PER_DAY = 2;
export const PLANNER_MAX_SECONDI_PER_DAY = 3;

export function getPlannerDishGroupFromCategory(category: string | undefined): PlannerDishGroup {
  const normalized = category?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes('primo') ||
    normalized.includes('prim') ||
    normalized.includes('zuppa') ||
    normalized.includes('zupp') ||
    normalized.includes('minestra') ||
    normalized.includes('minestr') ||
    normalized.includes('brodo')
  ) {
    return 'primo';
  }

  if (
    normalized.includes('second') ||
    normalized.includes('carne') ||
    normalized.includes('pesce') ||
    normalized.includes('pollame')
  ) {
    return 'secondo';
  }

  return null;
}

export function getPlannerDayConstraintError(entries: PlannerDayConstraintEntry[]): string | null {
  if (entries.length > PLANNER_MAX_ENTRIES_PER_DAY) {
    return 'Non puoi pianificare piu di 6 pasti nello stesso giorno.';
  }

  const primiCount = entries.filter((entry) => entry.dishGroup === 'primo').length;
  if (primiCount > PLANNER_MAX_PRIMI_PER_DAY) {
    return 'Non puoi pianificare piu di 2 primi nello stesso giorno.';
  }

  const secondiCount = entries.filter((entry) => entry.dishGroup === 'secondo').length;
  if (secondiCount > PLANNER_MAX_SECONDI_PER_DAY) {
    return 'Non puoi pianificare piu di 3 secondi nello stesso giorno.';
  }

  return null;
}
