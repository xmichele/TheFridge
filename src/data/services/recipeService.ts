import type { Recipe, Unit } from '@/domain/models';
import { buildRecipeMissingShoppingItems } from '@/domain/consumption';
import { normalizeIngredientName } from '@/domain/normalization';
import { duplicateRecipe as duplicateRecipeEntity } from '@/domain/recipes';
import { db } from '@/data/db';
import { pantryRepository, recipeRepository, shoppingRepository } from '@/data/repositories';
import { recipeSchema } from '@/validation/schemas';

export interface RecipeIngredientInput {
  id?: string;
  displayName: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
}

export interface RecipeInput {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  servings: number;
  ingredients: RecipeIngredientInput[];
  steps: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  notes?: string;
}

function buildRecipe(input: RecipeInput, now: string, current?: Recipe): Recipe {
  return recipeSchema.parse({
    id: current?.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    category: input.category?.trim() || undefined,
    tags: input.tags?.filter(Boolean),
    servings: input.servings,
    ingredients: input.ingredients.map((ingredient) => ({
      id: ingredient.id ?? crypto.randomUUID(),
      displayName: ingredient.displayName.trim(),
      normalizedName: normalizeIngredientName(ingredient.displayName),
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      optional: ingredient.optional || undefined,
    })),
    steps: input.steps.map((step) => step.trim()).filter(Boolean),
    prepTimeMinutes: input.prepTimeMinutes,
    cookTimeMinutes: input.cookTimeMinutes,
    notes: input.notes?.trim() || undefined,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function createRecipe(input: RecipeInput) {
  const now = new Date().toISOString();
  await recipeRepository.put(buildRecipe(input, now));
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const current = await recipeRepository.get(id);
  if (!current) {
    return;
  }

  const now = new Date().toISOString();
  await recipeRepository.put(buildRecipe(input, now, current));
}

export async function deleteRecipe(id: string) {
  await recipeRepository.delete(id);
}

export async function duplicateRecipe(id: string) {
  const recipe = await recipeRepository.get(id);
  if (!recipe) {
    return;
  }

  const now = new Date().toISOString();
  await recipeRepository.put(duplicateRecipeEntity(recipe, now));
}

export async function addRecipeMissingIngredientsToShopping(recipeId: string, servings: number) {
  const recipe = await recipeRepository.get(recipeId);
  if (!recipe) {
    return { created: 0 };
  }

  const now = new Date().toISOString();
  const [pantryItems, shoppingItems] = await Promise.all([
    pantryRepository.list(),
    shoppingRepository.list(),
  ]);

  const result = buildRecipeMissingShoppingItems({
    pantryItems,
    shoppingItems,
    recipe,
    servings,
    now,
  });

  await db.transaction('rw', db.shoppingItems, async () => {
    await db.shoppingItems.clear();
    await db.shoppingItems.bulkAdd(result.updatedShoppingItems);
  });

  return { created: result.deficits.length };
}
