import { describe, expect, it } from 'vitest';

import {
  decodeOriginalRecipeSupportDatasetResponse,
  decodeOriginalRecipeSupportDetailChunkResponse,
  decodeOriginalRecipeSupportLookupResponse,
  getOriginalRecipeSupportAssetUrl,
} from '@/data/services/originalRecipeSupportService';

describe('originalRecipeSupportService decoders', () => {
  it('decodes compact support datasets without changing entry shape', () => {
    const dataset = decodeOriginalRecipeSupportDatasetResponse({
      generatedAt: '2026-03-19T12:00:00.000Z',
      sourceFile: 'old/data/RicetteOriginal.txt',
      sourceRecordCount: 27000,
      entryCount: 1,
      entries: [
        [
          'originale-1',
          'Acciughe al limone',
          'Pesce',
          'Acciughe',
          'acciughe',
          '4',
          'Nota breve',
          [['Acciughe', 'acciughe', '500 g', false]],
          'Marina e servi.',
          ['Sicilia'],
          20,
          0,
          'pesce',
        ],
      ],
    });

    expect(dataset.entries).toEqual([
      {
        id: 'originale-1',
        title: 'Acciughe al limone',
        category: 'Pesce',
        primaryIngredient: 'Acciughe',
        primaryIngredientNormalized: 'acciughe',
        servingsText: '4',
        notePreview: 'Nota breve',
        ingredientPreview: [
          {
            displayName: 'Acciughe',
            normalizedName: 'acciughe',
            quantityText: '500 g',
            isSectionLabel: false,
          },
        ],
        instructionPreview: 'Marina e servi.',
        originPlaces: ['Sicilia'],
        preparationMinutes: 20,
        cookMinutes: 0,
        detailChunk: 'pesce',
      },
    ]);
  });

  it('decodes compact detail chunks without losing ingredient lines', () => {
    const detailChunk = decodeOriginalRecipeSupportDetailChunkResponse({
      entryCount: 1,
      entries: [
        [
          'originale-7',
          'Agnolotti di zucca',
          'Primo',
          'Farina',
          'farina',
          '4',
          'Nota',
          [
            ['Farina', 'farina', '400 g', false],
            ['Per il ripieno:', 'per il ripieno', '', true],
          ],
          'Impasta e cuoci.',
          'Impasta e cuoci.',
          ['Piemonte'],
          30,
          10,
          'primo',
        ],
      ],
    });

    expect(detailChunk.entries[0]?.ingredients[1]).toEqual({
      displayName: 'Per il ripieno:',
      normalizedName: 'per il ripieno',
      quantityText: '',
      isSectionLabel: true,
    });
  });

  it('decodes lookup entries used by planner and detail page', () => {
    const lookup = decodeOriginalRecipeSupportLookupResponse({
      generatedAt: '2026-03-19T12:00:00.000Z',
      entryCount: 1,
      entries: [['originale-9', 'Spaghetti al pomodoro', 'primo', '4']],
    });

    expect(lookup.entries[0]).toEqual({
      id: 'originale-9',
      title: 'Spaghetti al pomodoro',
      detailChunk: 'primo',
      servingsText: '4',
    });
  });

  it('builds support asset URLs from the configured base path', () => {
    expect(getOriginalRecipeSupportAssetUrl('support/original-recipes-support.json')).toBe(
      `${import.meta.env.BASE_URL}support/original-recipes-support.json`,
    );
  });
});
