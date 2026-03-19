import { ingredientNutritionSeed, type IngredientNutritionSeedEntry } from '@/data/ingredientNutritionSeed';
import type { Recipe, RecipeIngredient, Unit } from '@/domain/models';
import { normalizeIngredientName } from '@/domain/normalization';
import { scaleRecipeIngredients } from '@/domain/recipes';
import { roundQuantity } from '@/domain/units';

export interface MacroTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export type NutritionMetricKey = keyof MacroTotals;

export interface NutritionMetricSource {
  sourceName: string;
  referenceName: string;
  role: 'primary' | 'responsible';
  per100g: MacroTotals;
}

export interface NutritionStickerSource {
  sticker: 'ricca di fibre' | 'ricca di vitamine';
  referenceName: string;
}

export interface RecipeNutritionIngredientMatch {
  ingredient: RecipeIngredient;
  reference: IngredientNutritionSeedEntry;
  gramsUsed: number;
  totals: MacroTotals;
}

export interface BaseIngredientBreakdownItem {
  reference: IngredientNutritionSeedEntry;
  totalGrams: number;
  totals: MacroTotals;
  sourceIngredientNames: string[];
}

export type NutritionDisplayBasis = 'per-100g' | 'per-serving' | 'whole-recipe';

export interface RecipeNutritionAnalysis {
  total: MacroTotals;
  perServing: MacroTotals;
  per100g?: MacroTotals;
  preferredBasis: NutritionDisplayBasis;
  totalKnownGrams: number;
  fullyMatched: boolean;
  matchedIngredients: RecipeNutritionIngredientMatch[];
  unmatchedIngredients: RecipeIngredient[];
  baseIngredients: BaseIngredientBreakdownItem[];
  qualitativeLabels: {
    calories: NutrientLevelLabel;
    carbs: NutrientLevelLabel;
    protein: NutrientLevelLabel;
    fat: NutrientLevelLabel;
  };
  editorialLabels: Array<{
    label: string;
    tone: 'danger' | 'warn' | 'neutral' | 'success';
  }>;
  stickers: string[];
  metricSources: Record<NutritionMetricKey, NutritionMetricSource | null>;
  stickerSources: Partial<Record<'ricca di fibre' | 'ricca di vitamine', NutritionStickerSource>>;
}

export interface NutrientLevelLabel {
  label: string;
  tone: 'danger' | 'warn' | 'neutral' | 'success';
}

interface EditorialLabel {
  label: string;
  tone: 'danger' | 'warn' | 'neutral' | 'success';
}

export interface NutritionSignals {
  qualitativeLabels: {
    calories: NutrientLevelLabel;
    carbs: NutrientLevelLabel;
    protein: NutrientLevelLabel;
    fat: NutrientLevelLabel;
  };
  editorialLabels: EditorialLabel[];
  stickers: string[];
  quantitativeEstimate?: {
    basisLabel: string;
    confidence: 'medium';
    macros: MacroTotals;
  };
  metricSources: Record<NutritionMetricKey, NutritionMetricSource | null>;
  stickerSources: Partial<Record<'ricca di fibre' | 'ricca di vitamine', NutritionStickerSource>>;
}

interface IngredientSignalSource {
  displayName: string;
  normalizedName: string;
  isSectionLabel?: boolean;
  quantityText?: string;
}

interface IngredientSignalOptions {
  primaryIngredientName?: string;
  requiredCategory?: 'fish' | 'meat' | 'primo';
}

const nutritionIndex = new Map<string, IngredientNutritionSeedEntry>();

const lowImpactCondiments = new Set([
  'sale',
  'olio',
  'olio d oliva',
  'olio d oliva extra vergine',
  'olio extravergine',
  'pepe',
  'aglio',
  'rosmarino',
  'aceto',
]);

const secondaryFatBoosters = new Set(['burro', 'panna', 'panna liquida', 'maionese']);
const likelyProteinMainKeywords = [
  'carne',
  'manzo',
  'vitello',
  'maiale',
  'salsiccia',
  'prosciutto',
  'pollo',
  'tacchino',
  'coniglio',
  'anatra',
  'pesce',
  'tonno',
  'salmone',
  'merluzzo',
  'orata',
  'branzino',
  'acciugh',
  'gamber',
  'polpo',
  'calamar',
  'sepp',
];
const fishSectionKeywords = ['pesci', 'pesce', 'prodotti della pesca'];
const meatSectionKeywords = ['carni', 'carne'];
const primoReferenceKeywords = [
  'pasta',
  'spaghetti',
  'maccheroni',
  'tagliatelle',
  'tagliolini',
  'lasagne',
  'gnocchi',
  'riso',
  'farina',
  'pane',
  'pangrattato',
];

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

