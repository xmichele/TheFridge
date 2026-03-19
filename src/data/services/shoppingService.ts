import type { InventoryMovement, PantryItem, ShoppingItem, Unit } from '@/domain/models';
import { normalizeIngredientName } from '@/domain/normalization';
import { canMergePantryUnits } from '@/domain/pantry';
import { convertQuantity, roundQuantity } from '@/domain/units';
import { db } from '@/data/db';
import { pantryRepository, shoppingRepository } from '@/data/repositories';
import { shoppingItemSchema } from '@/validation/schemas';

export interface ShoppingItemInput {
  displayName: string;
  quantity: number;
  unit: Unit;
  notes?: string;
}

function buildShoppingItem(input: ShoppingItemInput, now: string, current?: ShoppingItem): ShoppingItem {
  return shoppingItemSchema.parse({
    id: current?.id ?? crypto.randomUUID(),
    displayName: input.displayName.trim(),
    normalizedName: normalizeIngredientName(input.displayName),
    quantity: roundQuantity(input.quantity),
    unit: input.unit,
    checked: current?.checked ?? false,
    sourceType: current?.sourceType ?? 'manual',
    sourceRefId: current?.sourceRefId,
    notes: input.notes?.trim() || undefined,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
}

function buildTransferMovement(item: PantryItem, quantity: number, now: string): InventoryMovement {
  return {
    id: crypto.randomUUID(),
    ingredientNormalizedName: item.normalizedName,
    ingredientDisplayName: item.displayName,
    delta: quantity,
    unit: item.unit,
    reason: 'shopping-to-pantry-transfer',
    createdAt: now,
    referenceId: item.id,
  };
}

export async function createShoppingItem(input: ShoppingItemInput) {
  const now = new Date().toISOString();
  await shoppingRepository.put(buildShoppingItem(input, now));
}

export async function updateShoppingItem(id: string, input: ShoppingItemInput) {
  const current = await shoppingRepository.get(id);
  if (!current) {
    return;
  }

  const now = new Date().toISOString();
  await shoppingRepository.put(buildShoppingItem(input, now, current));
}

export async function deleteShoppingItem(id: string) {
  await shoppingRepository.delete(id);
}

export async function toggleShoppingItemChecked(id: string, checked: boolean) {
  const current = await shoppingRepository.get(id);
  if (!current) {
    return;
  }

  await shoppingRepository.put({
    ...current,
    checked,
    updatedAt: new Date().toISOString(),
  });
}

export async function transferPurchasedItemsToPantry() {
  const [shoppingItems, pantryItems] = await Promise.all([
    shoppingRepository.list(),
    pantryRepository.list(),
  ]);

  const purchasedItems = shoppingItems.filter((item) => item.checked);
  if (purchasedItems.length === 0) {
    return { moved: 0 };
  }

  const now = new Date().toISOString();
  const updatedPantryItems = [...pantryItems];
  const movements: InventoryMovement[] = [];

  for (const purchasedItem of purchasedItems) {
    const existingPantryItem = updatedPantryItems.find(
      (pantryItem) =>
        pantryItem.normalizedName === purchasedItem.normalizedName &&
        canMergePantryUnits(pantryItem.unit, purchasedItem.unit),
    );

    if (existingPantryItem) {
      const converted = convertQuantity(purchasedItem.quantity, purchasedItem.unit, existingPantryItem.unit);
      if (converted !== null) {
        existingPantryItem.quantity = roundQuantity(existingPantryItem.quantity + converted);
        existingPantryItem.updatedAt = now;
        movements.push(buildTransferMovement(existingPantryItem, converted, now));
      }
      continue;
    }

    const newPantryItem: PantryItem = {
      id: crypto.randomUUID(),
      displayName: purchasedItem.displayName,
      normalizedName: purchasedItem.normalizedName,
      quantity: purchasedItem.quantity,
      unit: purchasedItem.unit,
      createdAt: now,
      updatedAt: now,
      notes: purchasedItem.notes,
    };

    updatedPantryItems.push(newPantryItem);
    movements.push(buildTransferMovement(newPantryItem, newPantryItem.quantity, now));
  }

  const remainingShoppingItems = shoppingItems.filter((item) => !item.checked);

  await db.transaction(
    'rw',
    db.shoppingItems,
    db.pantryItems,
    db.inventoryMovements,
    async () => {
      await db.shoppingItems.clear();
      await db.pantryItems.clear();
      await db.shoppingItems.bulkAdd(remainingShoppingItems);
      await db.pantryItems.bulkAdd(updatedPantryItems);
      await db.inventoryMovements.bulkAdd(movements);
    },
  );

  return { moved: purchasedItems.length };
}
