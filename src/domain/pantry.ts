import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

import type { PantryItem, RecipeCoverage, RecipeIngredient, Unit } from '@/domain/models';
import { convertQuantity, sumCompatibleQuantities } from '@/domain/units';

export type PantryFilter = 'all' | 'below-threshold' | 'expiring-soon' | 'expired' | 'depleted';

export function isPantryItemBelowThreshold(item: PantryItem): boolean {
  return typeof item.minThreshold === 'number' && item.quantity <= item.minThreshold;
}

export function isPantryItemExpired(item: PantryItem, now = new Date()): boolean {
  if (!item.expirationDate) {
    return false;
  }

  const expiration = parseISO(item.expirationDate);
  if (!isValid(expiration)) {
    return false;
  }

  return differenceInCalendarDays(expiration, now) < 0;
}

export function isPantryItemExpiringSoon(item: PantryItem, now = new Date()): boolean {
  if (!item.expirationDate) {
    return false;
  }

  const expiration = parseISO(item.expirationDate);
  if (!isValid(expiration)) {
    return false;
  }

  const daysLeft = differenceInCalendarDays(expiration, now);
  return daysLeft >= 0 && daysLeft <= 3;
}

export function isPantryItemDepleted(item: PantryItem): boolean {
  return item.quantity <= 0;
}

export function matchesPantryFilter(item: PantryItem, filter: PantryFilter, now = new Date()): boolean {
  switch (filter) {
    case 'below-threshold':
      return isPantryItemBelowThreshold(item);
    case 'expiring-soon':
      return isPantryItemExpiringSoon(item, now);
    case 'expired':
      return isPantryItemExpired(item, now);
    case 'depleted':
      return isPantryItemDepleted(item);
    default:
      return true;
  }
}

export function getAvailableQuantityForIngredient(
  pantryItems: PantryItem[],
  normalizedName: string,
  unit: Unit,
): number {
  return sumCompatibleQuantities(
    pantryItems
      .filter((item) => item.normalizedName === normalizedName)
      .map((item) => ({ quantity: item.quantity, unit: item.unit })),
    unit,
  );
}

export function buildRecipeCoverage(
  pantryItems: PantryItem[],
  ingredients: RecipeIngredient[],
): RecipeCoverage[] {
  return ingredients.map((ingredient) => {
    const availableQuantity = getAvailableQuantityForIngredient(
      pantryItems,
      ingredient.normalizedName,
      ingredient.unit,
    );

    return {
      ingredient,
      requiredQuantity: ingredient.quantity,
      unit: ingredient.unit,
      availableQuantity,
      deficitQuantity: Math.max(0, ingredient.quantity - availableQuantity),
    };
  });
}

export function sortPantryCandidatesByPriority(items: PantryItem[]): PantryItem[] {
  return [...items].sort((left, right) => {
    if (left.expirationDate && right.expirationDate) {
      return left.expirationDate.localeCompare(right.expirationDate);
    }

    if (left.expirationDate) {
      return -1;
    }

    if (right.expirationDate) {
      return 1;
    }

    return left.updatedAt.localeCompare(right.updatedAt);
  });
}

export function clampPantryQuantity(quantity: number): number {
  return quantity < 0 ? 0 : quantity;
}

export function canMergePantryUnits(existingUnit: Unit, incomingUnit: Unit): boolean {
  return convertQuantity(1, incomingUnit, existingUnit) !== null;
}
