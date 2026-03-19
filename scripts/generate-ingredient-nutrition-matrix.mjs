import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import ingredientNutritionSeedData from '../src/data/ingredientNutritionSeedData.json' with { type: 'json' };

const sourcePath = path.resolve('old/data/RicetteOriginal.txt');
const normalizedMatrixPath = path.resolve('docs/ingredient-nutrition-matrix.csv');
const variantsMatrixPath = path.resolve('docs/ingredient-nutrition-variants.csv');
const summaryPath = path.resolve('docs/ingredient-nutrition-matrix-summary.md');
const publicNormalizedMatrixPath = path.resolve('public/support/ingredient-nutrition-matrix.csv');
const publicVariantsMatrixPath = path.resolve('public/support/ingredient-nutrition-variants.csv');
const publicSummaryPath = path.resolve('public/support/ingredient-nutrition-matrix-summary.md');
const detachablePrefixes = [
  'succo di ',
  'scorza di ',
  'foglie di ',
  'foglia di ',
  'spicchi di ',
  'spicchio di ',
  'rametti di ',
  'rametto di ',
  'gambi di ',
  'gambo di ',
  'fette di ',
  'fetta di ',
  'ciuffi di ',
  'ciuffo di ',
  'mazzetto di ',
  'mazzetti di ',
];

