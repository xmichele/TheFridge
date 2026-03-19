import { APP_DATA_VERSION, DEMO_SEED_VERSION } from '@/domain/models';
import type { AppExportPayload, InventoryMovement } from '@/domain/models';
import { createExportPayload, parseImportPayload } from '@/domain/export';
import { db } from '@/data/db';
import { getAppSnapshot } from '@/data/repositories';
import { createDemoSeed } from '@/data/seed';

function buildSystemMovement(
  reason: InventoryMovement['reason'],
  now: string,
  label: string,
): InventoryMovement {
  return {
    id: crypto.randomUUID(),
    ingredientNormalizedName: label.toLowerCase().replace(/\s+/g, '-'),
    ingredientDisplayName: label,
    delta: 0,
    unit: 'pcs',
    reason,
    createdAt: now,
    metadata: {
      appVersion: APP_DATA_VERSION,
    },
  };
}

async function replaceAllCollections(payload: AppExportPayload, extraMovements: InventoryMovement[]) {
  await db.transaction(
    'rw',
    [db.pantryItems, db.recipes, db.mealPlans, db.shoppingItems, db.inventoryMovements, db.appSettings],
    async () => {
      await Promise.all([
        db.pantryItems.clear(),
        db.recipes.clear(),
        db.mealPlans.clear(),
        db.shoppingItems.clear(),
        db.inventoryMovements.clear(),
        db.appSettings.clear(),
      ]);

      await db.pantryItems.bulkAdd(payload.pantryItems);
      await db.recipes.bulkAdd(payload.recipes);
      await db.mealPlans.bulkAdd(payload.mealPlans);
      await db.shoppingItems.bulkAdd(payload.shoppingItems);
      await db.inventoryMovements.bulkAdd([...payload.inventoryMovements, ...extraMovements]);
      await db.appSettings.bulkAdd(payload.appSettings);
    },
  );
}

export async function ensureDemoData() {
  const existingRecipes = await db.recipes.count();
  const existingPantryItems = await db.pantryItems.count();

  if (existingRecipes > 0 || existingPantryItems > 0) {
    return;
  }

  await resetToDemoData();
}

export async function exportAppData(): Promise<AppExportPayload> {
  return createExportPayload(await getAppSnapshot(new Date().toISOString()));
}

export async function importAppData(raw: string): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = parseImportPayload(raw);

  if (!parsed.success) {
    return parsed;
  }

  const now = new Date().toISOString();
  const nextSettings = parsed.data.appSettings.some((setting) => setting.key === 'demoSeedVersion')
    ? parsed.data.appSettings
    : [...parsed.data.appSettings, { key: 'demoSeedVersion', value: DEMO_SEED_VERSION, updatedAt: now }];

  await replaceAllCollections(
    {
      ...parsed.data,
      appSettings: nextSettings,
    },
    [buildSystemMovement('import', now, 'Import dati')],
  );

  return { success: true };
}

export async function resetToDemoData() {
  const now = new Date();
  const seed = createDemoSeed(now);
  const resetMovement = buildSystemMovement('reset', now.toISOString(), 'Reset demo');

  await replaceAllCollections(
    {
      ...seed,
      exportedAt: now.toISOString(),
    },
    [resetMovement],
  );
}