const approximateQuantityPatterns = [/^q\s*\.?\s*b\s*\.?$/i, /^quanto basta$/i];
const weakPrimaryTokens = new Set([
  'spalla',
  'polpa',
  'petto',
  'coscio',
  'costoletta',
  'fesa',
  'filetto',
  'trancio',
  'fritto',
  'fritte',
  'gratinate',
  'gratinato',
  'marinate',
  'marinato',
  'disossata',
  'disossato',
  'arrotolata',
  'arrotolato',
]);

function singularizeWord(word: string): string[] {
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

function buildIngredientMatchCandidates(rawValue: string): string[] {
  const normalized = normalizeIngredientName(rawValue);
  const candidates = new Set<string>();

  function addCandidate(value: string) {
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
      const nextParts = [...parts.slice(0, -1), singularized];
      addCandidate(nextParts.join(' '));
    }
  }

  return [...candidates];
}

for (const entry of ingredientNutritionSeed) {
  for (const candidate of buildIngredientMatchCandidates(entry.normalizedName)) {
    nutritionIndex.set(candidate, entry);
  }
  for (const alias of entry.aliases) {
    for (const candidate of buildIngredientMatchCandidates(alias)) {
      nutritionIndex.set(candidate, entry);
    }
  }
}

function emptyTotals(): MacroTotals {
  return {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  };
}

function classifyLowerIsGreener(value: number, thresholds: [number, number, number]): NutrientLevelLabel {
  if (value >= thresholds[2]) {
    return { label: 'molto alto', tone: 'danger' };
  }
  if (value >= thresholds[1]) {
    return { label: 'alto', tone: 'warn' };
  }
  if (value >= thresholds[0]) {
    return { label: 'medio', tone: 'neutral' };
  }
  return { label: 'leggero', tone: 'success' };
}

function classifyProtein(value: number): NutrientLevelLabel {
  if (value >= 25) {
    return { label: 'alto', tone: 'success' };
  }
  if (value >= 15) {
    return { label: 'medio', tone: 'neutral' };
  }
  if (value >= 8) {
    return { label: 'basso', tone: 'warn' };
  }
  return { label: 'scarso', tone: 'danger' };
}

function buildEditorialLabels(
  labels: RecipeNutritionAnalysis['qualitativeLabels'],
  stickers: string[],
): EditorialLabel[] {
  const editorialLabels: EditorialLabel[] = [];

  if (labels.calories.tone === 'success' && labels.fat.tone !== 'danger') {
    editorialLabels.push({ label: 'leggera', tone: 'success' });
  }

  if (labels.protein.tone === 'success' || labels.protein.label === 'medio') {
    editorialLabels.push({ label: 'proteinica', tone: labels.protein.tone === 'success' ? 'success' : 'neutral' });
  }

  if (labels.carbs.tone === 'warn' || labels.carbs.tone === 'danger') {
    editorialLabels.push({ label: 'carbo importante', tone: labels.carbs.tone });
  }

  if (labels.fat.tone === 'warn' || labels.fat.tone === 'danger') {
    editorialLabels.push({ label: 'ricca di grassi', tone: labels.fat.tone });
  }

  if (labels.calories.tone === 'danger') {
    editorialLabels.push({ label: 'energetica', tone: 'danger' });
  }

  if (stickers.includes('ricca di fibre')) {
    editorialLabels.push({ label: 'saziante', tone: 'success' });
  }

  return editorialLabels.slice(0, 3);
}

function addTotals(current: MacroTotals, next: MacroTotals): MacroTotals {
  return {
    calories: roundQuantity(current.calories + next.calories),
    protein: roundQuantity(current.protein + next.protein),
    fat: roundQuantity(current.fat + next.fat),
    carbs: roundQuantity(current.carbs + next.carbs),
  };
}