function normalizeIngredientName(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return value
    .replace(/\u000e/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeWord(word) {
  const variants = new Set([word]);

  if (word.endsWith('ie') && word.length > 3) {
    variants.add(`${word.slice(0, -2)}ia`);
  }

  if (word.endsWith('i') && word.length > 2) {
    variants.add(`${word.slice(0, -1)}o`);
    variants.add(`${word.slice(0, -1)}a`);
    variants.add(`${word.slice(0, -1)}e`);
  }

  if (word.endsWith('e') && word.length > 2) {
    variants.add(`${word.slice(0, -1)}a`);
    variants.add(`${word.slice(0, -1)}o`);
  }

  return [...variants].filter(Boolean);
}

function buildIngredientMatchCandidates(rawValue) {
  const normalized = normalizeIngredientName(rawValue);
  const candidates = new Set();

  function addCandidate(value) {
    const cleaned = normalizeIngredientName(value);
    if (cleaned) {
      candidates.add(cleaned);
    }
  }

  addCandidate(normalized);

  for (const prefix of detachablePrefixes) {
    if (normalized.startsWith(prefix)) {
      addCandidate(normalized.slice(prefix.length));
    }
  }

  for (const candidate of [...candidates]) {
    const parts = candidate.split(' ');
    const lastWord = parts.at(-1);
    if (!lastWord) {
      continue;
    }

    for (const singularized of singularizeWord(lastWord)) {
      addCandidate([...parts.slice(0, -1), singularized].join(' '));
    }
  }

  return [...candidates];
}

function parseQuotedFields(line) {
  return [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function classifyIngredient(displayName) {
  const normalized = normalizeIngredientName(displayName);
  if (!normalized) {
    return 'empty';
  }

  if (displayName.endsWith(':') || /^(per|per la|per il|per i|per le)\b/i.test(displayName)) {
    return 'section-label';
  }

  return 'ingredient';
}

function parseIngredientEntries(rawValue) {
  return rawValue
    .split(/\\r\\n|\r\n/)
    .map((line) => {
      const cleaned = cleanText(line);
      if (!cleaned) {
        return null;
      }

      const [rawQuantity, rawName] = cleaned.includes('====') ? cleaned.split('====') : ['', cleaned];
      const displayName = cleanText(rawName);
      const quantityText = cleanText(rawQuantity);
      const normalizedName = normalizeIngredientName(displayName);

      if (!displayName || !normalizedName) {
        return null;
      }

      return {
        displayName,
        normalizedName,
        quantityText,
        kind: classifyIngredient(displayName),
      };
    })
    .filter(Boolean);
}

const nutritionEntries = ingredientNutritionSeedData.map((entry) => ({
  ...entry,
  normalizedName: normalizeIngredientName(entry.displayName),
  normalizedAliases: (entry.aliases ?? []).map(normalizeIngredientName),
}));

const nutritionIndex = new Map();
for (const entry of nutritionEntries) {
  for (const candidate of buildIngredientMatchCandidates(entry.normalizedName)) {
    nutritionIndex.set(candidate, { entry, matchType: 'exact', matchedAlias: '' });
  }
  for (const alias of entry.normalizedAliases) {
    for (const candidate of buildIngredientMatchCandidates(alias)) {
      nutritionIndex.set(candidate, { entry, matchType: 'alias', matchedAlias: alias });
    }
  }
}

const text = new TextDecoder('windows-1252').decode(fs.readFileSync(sourcePath));
const normalizedMatrix = new Map();
const variantsMatrix = new Map();

for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) {
    continue;
  }

  const [rawTitle, rawCategory, rawPrimaryIngredient, rawServings, rawNotes, rawIngredients] = parseQuotedFields(line);
  const title = cleanText(rawTitle);
  const category = cleanText(rawCategory);
  const primaryIngredient = cleanText(rawPrimaryIngredient);
  const servingsText = cleanText(rawServings);
  const note = rawNotes && rawNotes !== '-' ? cleanText(rawNotes) : '';

  if (!title || !rawIngredients) {
    continue;
  }

  for (const ingredient of parseIngredientEntries(rawIngredients)) {
    const reference =
      buildIngredientMatchCandidates(ingredient.normalizedName)
        .map((candidate) => nutritionIndex.get(candidate))
        .find(Boolean) ?? null;
    const normalizedRow = normalizedMatrix.get(ingredient.normalizedName) ?? {
      normalizedName: ingredient.normalizedName,
      displayNames: new Map(),
      quantityTexts: new Map(),
      recipeTitles: new Set(),
      categories: new Set(),
      occurrenceCount: 0,
      kindCounts: new Map(),
      primaryIngredientHits: 0,
      servingsExamples: new Set(),
      notesExamples: new Set(),
      nutritionMatchStatus: reference ? reference.matchType : ingredient.kind === 'section-label' ? 'section-label' : 'unmatched',
      nutritionReferenceName: reference?.entry.displayName ?? '',
      nutritionMatchedAlias: reference?.matchType === 'alias' ? reference.matchedAlias : '',
      nutritionSource: reference ? 'local-seed' : '',
      caloriesPer100g: reference?.entry.caloriesPer100g ?? '',
      proteinPer100g: reference?.entry.proteinPer100g ?? '',
      fatPer100g: reference?.entry.fatPer100g ?? '',
      carbsPer100g: reference?.entry.carbsPer100g ?? '',
    };

    normalizedRow.occurrenceCount += 1;
    normalizedRow.recipeTitles.add(title);
    if (category) {
      normalizedRow.categories.add(category);
    }
    if (note && normalizedRow.notesExamples.size < 3) {
      normalizedRow.notesExamples.add(note);
    }
    if (servingsText && normalizedRow.servingsExamples.size < 3) {
      normalizedRow.servingsExamples.add(servingsText);
    }
    if (primaryIngredient && ingredient.normalizedName === normalizeIngredientName(primaryIngredient)) {
      normalizedRow.primaryIngredientHits += 1;
    }
    normalizedRow.displayNames.set(
      ingredient.displayName,
      (normalizedRow.displayNames.get(ingredient.displayName) ?? 0) + 1,
    );
    if (ingredient.quantityText) {
      normalizedRow.quantityTexts.set(
        ingredient.quantityText,
        (normalizedRow.quantityTexts.get(ingredient.quantityText) ?? 0) + 1,
      );
    }
    normalizedRow.kindCounts.set(ingredient.kind, (normalizedRow.kindCounts.get(ingredient.kind) ?? 0) + 1);
    normalizedMatrix.set(ingredient.normalizedName, normalizedRow);

    const variantKey = `${ingredient.normalizedName}||${ingredient.displayName}`;
    const variantRow = variantsMatrix.get(variantKey) ?? {
      displayName: ingredient.displayName,
      normalizedName: ingredient.normalizedName,
      occurrenceCount: 0,
      recipeTitles: new Set(),
      kind: ingredient.kind,
      quantityTexts: new Map(),
      nutritionMatchStatus: reference ? reference.matchType : ingredient.kind === 'section-label' ? 'section-label' : 'unmatched',
      nutritionReferenceName: reference?.entry.displayName ?? '',
      nutritionMatchedAlias: reference?.matchType === 'alias' ? reference.matchedAlias : '',
    };

    variantRow.occurrenceCount += 1;
    variantRow.recipeTitles.add(title);
    if (ingredient.quantityText) {
      variantRow.quantityTexts.set(ingredient.quantityText, (variantRow.quantityTexts.get(ingredient.quantityText) ?? 0) + 1);
    }
    variantsMatrix.set(variantKey, variantRow);
  }
}

const normalizedRows = [...normalizedMatrix.values()]
  .map((row) => {
    const dominantKind =
      [...row.kindCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'ingredient';
    const topDisplayNames = [...row.displayNames.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([value, count]) => `${value} (${count})`)
      .join(' | ');
    const topQuantities = [...row.quantityTexts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([value, count]) => `${value} (${count})`)
      .join(' | ');
    const recipeTitles = [...row.recipeTitles].sort((left, right) => left.localeCompare(right, 'it'));
    const categories = [...row.categories].sort((left, right) => left.localeCompare(right, 'it'));

    return {
      normalizedName: row.normalizedName,
      displayNameVariants: topDisplayNames,
      variantCount: row.displayNames.size,
      occurrenceCount: row.occurrenceCount,
      recipeCount: row.recipeTitles.size,
      dominantKind,
      nutritionMatchStatus: row.nutritionMatchStatus,
      nutritionReferenceName: row.nutritionReferenceName,
      nutritionMatchedAlias: row.nutritionMatchedAlias,
      nutritionSource: row.nutritionSource,
      caloriesPer100g: row.caloriesPer100g,
      proteinPer100g: row.proteinPer100g,
      fatPer100g: row.fatPer100g,
      carbsPer100g: row.carbsPer100g,
      primaryIngredientHits: row.primaryIngredientHits,
      quantityExamples: topQuantities,
      categoryExamples: categories.slice(0, 5).join(' | '),
      recipeExamples: recipeTitles.slice(0, 5).join(' | '),
      noteExamples: [...row.notesExamples].join(' | '),
    };
  })
  .sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    return left.normalizedName.localeCompare(right.normalizedName, 'it');
  });

const variantRows = [...variantsMatrix.values()]
  .map((row) => ({
    displayName: row.displayName,
    normalizedName: row.normalizedName,
    occurrenceCount: row.occurrenceCount,
    recipeCount: row.recipeTitles.size,
    kind: row.kind,
    nutritionMatchStatus: row.nutritionMatchStatus,
    nutritionReferenceName: row.nutritionReferenceName,
    nutritionMatchedAlias: row.nutritionMatchedAlias,
    quantityExamples: [...row.quantityTexts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([value, count]) => `${value} (${count})`)
      .join(' | '),
    recipeExamples: [...row.recipeTitles]
      .sort((left, right) => left.localeCompare(right, 'it'))
      .slice(0, 5)
      .join(' | '),
  }))
  .sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    return left.displayName.localeCompare(right.displayName, 'it');
  });

