import type { PantryItem } from '@/domain/models';
import {
  estimateNutritionSignalsFromIngredientNames,
  resolveNutritionReferenceByName,
  type NutritionMetricKey,
  type NutritionSignals,
} from '@/domain/nutrition';

export interface OriginalRecipeIngredientLine {
  displayName: string;
  normalizedName: string;
  quantityText: string;
  isSectionLabel: boolean;
}

export interface OriginalRecipeSupportEntry {
  id: string;
  title: string;
  category: string;
  primaryIngredient: string;
  primaryIngredientNormalized: string;
  servingsText: string;
  notePreview?: string;
  ingredientPreview: OriginalRecipeIngredientLine[];
  instructionPreview: string;
  originPlaces: string[];
  preparationMinutes?: number;
  cookMinutes?: number;
  detailChunk: string;
}

export interface OriginalRecipeSupportDetailEntry extends OriginalRecipeSupportEntry {
  note?: string;
  ingredients: OriginalRecipeIngredientLine[];
  instructionText: string;
}

export interface OriginalRecipeSupportDataset {
  generatedAt: string;
  sourceFile: string;
  sourceRecordCount?: number;
  entryCount: number;
  entries: OriginalRecipeSupportEntry[];
}

export interface OriginalRecipeSuggestion {
  entry: OriginalRecipeSupportEntry;
  matchedIngredients: string[];
  missingIngredients: string[];
  score: number;
}

export interface OriginalRecipeSupportMetadata {
  preparationMinutes?: number;
  cookMinutes?: number;
  originPlaces: string[];
  nutritionSignals: NutritionSignals | null;
  searchProfiles: OriginalRecipeSearchProfile[];
}

export interface VisibleNutritionMetricBadge {
  key: NutritionMetricKey;
  metricLabel: string;
  qualitativeLabel: NutritionSignals['qualitativeLabels'][NutritionMetricKey];
  value?: number;
  unit: 'kcal' | 'g';
}

export type OriginalRecipeSearchProfile =
  | 'main-dish'
  | 'meat'
  | 'fish'
  | 'primo'
  | 'pasta'
  | 'pizza'
  | 'appetizer'
  | 'soup'
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'lactose-free';

export function buildOriginalRecipeSuggestions(
  entries: OriginalRecipeSupportEntry[],
  pantryItems: PantryItem[],
  limit = 6,
): OriginalRecipeSuggestion[] {
  const pantryNames = new Set(pantryItems.map((item) => item.normalizedName));

  return entries
    .map((entry) => {
      const matchedIngredients = entry.ingredientPreview
        .filter((ingredient) => !ingredient.isSectionLabel && pantryNames.has(ingredient.normalizedName))
        .map((ingredient) => ingredient.displayName);
      const missingIngredients = entry.ingredientPreview
        .filter(
          (ingredient) => !ingredient.isSectionLabel && !pantryNames.has(ingredient.normalizedName),
        )
        .map((ingredient) => ingredient.displayName);
      const primaryMatch = pantryNames.has(entry.primaryIngredientNormalized);
      const score = (primaryMatch ? 4 : 0) + matchedIngredients.length * 2 - missingIngredients.length * 0.15;

      return {
        entry,
        matchedIngredients,
        missingIngredients: missingIngredients.slice(0, 4),
        score,
      };
    })
    .filter((suggestion) => suggestion.matchedIngredients.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.matchedIngredients.length !== left.matchedIngredients.length) {
        return right.matchedIngredients.length - left.matchedIngredients.length;
      }

      return left.entry.title.localeCompare(right.entry.title, 'it');
    })
    .slice(0, limit);
}

function extractMinutes(note: string | undefined, label: string): number | undefined {
  if (!note) {
    return undefined;
  }

  const match = note.match(new RegExp(`${label}:\\s*(\\d+)\\s*minuti`, 'i'));
  return match ? Number(match[1]) : undefined;
}

function extractOriginPlaces(note: string | undefined): string[] {
  if (!note) {
    return [];
  }

  return Array.from(
    new Set([...note.matchAll(/Luogo:\s*([^.]+)\./gi)].map((match) => match[1]?.trim()).filter(Boolean)),
  );
}

const HIDDEN_CONDIMENTS = new Set([
  'sale',
  'olio',
  'olio d oliva',
  'olio d oliva extra vergine',
  'olio extravergine',
  'rosmarino',
  'aglio',
  'aceto',
  'pepe',
]);

