export const APP_NAME = 'The Fridge';
export const APP_DATA_VERSION = 1;
export const DEMO_SEED_VERSION = 1;

export const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp'] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

export const MEAL_SLOT_OPTIONS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOT_OPTIONS)[number];

export const MEAL_PLAN_STATUS_OPTIONS = ['planned', 'consumed'] as const;
export type MealPlanStatus = (typeof MEAL_PLAN_STATUS_OPTIONS)[number];

export const MEAL_PLAN_SOURCE_OPTIONS = ['personal', 'original'] as const;
export type MealPlanSource = (typeof MEAL_PLAN_SOURCE_OPTIONS)[number];

export const SHOPPING_SOURCE_OPTIONS = [
  'manual',
  'recipe-missing',
  'consumption-deficit',
] as const;
export type ShoppingSourceType = (typeof SHOPPING_SOURCE_OPTIONS)[number];

export const MOVEMENT_REASON_OPTIONS = [
  'manual-pantry-add',
  'manual-pantry-edit',
  'manual-pantry-delete',
  'meal-consumption',
  'shopping-to-pantry-transfer',
  'import',
  'reset',
] as const;
export type MovementReason = (typeof MOVEMENT_REASON_OPTIONS)[number];

export interface PantryItem {
  id: string;
  displayName: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  category?: string;
  minThreshold?: number;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  displayName: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlan {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string;
  recipeTitle?: string;
  recipeSource?: MealPlanSource;
  servings: number;
  status: MealPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  displayName: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  checked: boolean;
  sourceType: ShoppingSourceType;
  sourceRefId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  ingredientNormalizedName: string;
  ingredientDisplayName: string;
  delta: number;
  unit: Unit;
  reason: MovementReason;
  createdAt: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface AppExportPayload {
  version: number;
  exportedAt: string;
  pantryItems: PantryItem[];
  recipes: Recipe[];
  mealPlans: MealPlan[];
  shoppingItems: ShoppingItem[];
  inventoryMovements: InventoryMovement[];
  appSettings: AppSetting[];
}

export interface RecipeCoverage {
  ingredient: RecipeIngredient;
  requiredQuantity: number;
  unit: Unit;
  availableQuantity: number;
  deficitQuantity: number;
}

export interface MissingIngredientDraft {
  displayName: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  sourceRefId?: string;
}