function totalsFromGrams(entry: IngredientNutritionSeedEntry, gramsUsed: number): MacroTotals {
  const ratio = gramsUsed / 100;
  return {
    calories: roundQuantity(entry.caloriesPer100g * ratio),
    protein: roundQuantity(entry.proteinPer100g * ratio),
    fat: roundQuantity(entry.fatPer100g * ratio),
    carbs: roundQuantity(entry.carbsPer100g * ratio),
  };
}

function resolveIngredientReference(ingredient: RecipeIngredient): IngredientNutritionSeedEntry | null {
  return resolveNutritionReferenceByName(ingredient.normalizedName) ?? resolveNutritionReferenceByName(ingredient.displayName);
}

export function resolveNutritionReferenceByName(rawValue: string): IngredientNutritionSeedEntry | null {
  for (const candidate of buildIngredientMatchCandidates(rawValue)) {
    const match = nutritionIndex.get(candidate);
    if (match) {
      return match;
    }
  }

  const normalized = normalizeIngredientName(rawValue);
  const normalizedTokens = normalized.split(' ').filter(Boolean);
  let bestMatch: IngredientNutritionSeedEntry | null = null;
  let bestScore = 0;

  for (const entry of ingredientNutritionSeed) {
    const candidatePhrases = [entry.normalizedName, ...entry.aliases];
    for (const phrase of candidatePhrases) {
      if (!phrase) {
        continue;
      }

      if (normalized.includes(phrase)) {
        const phraseTokens = phrase.split(' ').filter(Boolean);
        const strongTokens = phraseTokens.filter((token) => token.length > 2);
        const score = strongTokens.length > 0 ? 10 + strongTokens.length : 0;
        if (score > bestScore) {
          bestMatch = entry;
          bestScore = score;
        }
        continue;
      }

      const phraseTokens = phrase
        .split(' ')
        .filter(Boolean)
        .filter((token) => token.length > 2 && !weakPrimaryTokens.has(token));
      const overlap = phraseTokens.filter((token) => normalizedTokens.includes(token));
      const score = overlap.length >= 1 ? overlap.length : 0;
      if (score > bestScore) {
        bestMatch = entry;
        bestScore = score;
      }
    }
  }

  if (bestScore >= 1) {
    return bestMatch;
  }

  return null;
}

function toGrams(quantity: number, unit: Unit, reference: IngredientNutritionSeedEntry): number | null {
  switch (unit) {
    case 'g':
      return quantity;
    case 'kg':
      return quantity * 1000;
    case 'ml':
      return reference.densityGramsPerMl ? quantity * reference.densityGramsPerMl : null;
    case 'l':
      return reference.densityGramsPerMl ? quantity * 1000 * reference.densityGramsPerMl : null;
    case 'pcs':
      return reference.gramsPerPiece ? quantity * reference.gramsPerPiece : null;
    case 'tbsp':
      return reference.gramsPerTablespoon ? quantity * reference.gramsPerTablespoon : null;
    case 'tsp':
      return reference.gramsPerTeaspoon ? quantity * reference.gramsPerTeaspoon : null;
    default:
      return null;
  }
}

function buildNutritionSignals(labelSource: MacroTotals, baseIngredients: BaseIngredientBreakdownItem[]): NutritionSignals {
  const fiberRichGrams = baseIngredients
    .filter((item) => item.reference.highFiber)
    .reduce((totalValue, item) => totalValue + item.totalGrams, 0);
  const vitaminRichGrams = baseIngredients
    .filter((item) => item.reference.highVitamins)
    .reduce((totalValue, item) => totalValue + item.totalGrams, 0);
  const stickers = [
    ...(fiberRichGrams >= 80 ? ['ricca di fibre'] : []),
    ...(vitaminRichGrams >= 120 ? ['ricca di vitamine'] : []),
  ];
  const qualitativeLabels = {
    calories: classifyLowerIsGreener(labelSource.calories, [120, 250, 400]),
    carbs: classifyLowerIsGreener(labelSource.carbs, [12, 25, 40]),
    protein: classifyProtein(labelSource.protein),
    fat: classifyLowerIsGreener(labelSource.fat, [5, 12, 20]),
  };

  return {
    qualitativeLabels,
    editorialLabels: buildEditorialLabels(qualitativeLabels, stickers),
    stickers,
    metricSources: buildMetricSourcesFromBaseIngredients(baseIngredients),
    stickerSources: buildStickerSources(baseIngredients),
  };
}

