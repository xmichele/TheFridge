import { describe, expect, it } from 'vitest';

import {
  buildOriginalRecipeSuggestions,
  buildOriginalRecipeSupportMetadata,
  getOriginalRecipeSearchProfiles,
} from '@/domain/support';
import type { PantryItem } from '@/domain/models';

describe('buildOriginalRecipeSuggestions', () => {
  it('prioritizes support recipes that match the pantry', () => {
    const pantryItems: PantryItem[] = [
      {
        id: 'pantry-1',
        displayName: 'Pasta secca',
        normalizedName: 'pasta secca',
        quantity: 500,
        unit: 'g',
        createdAt: '2026-03-18T12:00:00.000Z',
        updatedAt: '2026-03-18T12:00:00.000Z',
      },
      {
        id: 'pantry-2',
        displayName: 'Pomodoro',
        normalizedName: 'pomodoro',
        quantity: 4,
        unit: 'pcs',
        createdAt: '2026-03-18T12:00:00.000Z',
        updatedAt: '2026-03-18T12:00:00.000Z',
      },
    ];

    const suggestions = buildOriginalRecipeSuggestions(
      [
        {
          id: 'originale-1',
          title: 'Pasta al pomodoro',
          category: 'Primo',
          primaryIngredient: 'Pasta secca',
          primaryIngredientNormalized: 'pasta secca',
          servingsText: '4',
          ingredientPreview: [
            { displayName: 'Pasta secca', normalizedName: 'pasta secca', quantityText: '500 g', isSectionLabel: false },
            { displayName: 'Pomodoro', normalizedName: 'pomodoro', quantityText: '4', isSectionLabel: false },
            { displayName: 'Basilico', normalizedName: 'basilico', quantityText: '', isSectionLabel: false },
          ],
          instructionPreview: 'Cuoci e condisci.',
          originPlaces: [],
          detailChunk: 'primo',
        },
        {
          id: 'originale-2',
          title: 'Pollo arrosto',
          category: 'Carne',
          primaryIngredient: 'Pollo',
          primaryIngredientNormalized: 'pollo',
          servingsText: '4',
          ingredientPreview: [
            { displayName: 'Pollo', normalizedName: 'pollo', quantityText: '1 kg', isSectionLabel: false },
            { displayName: 'Patate', normalizedName: 'patate', quantityText: '500 g', isSectionLabel: false },
          ],
          instructionPreview: 'Inforna.',
          originPlaces: [],
          detailChunk: 'carne',
        },
      ],
      pantryItems,
      3,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].entry.title).toBe('Pasta al pomodoro');
    expect(suggestions[0].matchedIngredients).toEqual(['Pasta secca', 'Pomodoro']);
  });
});

