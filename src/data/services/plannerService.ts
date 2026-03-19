import type { MealPlan, MealPlanSource, MealPlanStatus, MealSlot } from '@/domain/models';
import { applyMealConsumption } from '@/domain/consumption';
import { db } from '@/data/db';
import {
  mealPlanRepository,
  pantryRepository,
  recipeRepository,
  shoppingRepository,
} from '@/data/repositories';
import { mealPlanSchema } from '@/validation/schemas';

export interface MealPlanInput {
  date: string;
  slot: MealSlot;
  recipeId: string;
  recipeTitle?: string;
  recipeSource?: MealPlanSource;
  servings: number;
  status?: MealPlanStatus;
}

function buildMealPlan(input: MealPlanInput, now: string, current?: MealPlan): MealPlan {
  return mealPlanSchema.parse({
    id: current?.id ?? crypto.randomUUID(),
    date: input.date,
    slot: input.slot,
    recipeId: input.recipeId,
    recipeTitle: input.recipeTitle?.trim() || current?.recipeTitle || undefined,
    recipeSource: input.recipeSource ?? current?.recipeSource ?? 'personal',
    servings: input.servings,
    status: input.status ?? current?.status ?? 'planned',
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function createMealPlan(input: MealPlanInput) {
  const now = new Date().toISOString();
  await mealPlanRepository.put(buildMealPlan(input, now));
}

export async function updateMealPlan(id: string, input: MealPlanInput) {
  const current = await mealPlanRepository.get(id);
  if (!current) {
    return;
  }

  const now = new Date().toISOString();
  await mealPlanRepository.put(buildMealPlan(input, now, current));
}

export async function deleteMealPlan(id: string) {
  await mealPlanRepository.delete(id);
}

export async function consumeMealPlan(id: string) {
  const mealPlan = await mealPlanRepository.get(id);
  if (!mealPlan) {
    return { success: false as const, error: 'Pasto non trovato.' };
  }

  if (mealPlan.recipeSource === 'original') {
    return {
      success: false as const,
      error: 'Le ricette del ricettario storico possono essere pianificate, ma vanno prima trasformate in ricette personali per poter aggiornare la dispensa.',
    };
  }

  const recipe = await recipeRepository.get(mealPlan.recipeId);
  if (!recipe) {
    return { success: false as const, error: 'Ricetta collegata non trovata.' };
  }

  const now = new Date().toISOString();
  const [pantryItems, shoppingItems] = await Promise.all([
    pantryRepository.list(),
    shoppingRepository.list(),
  ]);

  const result = applyMealConsumption({
    pantryItems,
    shoppingItems,
    mealPlan,
    recipe,
    now,
  });

  if (!result.ok) {
    return {
      success: false as const,
      error: 'Questo pasto e gia stato consumato.',
    };
  }

  await db.transaction(
    'rw',
    db.pantryItems,
    db.shoppingItems,
    db.mealPlans,
    db.inventoryMovements,
    async () => {
      await db.pantryItems.clear();
      await db.shoppingItems.clear();
      await db.pantryItems.bulkAdd(result.updatedPantryItems);
      await db.shoppingItems.bulkAdd(result.updatedShoppingItems);
      await db.mealPlans.put(result.updatedMealPlan);

      if (result.movements.length > 0) {
        await db.inventoryMovements.bulkAdd(result.movements);
      }
    },
  );

  return {
    success: true as const,
    deficits: result.deficits.length,
  };
}