function buildStickerSources(
  baseIngredients: BaseIngredientBreakdownItem[],
): Partial<Record<'ricca di fibre' | 'ricca di vitamine', NutritionStickerSource>> {
  const fiberItem =
    [...baseIngredients]
      .filter((item) => item.reference.highFiber)
      .sort((left, right) => right.totalGrams - left.totalGrams)[0] ?? null;
  const vitaminItem =
    [...baseIngredients]
      .filter((item) => item.reference.highVitamins)
      .sort((left, right) => right.totalGrams - left.totalGrams)[0] ?? null;

  return {
    ...(fiberItem
      ? {
          'ricca di fibre': {
            sticker: 'ricca di fibre',
            referenceName: fiberItem.reference.displayName,
          },
        }
      : {}),
    ...(vitaminItem
      ? {
          'ricca di vitamine': {
            sticker: 'ricca di vitamine',
            referenceName: vitaminItem.reference.displayName,
          },
        }
      : {}),
  };
}

function emptyMetricSources(): Record<NutritionMetricKey, NutritionMetricSource | null> {
  return {
    calories: null,
    protein: null,
    fat: null,
    carbs: null,
  };
}

function buildMetricSource(
  item: BaseIngredientBreakdownItem,
  role: NutritionMetricSource['role'],
): NutritionMetricSource {
  return {
    sourceName: item.sourceIngredientNames[0] ?? item.reference.displayName,
    referenceName: item.reference.displayName,
    role,
    per100g: {
      calories: item.reference.caloriesPer100g,
      protein: item.reference.proteinPer100g,
      fat: item.reference.fatPer100g,
      carbs: item.reference.carbsPer100g,
    },
  };
}

function buildMetricSourcesFromBaseIngredients(
  baseIngredients: BaseIngredientBreakdownItem[],
  preferredReferenceNormalized?: string,
  preferFirstIngredientFallback = false,
): Record<NutritionMetricKey, NutritionMetricSource | null> {
  if (baseIngredients.length === 0) {
    return emptyMetricSources();
  }

  const primaryItem =
    preferredReferenceNormalized
      ? baseIngredients.find((item) =>
          item.reference.normalizedName === preferredReferenceNormalized,
        ) ?? null
      : null;
  const firstOriginalItem = baseIngredients[0] ?? null;

  function pickResponsible(metric: NutritionMetricKey) {
    return [...baseIngredients].sort((left, right) => {
      if (right.totals[metric] !== left.totals[metric]) {
        return right.totals[metric] - left.totals[metric];
      }

      return right.totalGrams - left.totalGrams;
    })[0] ?? null;
  }

  function pickSource(metric: NutritionMetricKey): NutritionMetricSource | null {
    if (primaryItem) {
      return buildMetricSource(primaryItem, 'primary');
    }

    if (preferFirstIngredientFallback && firstOriginalItem) {
      return buildMetricSource(firstOriginalItem, 'responsible');
    }

    const item = pickResponsible(metric);
    return item ? buildMetricSource(item, 'responsible') : null;
  }

  return {
    calories: pickSource('calories'),
    protein: pickSource('protein'),
    fat: pickSource('fat'),
    carbs: pickSource('carbs'),
  };
}

function isApproximateQuantity(quantityText: string | undefined) {
  const cleaned = (quantityText ?? '').trim().toLowerCase();
  return cleaned ? approximateQuantityPatterns.some((pattern) => pattern.test(cleaned)) : false;
}

function isStructuralGuideCandidate(
  ingredient: IngredientSignalSource,
  reference: IngredientNutritionSeedEntry,
) {
  const normalizedName = ingredient.normalizedName || normalizeIngredientName(ingredient.displayName);
  if (lowImpactCondiments.has(normalizedName) || lowImpactCondiments.has(reference.normalizedName)) {
    return false;
  }

  if (secondaryFatBoosters.has(normalizedName) || secondaryFatBoosters.has(reference.normalizedName)) {
    return false;
  }

  if (isApproximateQuantity(ingredient.quantityText)) {
    return false;
  }

  return true;
}

