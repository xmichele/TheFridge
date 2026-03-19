import type { Recipe, RecipeCoverage, RecipeIngredient } from '@/domain/models';
import { buildRecipeCoverage } from '@/domain/pantry';
import { roundQuantity } from '@/domain/units';

export function scaleRecipeIngredients(recipe: Recipe, targetServings: number): RecipeIngredient[] {
  const ratio = targetServings / recipe.servings;

  return recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: roundQuantity(ingredient.quantity * ratio),
  }));
}

export function scaleRecipeCoverage(
  recipe: Recipe,
  pantryItems: Parameters<typeof buildRecipeCoverage>[0],
  targetServings: number,
): RecipeCoverage[] {
  return buildRecipeCoverage(pantryItems, scaleRecipeIngredients(recipe, targetServings));
}

export function duplicateRecipe(recipe: Recipe, now: string): Recipe {
  return {
    ...recipe,
    id: crypto.randomUUID(),
    title: `${recipe.title} (copia)`,
    createdAt: now,
    updatedAt: now,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      id: crypto.randomUUID(),
    })),
  };
}
