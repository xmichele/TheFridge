import { describe, expect, it } from 'vitest';

import { normalizeIngredientName } from '@/domain/normalization';

describe('normalizeIngredientName', () => {
  it('trims, lowercases and removes accents and duplicate separators', () => {
    expect(normalizeIngredientName('  Crème   fraîche!!  ')).toBe('creme fraiche');
  });
});