function referenceMatchesRequiredCategory(
  reference: IngredientNutritionSeedEntry,
  requiredCategory: 'fish' | 'meat' | 'primo',
) {
  const section = normalizeIngredientName(reference.pdfSection ?? '');
  if (requiredCategory === 'fish') {
    return fishSectionKeywords.some((keyword) => section.includes(keyword));
  }

  if (requiredCategory === 'primo') {
    return (
      section.includes('cereali e derivati') ||
      primoReferenceKeywords.some((keyword) => reference.normalizedName.includes(keyword)) ||
      reference.aliases.some((alias) => primoReferenceKeywords.some((keyword) => alias.includes(keyword)))
    );
  }

  return meatSectionKeywords.some((keyword) => section.includes(keyword));
}

function isLikelyProteinMainIngredient(
  primaryIngredientName: string | undefined,
  primaryReference: IngredientNutritionSeedEntry | null,
): boolean {
  const normalizedPrimary = primaryIngredientName ? normalizeIngredientName(primaryIngredientName) : '';
  if (
    normalizedPrimary &&
    likelyProteinMainKeywords.some((keyword) => normalizedPrimary.includes(keyword))
  ) {
    return true;
  }

  if (!primaryReference) {
    return false;
  }

  return primaryReference.proteinPer100g >= 18 && primaryReference.carbsPer100g <= 5;
}

function getIngredientSignalWeight(
  ingredient: IngredientSignalSource,
  reference: IngredientNutritionSeedEntry,
  primaryIngredientName: string | undefined,
  index: number,
): number {
  const normalizedName = ingredient.normalizedName ? normalizeIngredientName(ingredient.normalizedName) : normalizeIngredientName(ingredient.displayName);
  const normalizedPrimary = primaryIngredientName ? normalizeIngredientName(primaryIngredientName) : '';

  if (ingredient.isSectionLabel) {
    return 0;
  }

  if (normalizedName && normalizedName === normalizedPrimary) {
    return 3;
  }

  // Common condiments are present in many recipes but are often small finishing
  // quantities, so we keep their influence deliberately tiny in archive estimates.
  if (lowImpactCondiments.has(normalizedName) || lowImpactCondiments.has(reference.normalizedName)) {
    return 0.15;
  }

  // Secondary fat boosters still matter, but less than the structural ingredient.
  if (secondaryFatBoosters.has(normalizedName) || secondaryFatBoosters.has(reference.normalizedName)) {
    return 0.45;
  }

  if (reference.highFiber || reference.highVitamins) {
    return 1.2;
  }

  return index <= 1 ? 1 : 0.75;
}

