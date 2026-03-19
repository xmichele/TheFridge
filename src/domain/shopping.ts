import type { MissingIngredientDraft, ShoppingItem } from '@/domain/models';
import { convertQuantity, roundQuantity } from '@/domain/units';

export function findShoppingMergeCandidate(
  items: ShoppingItem[],
  draft: MissingIngredientDraft,
): ShoppingItem | undefined {
  return items.find(
    (item) =>
      !item.checked &&
      item.normalizedName === draft.normalizedName &&
      convertQuantity(draft.quantity, draft.unit, item.unit) !== null,
  );
}

export function mergeShoppingDraft(items: ShoppingItem[], draft: MissingIngredientDraft, now: string): ShoppingItem[] {
  const existing = findShoppingMergeCandidate(items, draft);

  if (!existing) {
    return [
      ...items,
      {
        id: crypto.randomUUID(),
        displayName: draft.displayName,
        normalizedName: draft.normalizedName,
        quantity: roundQuantity(draft.quantity),
        unit: draft.unit,
        checked: false,
        sourceType: draft.sourceRefId ? 'consumption-deficit' : 'recipe-missing',
        sourceRefId: draft.sourceRefId,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  const convertedDraft = convertQuantity(draft.quantity, draft.unit, existing.unit);
  if (convertedDraft === null) {
    return items;
  }

  return items.map((item) =>
    item.id === existing.id
      ? {
          ...item,
          quantity: roundQuantity(item.quantity + convertedDraft),
          updatedAt: now,
          sourceRefId: item.sourceRefId ?? draft.sourceRefId,
        }
      : item,
  );
}
