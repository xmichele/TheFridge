import Dexie, { type EntityTable } from 'dexie';

import type {
  AppSetting,
  InventoryMovement,
  MealPlan,
  PantryItem,
  Recipe,
  ShoppingItem,
} from '@/domain/models';

class TheFridgeDatabase extends Dexie {
  pantryItems!: EntityTable<PantryItem, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  mealPlans!: EntityTable<MealPlan, 'id'>;
  shoppingItems!: EntityTable<ShoppingItem, 'id'>;
  inventoryMovements!: EntityTable<InventoryMovement, 'id'>;
  appSettings!: EntityTable<AppSetting, 'key'>;

  constructor() {
    super('the-fridge');

    this.version(1).stores({
      pantryItems: 'id, normalizedName, updatedAt, expirationDate, category',
      recipes: 'id, title, updatedAt, category, *tags',
      mealPlans: 'id, date, slot, recipeId, status, updatedAt',
      shoppingItems: 'id, normalizedName, checked, sourceType, updatedAt',
      inventoryMovements: 'id, ingredientNormalizedName, createdAt, reason',
      appSettings: 'key, updatedAt',
    });
  }
}

export const db = new TheFridgeDatabase();