export function estimateNutritionSignalsFromIngredientNames(
  ingredients: Array<string | IngredientSignalSource>,
  options: IngredientSignalOptions = {},
): NutritionSignals | null {
  // For original archive recipes we rarely have reliable gram quantities, so we derive
  // an estimated per-100g profile from the matched ingredient references. The weights
  // below intentionally privilege the main ingredient and dampen condiments so that
  // a finishing drizzle of oil does not dominate the qualitative fat badge.
  const resolvedIngredients: IngredientSignalSource[] = ingredients
    .map((ingredient) =>
      typeof ingredient === 'string'
        ? { displayName: ingredient, normalizedName: normalizeIngredientName(ingredient), isSectionLabel: false }
        : {
            displayName: ingredient.displayName,
            normalizedName: ingredient.normalizedName ? normalizeIngredientName(ingredient.normalizedName) : normalizeIngredientName(ingredient.displayName),
            isSectionLabel: ingredient.isSectionLabel ?? false,
            quantityText: ingredient.quantityText,
          },
    )
    .filter((ingredient) => !ingredient.isSectionLabel);
  const references = resolvedIngredients
    .map((ingredient, index) => {
      const reference = resolveNutritionReferenceByName(ingredient.normalizedName || ingredient.displayName);
      return reference ? { ingredient, reference, index } : null;
    })
    .filter(Boolean) as Array<{ ingredient: IngredientSignalSource; reference: IngredientNutritionSeedEntry; index: number }>;

  if (references.length === 0) {
    return null;
  }

  if (!options.requiredCategory) {
    return null;
  }

  const preferredPrimaryReference = options.primaryIngredientName
    ? resolveNutritionReferenceByName(options.primaryIngredientName)
    : null;
  const requiredCategory = options.requiredCategory;
  const structuralReferences = references.filter(({ ingredient, reference }) =>
    isStructuralGuideCandidate(ingredient, reference),
  );
  const explicitPrimaryReference = preferredPrimaryReference;
  const explicitPrimaryRecord = explicitPrimaryReference
    ? {
        ingredient: {
          displayName: options.primaryIngredientName ?? explicitPrimaryReference.displayName,
          normalizedName: normalizeIngredientName(options.primaryIngredientName ?? explicitPrimaryReference.displayName),
          isSectionLabel: false,
        },
        reference: explicitPrimaryReference,
        index: -1,
      }
    : null;
  if (!requiredCategory && !explicitPrimaryRecord) {
    return null;
  }
  const categoryReferences = requiredCategory
    ? structuralReferences.filter(({ reference }) =>
        referenceMatchesRequiredCategory(reference, requiredCategory),
      )
    : [];
  const guidingReference =
    explicitPrimaryRecord ??
    categoryReferences.find(
      ({ reference }) =>
        preferredPrimaryReference &&
        reference.normalizedName === preferredPrimaryReference.normalizedName &&
        requiredCategory &&
        referenceMatchesRequiredCategory(reference, requiredCategory),
    ) ??
    (requiredCategory === 'primo'
      ? categoryReferences.find(({ reference }) =>
          primoReferenceKeywords.some((keyword) => reference.normalizedName.includes(keyword)),
        ) ?? categoryReferences[0]
      : categoryReferences[0]) ??
    null;

  if (!guidingReference) {
    return null;
  }

  const uniqueReferences = new Map<string, BaseIngredientBreakdownItem>();
  let aggregate = emptyTotals();
  let totalWeight = 0;
  let primaryMatched = false;
  let primaryReference: IngredientNutritionSeedEntry | null = null;

  for (const { ingredient, reference, index } of references) {
    const weight = getIngredientSignalWeight(ingredient, reference, guidingReference.reference.displayName, index);
    if (weight <= 0) {
      continue;
    }
    if (
      preferredPrimaryReference &&
      reference.normalizedName === preferredPrimaryReference.normalizedName
    ) {
      primaryMatched = true;
      primaryReference = reference;
    }

    const totals = {
      calories: reference.caloriesPer100g * weight,
      protein: reference.proteinPer100g * weight,
      fat: reference.fatPer100g * weight,
      carbs: reference.carbsPer100g * weight,
    };
    aggregate = addTotals(aggregate, totals);
    totalWeight += weight;

    if (uniqueReferences.has(reference.normalizedName)) {
      const existing = uniqueReferences.get(reference.normalizedName);
      if (existing) {
        existing.totalGrams = roundQuantity(existing.totalGrams + 100 * weight);
        existing.totals = addTotals(existing.totals, totals);
        if (!existing.sourceIngredientNames.includes(ingredient.displayName)) {
          existing.sourceIngredientNames.push(ingredient.displayName);
        }
      }
      continue;
    }

    uniqueReferences.set(reference.normalizedName, {
      reference,
      totalGrams: roundQuantity(100 * weight),
      totals,
      sourceIngredientNames: [ingredient.displayName],
    });
  }

  if (totalWeight <= 0) {
    return null;
  }

  const averaged = {
    calories: roundQuantity(aggregate.calories / totalWeight),
    protein: roundQuantity(aggregate.protein / totalWeight),
    fat: roundQuantity(aggregate.fat / totalWeight),
    carbs: roundQuantity(aggregate.carbs / totalWeight),
  };
  const signals = buildNutritionSignals(averaged, [...uniqueReferences.values()]);
  const coverageRatio = resolvedIngredients.length > 0 ? references.length / resolvedIngredients.length : 0;
  const shouldAvoidLowProtein =
    (signals.qualitativeLabels.protein.label === 'scarso' || signals.qualitativeLabels.protein.label === 'basso') &&
    isLikelyProteinMainIngredient(options.primaryIngredientName, primaryReference);
  const adjustedProteinLabel = shouldAvoidLowProtein ? { label: 'medio', tone: 'neutral' as const } : signals.qualitativeLabels.protein;

  const metricSources = buildMetricSourcesFromBaseIngredients(
    [...uniqueReferences.values()],
    guidingReference.reference.normalizedName,
    true,
  );

  return {
    ...signals,
    qualitativeLabels: {
      ...signals.qualitativeLabels,
      // Archive estimates can undercount proteins when the main ingredient is meat/fish
      // but quantities are missing, so we avoid the overly pessimistic "basso/scarso" labels.
      protein: adjustedProteinLabel,
    },
    editorialLabels: buildEditorialLabels(
      {
        ...signals.qualitativeLabels,
        protein: adjustedProteinLabel,
      },
      signals.stickers,
    ),
    metricSources,
    stickerSources: signals.stickerSources,
    quantitativeEstimate:
      primaryMatched && coverageRatio >= 0.5
        ? {
            basisLabel: 'stima per 100 g',
            confidence: 'medium',
            macros: averaged,
          }
        : undefined,
  };
}