const summaryCounts = normalizedRows.reduce(
  (accumulator, row) => {
    accumulator.total += 1;
    accumulator[row.nutritionMatchStatus] = (accumulator[row.nutritionMatchStatus] ?? 0) + 1;
    return accumulator;
  },
  { total: 0 },
);

const unmatchedTop = normalizedRows
  .filter((row) => row.nutritionMatchStatus === 'unmatched')
  .slice(0, 25)
  .map((row) => `- ${row.normalizedName} (${row.occurrenceCount})`)
  .join('\n');

const aliasTop = normalizedRows
  .filter((row) => row.nutritionMatchStatus === 'alias')
  .slice(0, 25)
  .map((row) => `- ${row.normalizedName} -> ${row.nutritionReferenceName} (${row.occurrenceCount})`)
  .join('\n');

const exactTop = normalizedRows
  .filter((row) => row.nutritionMatchStatus === 'exact')
  .slice(0, 25)
  .map((row) => `- ${row.normalizedName} (${row.occurrenceCount})`)
  .join('\n');

const normalizedCsv = toCsv([
  [
    'normalized_name',
    'display_name_variants',
    'variant_count',
    'occurrence_count',
    'recipe_count',
    'dominant_kind',
    'nutrition_match_status',
    'nutrition_reference_name',
    'nutrition_matched_alias',
    'nutrition_source',
    'calories_per_100g',
    'protein_per_100g',
    'fat_per_100g',
    'carbs_per_100g',
    'primary_ingredient_hits',
    'quantity_examples',
    'category_examples',
    'recipe_examples',
    'note_examples',
  ],
  ...normalizedRows.map((row) => [
    row.normalizedName,
    row.displayNameVariants,
    row.variantCount,
    row.occurrenceCount,
    row.recipeCount,
    row.dominantKind,
    row.nutritionMatchStatus,
    row.nutritionReferenceName,
    row.nutritionMatchedAlias,
    row.nutritionSource,
    row.caloriesPer100g,
    row.proteinPer100g,
    row.fatPer100g,
    row.carbsPer100g,
    row.primaryIngredientHits,
    row.quantityExamples,
    row.categoryExamples,
    row.recipeExamples,
    row.noteExamples,
  ]),
]);

