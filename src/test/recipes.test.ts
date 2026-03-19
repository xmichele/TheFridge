import { describe, expect, it } from 'vitest';

import type { Recipe } from '@/domain/models';
import { scaleRecipeIngredients } from '@/domain/recipes';

const recipe: Recipe = {
  id: 'recipe-1',
  title: 'Pasta',
  servings: 2,
  ingredients: [
    {
      id: 'ingredient-1',
      displayName: 'Pasta secca',
      normalizedName: 'pasta secca',
      quantity: 200,
      unit: 'g',
    },
    {
      id: 'ingredient-2',
      displayName: 'Passata di pomodoro',
      normalizedName: 'passata di pomodoro',
      quantity: 300,
      unit: 'ml',
    },
  ],
  steps: ['Cuoci', 'Condisci'],
  createdAt: '2026-03-18T08:00:00.000Z',
  updatedAt: '2026-03-18T08:00:00.000Z',
};

describe('scaleRecipeIngredients', () => {
  it('scales ingredient quantities by servings', () => {
    const scaled = scaleRecipeIngredients(recipe, 5);

    expect(scaled[0].quantity).toBe(500);
    expect(scaled[1].quantity).toBe(750);
  });
});