export function analyzeRecipeNutrition(recipe: Recipe, servings: number): RecipeNutritionAnalysis {
  const scaledIngredients = scaleRecipeIngredients(recipe, servings);
  const matchedIngredients: RecipeNutritionIngredientMatch[] = [];
  const unmatchedIngredients: RecipeIngredient[] = [];
  const baseIngredientMap = new Map<string, BaseIngredientBreakdownItem>();

  let total = emptyTotals();
  let totalKnownGrams = 0;

  for (const ingredient of scaledIngredients) {
    const reference = resolveIngredientReference(ingredient);
    if (!reference) {
      unmatchedIngredients.push(ingredient);
      continue;
    }

    const gramsUsed = toGrams(ingredient.quantity, ingredient.unit, reference);
    if (gramsUsed === null) {
      unmatchedIngredients.push(ingredient);
      continue;
    }

    const totals = totalsFromGrams(reference, gramsUsed);
    total = addTotals(total, totals);
    totalKnownGrams = roundQuantity(totalKnownGrams + gramsUsed);
    matchedIngredients.push({
      ingredient,
      reference,
      gramsUsed: roundQuantity(gramsUsed),
      totals,
    });

    const existingBreakdown = baseIngredientMap.get(reference.normalizedName);
    if (existingBreakdown) {
      existingBreakdown.totalGrams = roundQuantity(existingBreakdown.totalGrams + gramsUsed);
      existingBreakdown.totals = addTotals(existingBreakdown.totals, totals);
      if (!existingBreakdown.sourceIngredientNames.includes(ingredient.displayName)) {
        existingBreakdown.sourceIngredientNames.push(ingredient.displayName);
      }
    } else {
      baseIngredientMap.set(reference.normalizedName, {
        reference,
        totalGrams: roundQuantity(gramsUsed),
        totals,
        sourceIngredientNames: [ingredient.displayName],
      });
    }
  }

  const servingsCount = Math.max(servings, 1);
  const fullyMatched = unmatchedIngredients.length === 0;
  const perServing = {
    calories: roundQuantity(total.calories / servingsCount),
    protein: roundQuantity(total.protein / servingsCount),
    fat: roundQuantity(total.fat / servingsCount),
    carbs: roundQuantity(total.carbs / servingsCount),
  };
  const per100g =
    fullyMatched && totalKnownGrams > 0
      ? {
          calories: roundQuantity((total.calories / totalKnownGrams) * 100),
          protein: roundQuantity((total.protein / totalKnownGrams) * 100),
          fat: roundQuantity((total.fat / totalKnownGrams) * 100),
          carbs: roundQuantity((total.carbs / totalKnownGrams) * 100),
        }
      : undefined;
  const preferredBasis: NutritionDisplayBasis = per100g ? 'per-100g' : servingsCount > 1 ? 'per-serving' : 'whole-recipe';
  const baseIngredients = [...baseIngredientMap.values()].sort((left, right) => right.totalGrams - left.totalGrams);
  const labelSource = per100g ?? perServing;
  const signals = buildNutritionSignals(labelSource, baseIngredients);

  return {
    total,
    perServing,
    per100g,
    preferredBasis,
    totalKnownGrams,
    fullyMatched,
    matchedIngredients,
    unmatchedIngredients,
    baseIngredients,
    qualitativeLabels: signals.qualitativeLabels,
    editorialLabels: signals.editorialLabels,
    stickers: signals.stickers,
    metricSources: buildMetricSourcesFromBaseIngredients(baseIngredients),
    stickerSources: buildStickerSources(baseIngredients),
  };
}