const variantsCsv = toCsv([
  [
    'display_name',
    'normalized_name',
    'occurrence_count',
    'recipe_count',
    'kind',
    'nutrition_match_status',
    'nutrition_reference_name',
    'nutrition_matched_alias',
    'quantity_examples',
    'recipe_examples',
  ],
  ...variantRows.map((row) => [
    row.displayName,
    row.normalizedName,
    row.occurrenceCount,
    row.recipeCount,
    row.kind,
    row.nutritionMatchStatus,
    row.nutritionReferenceName,
    row.nutritionMatchedAlias,
    row.quantityExamples,
    row.recipeExamples,
  ]),
]);

const summary = `# Ingredient Nutrition Matrix Summary

Source file: \`old/data/RicetteOriginal.txt\`

- Unique normalized entries: ${summaryCounts.total}
- Exact nutrition matches: ${summaryCounts.exact ?? 0}
- Alias nutrition matches: ${summaryCounts.alias ?? 0}
- Unmatched entries: ${summaryCounts.unmatched ?? 0}
- Section labels / non-ingredients: ${summaryCounts['section-label'] ?? 0}

## Top Exact Matches
${exactTop || '- none'}

## Top Alias Matches
${aliasTop || '- none'}

## Top Unmatched Entries
${unmatchedTop || '- none'}
`;

fs.writeFileSync(normalizedMatrixPath, normalizedCsv);
fs.writeFileSync(variantsMatrixPath, variantsCsv);
fs.writeFileSync(summaryPath, summary);
fs.writeFileSync(publicNormalizedMatrixPath, normalizedCsv);
fs.writeFileSync(publicVariantsMatrixPath, variantsCsv);
fs.writeFileSync(publicSummaryPath, summary);

console.log(`Generated ${normalizedRows.length} normalized rows in ${path.relative(process.cwd(), normalizedMatrixPath)}`);
console.log(`Generated ${variantRows.length} variant rows in ${path.relative(process.cwd(), variantsMatrixPath)}`);
console.log(`Generated summary in ${path.relative(process.cwd(), summaryPath)}`);
