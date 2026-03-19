import { describe, expect, it } from 'vitest';

import type { Recipe } from '@/domain/models';
import { analyzeRecipeNutrition, estimateNutritionSignalsFromIngredientNames } from '@/domain/nutrition';

const recipe: Recipe = {
  id: 'recipe-nutrition',
  title: 'Pasta semplice',
  servings: 2,
  ingredients: [
    {
      id: 'ing-1',
      displayName: 'Pasta secca',
      normalizedName: 'pasta secca',
      quantity: 200,
      unit: 'g',
    },
    {
      id: 'ing-2',
      displayName: 'Olio extravergine',
      normalizedName: 'olio extravergine',
      quantity: 1,
      unit: 'tbsp',
    },
  ],
  steps: ['Cuoci e condisci'],
  createdAt: '2026-03-19T10:00:00.000Z',
  updatedAt: '2026-03-19T10:00:00.000Z',
};

describe('analyzeRecipeNutrition', () => {
  it('calculates recipe totals and per-serving macros from local ingredient references', () => {
    const analysis = analyzeRecipeNutrition(recipe, 2);

    expect(analysis.unmatchedIngredients).toHaveLength(0);
    expect(analysis.matchedIngredients).toHaveLength(2);
    expect(analysis.total.calories).toBeCloseTo(825.34, 2);
    expect(analysis.total.protein).toBeCloseTo(25, 2);
    expect(analysis.total.fat).toBeCloseTo(16.5, 2);
    expect(analysis.total.carbs).toBeCloseTo(144.4, 2);
    expect(analysis.perServing.calories).toBeCloseTo(412.67, 2);
    expect(analysis.per100g?.calories).toBeCloseTo(386.58, 2);
    expect(analysis.preferredBasis).toBe('per-100g');
    expect(analysis.baseIngredients).toHaveLength(2);
    expect(analysis.editorialLabels.some((item) => item.label === 'carbo importante')).toBe(true);
    expect(analysis.metricSources.carbs?.referenceName).toBe('Pasta secca');
    expect(analysis.metricSources.fat?.referenceName).toBe('Olio extravergine');
  });

  it('matches flexible citrus variants to the same ingredient reference', () => {
    const citrusRecipe: Recipe = {
      ...recipe,
      id: 'recipe-citrus',
      title: 'Agrumi',
      ingredients: [
        {
          id: 'ing-lime-1',
          displayName: 'Succo di limone',
          normalizedName: 'succo di limone',
          quantity: 100,
          unit: 'ml',
        },
        {
          id: 'ing-lime-2',
          displayName: 'Limoni',
          normalizedName: 'limoni',
          quantity: 1,
          unit: 'pcs',
        },
      ],
    };

    const analysis = analyzeRecipeNutrition(citrusRecipe, 2);

    expect(analysis.unmatchedIngredients).toHaveLength(0);
    expect(analysis.matchedIngredients).toHaveLength(2);
    expect(analysis.matchedIngredients.every((match) => match.reference.displayName === 'Limone')).toBe(true);
    expect(analysis.baseIngredients).toHaveLength(1);
    expect(analysis.per100g).toBeDefined();
    expect(analysis.stickers).toContain('ricca di vitamine');
  });

  it('weights primary fish ingredients more than condiments in qualitative archive signals', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Tonno', normalizedName: 'tonno' },
        { displayName: 'Burro', normalizedName: 'burro' },
        { displayName: 'Sale', normalizedName: 'sale' },
      ],
      { primaryIngredientName: 'Tonno', requiredCategory: 'fish' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.qualitativeLabels.fat.tone).not.toBe('danger');
    expect(signals?.qualitativeLabels.protein.label).toBe('medio');
  });

  it('does not mark protein as low or scarce when the main ingredient is meat or fish', () => {
    const fishSignals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Tonno', normalizedName: 'tonno' },
        { displayName: 'Limone', normalizedName: 'limone' },
        { displayName: 'Sale', normalizedName: 'sale' },
      ],
      { primaryIngredientName: 'Tonno', requiredCategory: 'fish' },
    );

    const meatSignals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Pollo', normalizedName: 'pollo' },
        { displayName: 'Limone', normalizedName: 'limone' },
      ],
      { primaryIngredientName: 'Pollo', requiredCategory: 'meat' },
    );

    expect(fishSignals).not.toBeNull();
    expect(fishSignals?.qualitativeLabels.protein.label).toBe('medio');
    expect(meatSignals).not.toBeNull();
    expect(meatSignals?.qualitativeLabels.protein.label).toBe('medio');
  });

  it('exposes a badge source ingredient for archive estimates', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Tonno', normalizedName: 'tonno' },
        { displayName: 'Olio extravergine', normalizedName: 'olio extravergine' },
      ],
      { primaryIngredientName: 'Tonno', requiredCategory: 'fish' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.protein?.role).toBe('primary');
    expect(signals?.metricSources.protein?.referenceName).toBe('Tonno');
    expect(signals?.metricSources.fat?.referenceName).toBe('Tonno');
  });

  it('keeps the green primary ingredient as badge guide when it is recognized', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Acciughe', normalizedName: 'acciughe' },
        { displayName: 'Limone', normalizedName: 'limone' },
        { displayName: 'Olive', normalizedName: 'olive' },
      ],
      { primaryIngredientName: 'Acciughe', requiredCategory: 'fish' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.calories?.referenceName).toBe('Acciughe fresche');
    expect(signals?.metricSources.protein?.referenceName).toBe('Acciughe fresche');
    expect(signals?.metricSources.fat?.role).toBe('primary');
  });

  it('falls back to the first original ingredient when the main ingredient is missing', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Acciughe', normalizedName: 'acciughe' },
        { displayName: 'Aceto', normalizedName: 'aceto' },
        { displayName: 'Porri', normalizedName: 'porri' },
      ],
      { requiredCategory: 'fish' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.calories?.referenceName).toBe('Acciughe fresche');
    expect(signals?.metricSources.carbs?.referenceName).toBe('Acciughe fresche');
    expect(signals?.metricSources.fat?.referenceName).toBe('Acciughe fresche');
  });

  it('matches broad primary ingredient families like agnello from more specific cuts', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        {
          displayName: "Polpa di agnello",
          normalizedName: "polpa di agnello",
          quantityText: "800 g",
        },
        {
          displayName: "Limone",
          normalizedName: "limone",
          quantityText: "1 pz",
        },
      ],
      { primaryIngredientName: "Spalla d'agnello disossata arrotolata", requiredCategory: 'meat' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.calories?.referenceName).toBe('Agnello');
    expect(signals?.metricSources.protein?.referenceName).toBe('Agnello');
  });

  it('hides archive nutrition signals when only condiments or q.b. ingredients are recognized', () => {
    const signals = estimateNutritionSignalsFromIngredientNames([
      {
        displayName: "Olio extravergine",
        normalizedName: "olio extravergine",
        quantityText: "q.b.",
      },
      {
        displayName: "Sale",
        normalizedName: "sale",
        quantityText: "q.b.",
      },
    ], { requiredCategory: 'fish' });

    expect(signals).toBeNull();
  });

  it('does not expose archive nutrition labels outside the guarded categories when no explicit primary is resolved', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Pasta secca', normalizedName: 'pasta secca', quantityText: '320 g' },
        { displayName: 'Pomodoro', normalizedName: 'pomodoro', quantityText: '300 g' },
      ],
      {},
    );

    expect(signals).toBeNull();
  });

  it('uses the explicit primary ingredient for primi when it is clearly resolved', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Farina', normalizedName: 'farina', quantityText: '400 g' },
        { displayName: 'Uova', normalizedName: 'uova', quantityText: '4' },
        { displayName: 'Zucca', normalizedName: 'zucca', quantityText: '500 g' },
      ],
      { primaryIngredientName: 'Zucca', requiredCategory: 'primo' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.calories?.referenceName).toBe('Zucca');
    expect(signals?.metricSources.carbs?.referenceName).toBe('Zucca');
  });

  it('falls back to cereal or dough bases for primi when the explicit primary is not resolved', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Farina', normalizedName: 'farina', quantityText: '400 g' },
        { displayName: 'Uova', normalizedName: 'uova', quantityText: '4' },
        { displayName: 'Zucca', normalizedName: 'zucca', quantityText: '500 g' },
      ],
      { primaryIngredientName: 'Ripieno speciale', requiredCategory: 'primo' },
    );

    expect(signals).not.toBeNull();
    expect(signals?.metricSources.calories?.referenceName).toBe('Farina 00');
    expect(signals?.metricSources.carbs?.referenceName).toBe('Farina 00');
  });

  it('still hides archive nutrition labels for categories outside fish meat and primi', () => {
    const signals = estimateNutritionSignalsFromIngredientNames(
      [
        { displayName: 'Aceto di vino', normalizedName: 'aceto di vino', quantityText: '50 cl' },
        { displayName: 'Basilico', normalizedName: 'basilico', quantityText: '' },
      ],
      {},
    );

    expect(signals).toBeNull();
  });

  it('tracks the ingredient responsible for fibre and vitamin stickers', () => {
    const analysis = analyzeRecipeNutrition(
      {
        ...recipe,
        id: 'recipe-stickers',
        ingredients: [
          {
            id: 'ing-apple',
            displayName: 'Mela',
            normalizedName: 'mela',
            quantity: 300,
            unit: 'g',
          },
          {
            id: 'ing-carrot',
            displayName: 'Carote',
            normalizedName: 'carote',
            quantity: 200,
            unit: 'g',
          },
        ],
      },
      2,
    );

    expect(analysis.stickers).toContain('ricca di fibre');
    expect(analysis.stickers).toContain('ricca di vitamine');
    expect(analysis.stickerSources['ricca di fibre']?.referenceName).toBeTruthy();
    expect(analysis.stickerSources['ricca di vitamine']?.referenceName).toBeTruthy();
  });
});
