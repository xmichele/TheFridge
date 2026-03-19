import type {
  AppExportPayload,
  AppSetting,
  InventoryMovement,
  MealPlan,
  PantryItem,
  Recipe,
  ShoppingItem,
} from '@/domain/models';
import { db } from '@/data/db';
import {
  appSettingSchema,
  inventoryMovementSchema,
  mealPlanSchema,
  pantryItemSchema,
  recipeSchema,
  shoppingItemSchema,
} from '@/validation/schemas';

function sortByUpdatedAtDescending<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const pantryRepository = {
  async list(): Promise<PantryItem[]> {
    const items = await db.pantryItems.toArray();
    return items.sort((left, right) => left.displayName.localeCompare(right.displayName, 'it'));
  },
  get(id: string) {
    return db.pantryItems.get(id);
  },
  async put(item: PantryItem) {
    pantryItemSchema.parse(item);
    await db.pantryItems.put(item);
    return item;
  },
  async bulkPut(items: PantryItem[]) {
    items.forEach((item) => pantryItemSchema.parse(item));
    await db.pantryItems.bulkPut(items);
  },
  delete(id: string) {
    return db.pantryItems.delete(id);
  },
};

export const recipeRepository = {
  async list(): Promise<Recipe[]> {
    const items = await db.recipes.toArray();
    return sortByUpdatedAtDescending(items);
  },
  get(id: string) {
    return db.recipes.get(id);
  },
  async put(item: Recipe) {
    recipeSchema.parse(item);
    await db.recipes.put(item);
    return item;
  },
  async bulkPut(items: Recipe[]) {
    items.forEach((item) => recipeSchema.parse(item));
    await db.recipes.bulkPut(items);
  },
  delete(id: string) {
    return db.recipes.delete(id);
  },
};

export const mealPlanRepository = {
  async list(): Promise<MealPlan[]> {
    const items = await db.mealPlans.toArray();
    return items.sort((left, right) =>
      `${left.date}-${left.slot}`.localeCompare(`${right.date}-${right.slot}`),
    );
  },
  get(id: string) {
    return db.mealPlans.get(id);
  },
  async put(item: MealPlan) {
    mealPlanSchema.parse(item);
    await db.mealPlans.put(item);
    return item;
  },
  async bulkPut(items: MealPlan[]) {
    items.forEach((item) => mealPlanSchema.parse(item));
    await db.mealPlans.bulkPut(items);
  },
  delete(id: string) {
    return db.mealPlans.delete(id);
  },
};

export const shoppingRepository = {
  async list(): Promise<ShoppingItem[]> {
    const items = await db.shoppingItems.toArray();
    return sortByUpdatedAtDescending(items);
  },
  get(id: string) {
    return db.shoppingItems.get(id);
  },
  async put(item: ShoppingItem) {
    shoppingItemSchema.parse(item);
    await db.shoppingItems.put(item);
    return item;
  },
  async bulkPut(items: ShoppingItem[]) {
    items.forEach((item) => shoppingItemSchema.parse(item));
    await db.shoppingItems.bulkPut(items);
  },
  delete(id: string) {
    return db.shoppingItems.delete(id);
  },
};

export const movementRepository = {
  async list(): Promise<InventoryMovement[]> {
    const items = await db.inventoryMovements.toArray();
    return sortByCreatedAtDescending(items);
  },
  async bulkAdd(items: InventoryMovement[]) {
    items.forEach((item) => inventoryMovementSchema.parse(item));
    await db.inventoryMovements.bulkAdd(items);
  },
};

export const settingsRepository = {
  async list(): Promise<AppSetting[]> {
    return sortByUpdatedAtDescending(await db.appSettings.toArray());
  },
  get(key: string) {
    return db.appSettings.get(key);
  },
  async put(setting: AppSetting) {
    appSettingSchema.parse(setting);
    await db.appSettings.put(setting);
    return setting;
  },
  async bulkPut(settings: AppSetting[]) {
    settings.forEach((setting) => appSettingSchema.parse(setting));
    await db.appSettings.bulkPut(settings);
  },
};

export async function getAppSnapshot(now: string): Promise<AppExportPayload> {
  return {
    version: 1,
    exportedAt: now,
    pantryItems: await pantryRepository.list(),
    recipes: await recipeRepository.list(),
    mealPlans: await mealPlanRepository.list(),
    shoppingItems: await shoppingRepository.list(),
    inventoryMovements: await movementRepository.list(),
    appSettings: await settingsRepository.list(),
  };
}