describe('getOriginalRecipeSearchProfiles', () => {
  it('classifies common archive recipes into dietary search profiles', () => {
    const fishRecipe = {
      id: 'originale-fish',
      title: 'Acciughe al limone',
      category: 'Antipasto',
      primaryIngredient: 'Acciughe',
      primaryIngredientNormalized: 'acciughe',
      servingsText: '4',
      ingredientPreview: [
        { displayName: 'Acciughe', normalizedName: 'acciughe', quantityText: '500 g', isSectionLabel: false },
        { displayName: 'Succo di limone', normalizedName: 'succo di limone', quantityText: '', isSectionLabel: false },
      ],
      instructionPreview: 'Marina e servi.',
      originPlaces: [],
      detailChunk: 'antipasto',
    };

    const profiles = getOriginalRecipeSearchProfiles(fishRecipe);

    expect(profiles).toContain('fish');
    expect(profiles).toContain('appetizer');
    expect(profiles).not.toContain('vegetarian');
    expect(profiles).toContain('gluten-free');
    expect(profiles).toContain('lactose-free');
  });

  it('adds pasta and pizza as dedicated archive profiles', () => {
    const pastaRecipe = {
      id: 'originale-pasta',
      title: 'Spaghetti aglio e olio',
      category: 'Primo',
      primaryIngredient: 'Spaghetti',
      primaryIngredientNormalized: 'spaghetti',
      servingsText: '4',
      ingredientPreview: [
        { displayName: 'Spaghetti', normalizedName: 'spaghetti', quantityText: '320 g', isSectionLabel: false },
        { displayName: 'Aglio', normalizedName: 'aglio', quantityText: '2 spicchi', isSectionLabel: false },
      ],
      instructionPreview: 'Cuoci e condisci.',
      originPlaces: [],
      detailChunk: 'primo',
    };

    const pizzaRecipe = {
      id: 'originale-pizza',
      title: 'Pizza margherita',
      category: 'Piatto unico',
      primaryIngredient: 'Impasto per pizza',
      primaryIngredientNormalized: 'impasto per pizza',
      servingsText: '2',
      ingredientPreview: [
        { displayName: 'Farina', normalizedName: 'farina', quantityText: '500 g', isSectionLabel: false },
        { displayName: 'Mozzarella', normalizedName: 'mozzarella', quantityText: '250 g', isSectionLabel: false },
      ],
      instructionPreview: 'Stendi e inforna.',
      originPlaces: [],
      detailChunk: 'primo',
    };

    expect(getOriginalRecipeSearchProfiles(pastaRecipe)).toContain('pasta');
    expect(getOriginalRecipeSearchProfiles(pastaRecipe)).toContain('primo');
    expect(getOriginalRecipeSearchProfiles(pizzaRecipe)).toContain('pizza');
  });

  it('shows archive nutrition labels for meat, fish and coherent primi', () => {
    const fishRecipe = {
      id: 'originale-fish-metadata',
      title: 'Acciughe marinate',
      category: 'Pesce',
      primaryIngredient: 'Acciughe',
      primaryIngredientNormalized: 'acciughe',
      servingsText: '4',
      ingredientPreview: [
        { displayName: 'Acciughe', normalizedName: 'acciughe', quantityText: '600 g', isSectionLabel: false },
        { displayName: 'Limone', normalizedName: 'limone', quantityText: '1 pz', isSectionLabel: false },
      ],
      instructionPreview: 'Marina e servi.',
      originPlaces: [],
      detailChunk: 'pesce',
    };

    const primoRecipe = {
      id: 'originale-primo-metadata',
      title: 'Spaghetti al pomodoro',
      category: 'Primo',
      primaryIngredient: 'Spaghetti',
      primaryIngredientNormalized: 'spaghetti',
      servingsText: '4',
      ingredientPreview: [
        { displayName: 'Spaghetti', normalizedName: 'spaghetti', quantityText: '320 g', isSectionLabel: false },
        { displayName: 'Pomodoro', normalizedName: 'pomodoro', quantityText: '300 g', isSectionLabel: false },
      ],
      instructionPreview: 'Cuoci e condisci.',
      originPlaces: [],
      detailChunk: 'primo',
    };

    expect(buildOriginalRecipeSupportMetadata(fishRecipe).nutritionSignals).not.toBeNull();
    expect(buildOriginalRecipeSupportMetadata(primoRecipe).nutritionSignals).not.toBeNull();
  });

  it('uses a clearly identified primary ingredient even outside the recent category guardrails', () => {
    const recipe = {
      id: 'originale-explicit-primary',
      title: 'Tonno agli agrumi',
      category: 'Antipasto',
      primaryIngredient: 'Tonno',
      primaryIngredientNormalized: 'tonno',
      servingsText: '4',
      ingredientPreview: [
        { displayName: 'Tonno', normalizedName: 'tonno', quantityText: '300 g', isSectionLabel: false },
        { displayName: 'Limone', normalizedName: 'limone', quantityText: '1 pz', isSectionLabel: false },
      ],
      instructionPreview: 'Servi freddo.',
      originPlaces: [],
      detailChunk: 'antipasto',
    };

    expect(buildOriginalRecipeSupportMetadata(recipe).nutritionSignals).not.toBeNull();
  });
});
