import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
  evaluatePlannerDayBudget,
} from '@/domain/plannerNutritionBudget';

describe('evaluatePlannerDayBudget', () => {
  it('does not flag above-budget days when only one or two meals are planned', () => {
    const result = evaluatePlannerDayBudget(
      [
        {
          qualitativeLabels: {
            calories: { label: 'alto', tone: 'warn' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'alto', tone: 'warn' },
            carbs: { label: 'alto', tone: 'warn' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'molto alto', tone: 'danger' },
            protein: { label: 'alto', tone: 'success' },
            fat: { label: 'alto', tone: 'warn' },
            carbs: { label: 'alto', tone: 'warn' },
          },
        },
      ],
      DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
    );

    expect(result.calories.tone).toBe('neutral');
    expect(result.carbs.tone).toBe('neutral');
    expect(result.fat.tone).toBe('neutral');
  });

  it('marks calories, fat and carbs as above budget when the day is too heavy', () => {
    const result = evaluatePlannerDayBudget(
      [
        {
          qualitativeLabels: {
            calories: { label: 'alto', tone: 'warn' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'molto alto', tone: 'danger' },
            carbs: { label: 'alto', tone: 'warn' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'alto', tone: 'warn' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'alto', tone: 'warn' },
            carbs: { label: 'alto', tone: 'warn' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'alto', tone: 'warn' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'alto', tone: 'warn' },
            carbs: { label: 'alto', tone: 'warn' },
          },
        },
      ],
      DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
    );

    expect(result.calories.tone).toBe('danger');
    expect(result.calories.text).toContain('sopra budget');
    expect(result.fat.tone).toBe('danger');
    expect(result.carbs.tone).toBe('danger');
    expect(result.protein.tone).toBe('neutral');
  });

  it('marks protein as below budget when a sufficiently planned day is too poor in protein', () => {
    const result = evaluatePlannerDayBudget(
      [
        {
          qualitativeLabels: {
            calories: { label: 'medio', tone: 'neutral' },
            protein: { label: 'basso', tone: 'warn' },
            fat: { label: 'medio', tone: 'neutral' },
            carbs: { label: 'medio', tone: 'neutral' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'medio', tone: 'neutral' },
            protein: { label: 'basso', tone: 'warn' },
            fat: { label: 'medio', tone: 'neutral' },
            carbs: { label: 'medio', tone: 'neutral' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'leggero', tone: 'success' },
            protein: { label: 'scarso', tone: 'danger' },
            fat: { label: 'leggero', tone: 'success' },
            carbs: { label: 'leggero', tone: 'success' },
          },
        },
      ],
      DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
    );

    expect(result.protein.tone).toBe('danger');
    expect(result.protein.text).toContain('sotto budget');
  });

  it('adapts the warning thresholds when the user chooses a high protein budget', () => {
    const result = evaluatePlannerDayBudget(
      [
        {
          qualitativeLabels: {
            calories: { label: 'medio', tone: 'neutral' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'medio', tone: 'neutral' },
            carbs: { label: 'medio', tone: 'neutral' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'medio', tone: 'neutral' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'medio', tone: 'neutral' },
            carbs: { label: 'medio', tone: 'neutral' },
          },
        },
        {
          qualitativeLabels: {
            calories: { label: 'medio', tone: 'neutral' },
            protein: { label: 'medio', tone: 'neutral' },
            fat: { label: 'medio', tone: 'neutral' },
            carbs: { label: 'medio', tone: 'neutral' },
          },
        },
      ],
      {
        ...DEFAULT_PLANNER_DAILY_NUTRITION_BUDGET,
        protein: 'high',
      },
    );

    expect(result.protein.tone).toBe('danger');
    expect(result.protein.text).toContain('sotto budget');
  });
});
