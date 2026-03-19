import { describe, expect, it } from 'vitest';

import {
  getPlannerDayConstraintError,
  getPlannerDishGroupFromCategory,
} from '@/domain/plannerConstraints';

describe('plannerConstraints', () => {
  it('classifies primi and secondi from common categories', () => {
    expect(getPlannerDishGroupFromCategory('Primi')).toBe('primo');
    expect(getPlannerDishGroupFromCategory('Zuppe')).toBe('primo');
    expect(getPlannerDishGroupFromCategory('Secondi')).toBe('secondo');
    expect(getPlannerDishGroupFromCategory('Pesce')).toBe('secondo');
    expect(getPlannerDishGroupFromCategory('Carne')).toBe('secondo');
    expect(getPlannerDishGroupFromCategory('Dessert')).toBeNull();
  });

  it('blocks more than six daily entries', () => {
    expect(
      getPlannerDayConstraintError([
        { dishGroup: null },
        { dishGroup: null },
        { dishGroup: null },
        { dishGroup: null },
        { dishGroup: null },
        { dishGroup: null },
        { dishGroup: null },
      ]),
    ).toContain('6 pasti');
  });

  it('blocks more than two primi per day', () => {
    expect(
      getPlannerDayConstraintError([
        { dishGroup: 'primo' },
        { dishGroup: 'primo' },
        { dishGroup: 'primo' },
      ]),
    ).toContain('2 primi');
  });

  it('blocks more than three secondi per day', () => {
    expect(
      getPlannerDayConstraintError([
        { dishGroup: 'secondo' },
        { dishGroup: 'secondo' },
        { dishGroup: 'secondo' },
        { dishGroup: 'secondo' },
      ]),
    ).toContain('3 secondi');
  });
});
