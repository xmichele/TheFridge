import { describe, expect, it } from 'vitest';

import { areUnitsCompatible, convertQuantity } from '@/domain/units';

describe('unit conversion', () => {
  it('converts compatible mass and volume units safely', () => {
    expect(areUnitsCompatible('kg', 'g')).toBe(true);
    expect(convertQuantity(1.5, 'kg', 'g')).toBe(1500);
    expect(convertQuantity(750, 'ml', 'l')).toBe(0.75);
  });

  it('rejects unsafe conversions across incompatible unit families', () => {
    expect(areUnitsCompatible('pcs', 'g')).toBe(false);
    expect(convertQuantity(2, 'pcs', 'g')).toBeNull();
    expect(convertQuantity(1, 'tbsp', 'tsp')).toBeNull();
  });
});
