import { describe, expect, it } from 'vitest';

import { applyMealConsumption, buildRecipeMissingShoppingItems } from '@/domain/consumption';
import type { MealPlan, PantryItem, Recipe, ShoppingItem } from '@/domain/models';

const now = '2026-03-18T12:00:00.000Z';

const pantryItems: PantryItem[] = [
  {
    id: 'pantry-pasta',
    displayName: 'Pasta secca',
    normalizedName: 'pasta secca',
    quantity: 0.5,
    unit: 'kg',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'pantry-passata',
    displayName: 'Passata di pomodoro',
    normalizedName: 'passata di pomodoro',
    quantity: 150,
    unit: 'ml',
    createdAt: now,
    updatedAt: now,
  },
];

const recipe: Recipe = {
  id: 'recipe-pasta',
  title: 'Pasta rossa',
  servings: 2,
  ingredients: [
    {
      id: 'ingredient-pasta',
      displayName: 'Pasta secca',
      normalizedName: 'pasta secca',
      quantity: 400,
      unit: 'g',
    },
    {
      id: 'ingredient-passata',
      displayName: 'Passata di pomodoro',
      normalizedName: 'passata di pomodoro',
      quantity: 200,
      unit: 'ml',
    },
    {
      id: 'ingredient-basilico',
      displayName: 'Basilico',
      normalizedName: 'basilico',
      quantity: 4,
      unit: 'pcs',
      optional: true,
    },
  ],
  steps: ['Cuoci'],
  createdAt: now,
  updatedAt: now,
};

const mealPlan: MealPlan = {
  id: 'plan-1',
  date: '2026-03-18',
  slot: 'dinner',
  recipeId: recipe.id,
  servings: 2,
  status: 'planned',
  createdAt: now,
  updatedAt: now,
};

describe('meal consumption', () => {
  it('subtracts pantry stock, never goes negative and creates shopping deficits', () => {
    const result = applyMealConsumption({
      pantryItems,
      shoppingItems: [],
      mealPlan,
      recipe,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.updatedMealPlan.status).toBe('consumed');
    expect(result.updatedPantryItems.find((item) => item.id === 'pantry-pasta')?.quantity).toBe(0.1);
    expect(result.updatedPantryItems.find((item) => item.id === 'pantry-passata')?.quantity).toBe(0);
    expect(result.updatedPantryItems.every((item) => item.quantity >= 0)).toBe(true);
    expect(result.deficits).toEqual([
      {
        displayName: 'Passata di pomodoro',
        normalizedName: 'passata di pomodoro',
        quantity: 50,
        unit: 'ml',
        sourceRefId: 'plan-1',
      },
    ]);
    expect(result.updatedShoppingItems[0].quantity).toBe(50);
    expect(result.updatedShoppingItems[0].sourceType).toBe('consumption-deficit');
  });

  it('does not allow double consumption', () => {
    const alreadyConsumed = applyMealConsumption({
      pantryItems,
      shoppingItems: [],
      mealPlan: { ...mealPlan, status: 'consumed' },
      recipe,
      now,
    });

    expect(alreadyConsumed).toEqual({
      ok: false,
      reason: 'already-consumed',
    });
  });

  it('generates recipe missing shopping items without optional deficits', () => {
    const result = buildRecipeMissingShoppingItems({
      pantryItems,
      shoppingItems: [] as ShoppingItem[],
      recipe,
      servings: 2,
      now,
    });

    expect(result.deficits).toEqual([
      {
        displayName: 'Passata di pomodoro',
        normalizedName: 'passata di pomodoro',
        quantity: 50,
        unit: 'ml',
      },
    ]);
    expect(result.updatedShoppingItems).toHaveLength(1);
  });
});
