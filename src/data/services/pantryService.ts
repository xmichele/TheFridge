import type { InventoryMovement, PantryItem, Unit } from '@/domain/models';
import { normalizeIngredientName } from '@/domain/normalization';
import { convertQuantity, roundQuantity } from '@/domain/units';
import { db } from '@/data/db';
import { pantryRepository } from '@/data/repositories';
import { pantryItemSchema } from '@/validation/schemas';

export interface PantryItemInput {
  displayName: string;
  quantity: number;
  unit: Unit;
  category?: string;
  minThreshold?: number;
  expirationDate?: string;
  notes?: string;
}

function buildMovement(
  reason: InventoryMovement['reason'],
  item: PantryItem,
  delta: number,
  now: string,
): InventoryMovement {
  return {
    id: crypto.randomUUID(),
    ingredientNormalizedName: item.normalizedName,
    ingredientDisplayName: item.displayName,
    delta,
    unit: item.unit,
    reason,
    createdAt: now,
    referenceId: item.id,
  };
}

function buildPantryItem(input: PantryItemInput, now: string, current?: PantryItem): PantryItem {
  const nextItem: PantryItem = {
    id: current?.id ?? crypto.randomUUID(),
    displayName: input.displayName.trim(),
    normalizedName: normalizeIngredientName(input.displayName),
    quantity: roundQuantity(input.quantity),
    unit: input.unit,
    category: input.category?.trim() || undefined,
    minThreshold: input.minThreshold,
    expirationDate: input.expirationDate || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  return pantryItemSchema.parse(nextItem);
}

export async function createPantryItem(input: PantryItemInput) {
  const now = new Date().toISOString();
  const item = buildPantryItem(input, now);

  await db.transaction('rw', db.pantryItems, db.inventoryMovements, async () => {
    await pantryRepository.put(item);
    await db.inventoryMovements.add(buildMovement('manual-pantry-add', item, item.quantity, now));
  });
}

export async function updatePantryItem(id: string, input: PantryItemInput) {
  const current = await pantryRepository.get(id);
  if (!current) {
    return;
  }

  const now = new Date().toISOString();
  const nextItem = buildPantryItem(input, now, current);
  const convertedPrevious = convertQuantity(current.quantity, current.unit, nextItem.unit);
  const delta = convertedPrevious === null ? 0 : roundQuantity(nextItem.quantity - convertedPrevious);

  await db.transaction('rw', db.pantryItems, db.inventoryMovements, async () => {
    await pantryRepository.put(nextItem);
    await db.inventoryMovements.add(buildMovement('manual-pantry-edit', nextItem, delta, now));
  });
}

export async function deletePantryItem(id: string) {
  const current = await pantryRepository.get(id);
  if (!current) {
    return;
  }

  const now = new Date().toISOString();

  await db.transaction('rw', db.pantryItems, db.inventoryMovements, async () => {
    await pantryRepository.delete(id);
    await db.inventoryMovements.add(buildMovement('manual-pantry-delete', current, -current.quantity, now));
  });
}