const MEAT_KEYWORDS = ['manzo', 'vitello', 'maiale', 'salsiccia', 'prosciutto', 'bacon', 'salame', 'carne', 'pollo', 'tacchino', 'coniglio', 'anatra'];
const FISH_KEYWORDS = ['acciug', 'salmone', 'tonno', 'merluzzo', 'branzino', 'orata', 'pesce', 'gamber', 'calamar', 'sepp', 'polpo', 'cozz', 'vongol', 'sgombro'];
const DAIRY_KEYWORDS = ['latte', 'burro', 'panna', 'parmigiano', 'mozzarella', 'ricotta', 'formaggio', 'yogurt', 'pecorino', 'gorgonzola'];
const EGG_KEYWORDS = ['uovo', 'uova', 'albume', 'tuorlo'];
const HONEY_KEYWORDS = ['miele'];
const GLUTEN_KEYWORDS = ['farina', 'pasta', 'spaghetti', 'tagliatelle', 'pane', 'pangrattato', 'biscotti', 'pizza', 'lasagne', 'orzo', 'segale', 'frumento'];
const PASTA_KEYWORDS = [
  'pasta',
  'spaghetti',
  'bucatini',
  'penne',
  'rigatoni',
  'fusilli',
  'maccheroni',
  'tagliatelle',
  'tagliolini',
  'lasagne',
  'gnocchi',
  'ravioli',
  'tortelli',
  'tortellini',
  'cannelloni',
];
const PIZZA_KEYWORDS = ['pizza', 'pizzetta', 'pizze', 'calzone', 'focaccia'];

