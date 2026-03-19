import type {
  InventoryMovement,
  MealPlan,
  MissingIngredientDraft,
  PantryItem,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
} from '@/domain/models';
import { sortPantryCandidatesByPriority } from '@/domain/pantry';
import { scaleRecipeIngredients } from '@/domain/recipes';
import { mergeShoppingDraft } from '@/domain/shopping';
import { convertQuantity, roundQuantity } from '@/domain/units';

export interface MealConsumptionSuccess {
  ok: true;
  updatedPantryItems: PantryItem[];
  updatedShoppingItems: ShoppingItem[];
  updatedMealPlan: MealPlan;
  movements: InventoryMovement[];
  deficits: MissingIngredientDraft[];
}

export interface MealConsumptionFailure {
  ok: false;
  reason: 'already-consumed';
}

export type MealConsumptionResult = MealConsumptionSuccess | MealConsumptionFailure;

interface ConsumeIngredientResult {
  updatedPantryItems: PantryItem[];
  movements: InventoryMovement[];
  remainingRequiredQuantity: number;
}

function consumeIngredientFromPantry(
  pantryItems: PantryItem[],
  ingredient: RecipeIngredient,
  mealPlanId: string,
  now: string,
): ConsumeIngredientResult {
  let remaining = ingredient.quantity;
  let updatedPantryItems = [...pantryItems];
  const movements: InventoryMovement[] = [];

  const candidates = sortPantryCandidatesByPriority(
    pantryItems.filter(
      (item) =>
        item.normalizedName === ingredient.normalizedName &&
        convertQuantity(item.quantity, item.unit, ingredient.unit) !== null,
    ),
  );

  for (const candidate of candidates) {
    if (remaining <= 0) {
      break;
    }

    const availableInIngredientUnit = convertQuantity(candidate.quantity, candidate.unit, ingredient.unit);
    if (availableInIngredientUnit === null || availableInIngredientUnit <= 0) {
      continue;
    }

    const amountToConsume = Math.min(availableInIngredientUnit, remaining);
    const amountToConsumeInCandidateUnit = convertQuantity(
      amountToConsume,
      ingredient.unit,
      candidate.unit,
    );

    if (amountToConsumeInCandidateUnit === null) {
      continue;
    }

    remaining = roundQuantity(remaining - amountToConsume);

    updatedPantryItems = updatedPantryItems.map((item) =>
      item.id === candidate.id
        ? {
            ...item,
            quantity: roundQuantity(Math.max(0, item.quantity - amountToConsumeInCandidateUnit)),
            updatedAt: now,
          }
        : item,
    );

    movements.push({
      id: crypto.randomUUID(),
      ingredientNormalizedName: candidate.normalizedName,
      ingredientDisplayName: candidate.displayName,
      delta: roundQuantity(-amountToConsumeInCandidateUnit),
      unit: candidate.unit,
      reason: 'meal-consumption',
      createdAt: now,
      referenceId: mealPlanId,
      metadata: {
        recipeIngredientId: ingredient.id,
      },
    });
  }

  return {
    updatedPantryItems,
    movements,
    remainingRequiredQuantity: remaining,
  };
}

export function applyMealConsumption(args: {
  pantryItems: PantryItem[];
  shoppingItems: ShoppingItem[];
  mealPlan: MealPlan;
  recipe: Recipe;
  now: string;
}): MealConsumptionResult {
  const { mealPlan, recipe, now } = args;

  if (mealPlan.status === 'consumed') {
    return {
      ok: false,
      reason: 'already-consumed',
    };
  }

  const scaledIngredients = scaleRecipeIngredients(recipe, mealPlan.servings);
  let updatedPantryItems = [...args.pantryItems];
  let updatedShoppingItems = [...args.shoppingItems];
  const movements: InventoryMovement[] = [];
  const deficits: MissingIngredientDraft[] = [];

  for (const ingredient of scaledIngredients) {
    const consumption = consumeIngredientFromPantry(updatedPantryItems, ingredient, mealPlan.id, now);
    updatedPantryItems = consumption.updatedPantryItems;
    movements.push(...consumption.movements);

    if (consumption.remainingRequiredQuantity > 0 && !ingredient.optional) {
      const deficitDraft: MissingIngredientDraft = {
        displayName: ingredient.displayName,
        normalizedName: ingredient.normalizedName,
        quantity: consumption.remainingRequiredQuantity,
        unit: ingredient.unit,
        sourceRefId: mealPlan.id,
      };

      deficits.push(deficitDraft);
      updatedShoppingItems = mergeShoppingDraft(updatedShoppingItems, deficitDraft, now);
    }
  }

  return {
    ok: true,
    updatedPantryItems,
    updatedShoppingItems,
    updatedMealPlan: {
      ...mealPlan,
      status: 'consumed',
      updatedAt: now,
    },
    movements,
    deficits,
  };
}

export function buildRecipeMissingShoppingItems(args: {
  pantryItems: PantryItem[];
  shoppingItems: ShoppingItem[];
  recipe: Recipe;
  servings: number;
  now: string;
}): { updatedShoppingItems: ShoppingItem[]; deficits: MissingIngredientDraft[] } {
  const scaledIngredients = scaleRecipeIngredients(args.recipe, args.servings);
  let updatedShoppingItems = [...args.shoppingItems];
  const deficits: MissingIngredientDraft[] = [];

  for (const ingredient of scaledIngredients) {
    let available = 0;

    for (const pantryItem of args.pantryItems) {
      if (pantryItem.normalizedName !== ingredient.normalizedName) {
        continue;
      }

      const converted = convertQuantity(pantryItem.quantity, pantryItem.unit, ingredient.unit);
      if (converted !== null) {
        available += converted;
      }
    }

    const deficit = roundQuantity(Math.max(0, ingredient.quantity - available));
    if (deficit <= 0 || ingredient.optional) {
      continue;
    }

    const draft: MissingIngredientDraft = {
      displayName: ingredient.displayName,
      normalizedName: ingredient.normalizedName,
      quantity: deficit,
      unit: ingredient.unit,
    };

    deficits.push(draft);
    updatedShoppingItems = mergeShoppingDraft(updatedShoppingItems, draft, args.now);
  }

  return {
    updatedShoppingItems,
    deficits,
  };
}