function hasKeywordMatch(values: string[], keywords: string[]) {
  return values.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

export function getOriginalRecipeSearchProfiles(
  entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry,
): OriginalRecipeSearchProfile[] {
  const ingredientValues = getEntryIngredientLines(entry)
    .filter((ingredient) => !ingredient.isSectionLabel)
    .map((ingredient) => ingredient.normalizedName);
  const values = [
    entry.title.toLowerCase(),
    entry.primaryIngredientNormalized,
    ...ingredientValues,
  ];
  const category = entry.category.toLowerCase();

  const isFish = category.includes('pesce') || hasKeywordMatch(values, FISH_KEYWORDS);
  const isMeat = category.includes('carne') || category.includes('pollame') || hasKeywordMatch(values, MEAT_KEYWORDS);
  const hasDairy = hasKeywordMatch(values, DAIRY_KEYWORDS);
  const hasEggs = hasKeywordMatch(values, EGG_KEYWORDS);
  const hasHoney = hasKeywordMatch(values, HONEY_KEYWORDS);
  const hasGluten = hasKeywordMatch(values, GLUTEN_KEYWORDS);
  const isVegetarian = !isMeat && !isFish;
  const isVegan = isVegetarian && !hasDairy && !hasEggs && !hasHoney;
  const isSoup = category.includes('zuppa') || category.includes('minestra') || category.includes('brodo');
  const isAppetizer = category.includes('antipasto');
  const isMainDish = category.includes('primo') || category.includes('carne') || category.includes('pollame') || category.includes('pesce') || isSoup;
  // "Pasta" and "Pizza" are search-friendly sub-profiles: they sit alongside
  // broader groups like "Primo" so the user can drill into common families
  // without depending on noisy source categories.
  const isPasta = (category.includes('primo') || category.includes('pasta')) && hasKeywordMatch(values, PASTA_KEYWORDS);
  const isPizza = category.includes('pizza') || hasKeywordMatch(values, PIZZA_KEYWORDS);

  return [
    ...(isMainDish ? (['main-dish'] as const) : []),
    ...(isMeat ? (['meat'] as const) : []),
    ...(isFish ? (['fish'] as const) : []),
    ...(category.includes('primo') ? (['primo'] as const) : []),
    ...(isPasta ? (['pasta'] as const) : []),
    ...(isPizza ? (['pizza'] as const) : []),
    ...(isAppetizer ? (['appetizer'] as const) : []),
    ...(isSoup ? (['soup'] as const) : []),
    ...(isVegetarian ? (['vegetarian'] as const) : []),
    ...(isVegan ? (['vegan'] as const) : []),
    ...(!hasGluten ? (['gluten-free'] as const) : []),
    ...(!hasDairy ? (['lactose-free'] as const) : []),
  ];
}

export interface OriginalRecipeLabelChip {
  name: string;
  normalizedName: string;
  isPrimary: boolean;
}

function getEntryIngredientLines(entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry) {
  return 'ingredients' in entry ? entry.ingredients : entry.ingredientPreview;
}

export function buildOriginalRecipeLabelChips(
  entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry,
  limit = 6,
): OriginalRecipeLabelChip[] {
  const chips = getEntryIngredientLines(entry)
    .filter((ingredient) => !ingredient.isSectionLabel)
    .map((ingredient) => ({
      name: ingredient.displayName,
      normalizedName: ingredient.normalizedName,
      isPrimary: ingredient.normalizedName === entry.primaryIngredientNormalized,
    }));
  const deduped = chips.filter(
    (chip, index) =>
      chips.findIndex((candidate) => candidate.normalizedName === chip.normalizedName && candidate.name === chip.name) === index,
  );
  const featured = deduped.filter((chip) => !HIDDEN_CONDIMENTS.has(chip.normalizedName));
  const base = featured.length >= 3 ? featured : deduped;

  return base.slice(0, limit);
}

export function buildOriginalRecipeVisibleIngredients(
  entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry,
  limit = 10,
): OriginalRecipeIngredientLine[] {
  const baseIngredients = getEntryIngredientLines(entry).filter((ingredient) => !ingredient.isSectionLabel);
  const featured = baseIngredients.filter((ingredient) => !HIDDEN_CONDIMENTS.has(ingredient.normalizedName));
  const preferred = featured.length >= Math.min(limit, 4) ? featured : baseIngredients;

  return preferred.slice(0, limit);
}

export function getOriginalRecipePreviewText(entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry): string {
  const preview = entry.instructionPreview.trim();
  if (preview.length <= 150) {
    return preview;
  }

  return `${preview.slice(0, 147).trimEnd()}...`;
}

export function getOriginalRecipeQuickNote(entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry): string {
  const rawNote = ('notePreview' in entry ? entry.notePreview : 'note' in entry ? entry.note : '') ?? '';
  const cleaned = rawNote
    .replace(/Luogo:\s*[^.]+\.\s*/gi, '')
    .replace(/Preparazione:\s*\d+\s*minuti\.?\s*/gi, '')
    .replace(/Cottura:\s*\d+\s*minuti\.?\s*/gi, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  return cleaned.length <= 140 ? cleaned : `${cleaned.slice(0, 137).trimEnd()}...`;
}

export function buildVisibleNutritionMetricBadges(
  nutritionSignals: NutritionSignals | null,
): VisibleNutritionMetricBadge[] {
  if (!nutritionSignals) {
    return [];
  }

  const metricBadges: VisibleNutritionMetricBadge[] = [
    {
      key: 'calories',
      metricLabel: 'Calorie',
      qualitativeLabel: nutritionSignals.qualitativeLabels.calories,
      value: nutritionSignals.quantitativeEstimate?.macros.calories,
      unit: 'kcal',
    },
    {
      key: 'carbs',
      metricLabel: 'Carbo',
      qualitativeLabel: nutritionSignals.qualitativeLabels.carbs,
      value: nutritionSignals.quantitativeEstimate?.macros.carbs,
      unit: 'g',
    },
    {
      key: 'protein',
      metricLabel: 'Proteine',
      qualitativeLabel: nutritionSignals.qualitativeLabels.protein,
      value: nutritionSignals.quantitativeEstimate?.macros.protein,
      unit: 'g',
    },
    {
      key: 'fat',
      metricLabel: 'Grassi',
      qualitativeLabel: nutritionSignals.qualitativeLabels.fat,
      value: nutritionSignals.quantitativeEstimate?.macros.fat,
      unit: 'g',
    },
  ];

  return metricBadges.filter((badge) => badge.qualitativeLabel.label !== 'medio');
}

export function buildOriginalRecipeSupportMetadata(
  entry: OriginalRecipeSupportEntry | OriginalRecipeSupportDetailEntry,
): OriginalRecipeSupportMetadata {
  const normalizedCategory = entry.category.toLowerCase();
  const categoryNutritionHint =
    normalizedCategory.includes('pesce')
      ? ('fish' as const)
      : normalizedCategory.includes('carne') || normalizedCategory.includes('pollame')
        ? ('meat' as const)
        : normalizedCategory.includes('primo')
          ? ('primo' as const)
        : undefined;
  const primaryReference = resolveNutritionReferenceByName(entry.primaryIngredient);
  const primarySection = (primaryReference?.pdfSection ?? '').toLowerCase();
  const primaryNutritionHint =
    primarySection.includes('pesci') || primarySection.includes('pesce')
      ? ('fish' as const)
      : primarySection.includes('carni') || primarySection.includes('carne')
        ? ('meat' as const)
        : primarySection.includes('cereali')
          ? ('primo' as const)
          : undefined;
  const requiredNutritionCategory = primaryNutritionHint ?? categoryNutritionHint;

  return {
    preparationMinutes: entry.preparationMinutes ?? extractMinutes('note' in entry ? entry.note : undefined, 'Preparazione'),
    cookMinutes: entry.cookMinutes ?? extractMinutes('note' in entry ? entry.note : undefined, 'Cottura'),
    originPlaces: entry.originPlaces.length > 0 ? entry.originPlaces : extractOriginPlaces('note' in entry ? entry.note : undefined),
    // If the original archive already declares a clear primary ingredient and we
    // can resolve it, we trust that explicit signal first. Category guardrails
    // still apply as a fallback when the primary ingredient is too noisy.
    nutritionSignals: estimateNutritionSignalsFromIngredientNames(getEntryIngredientLines(entry), {
      primaryIngredientName: entry.primaryIngredient,
      requiredCategory: requiredNutritionCategory,
    }),
    searchProfiles: getOriginalRecipeSearchProfiles(entry),
  };
}
