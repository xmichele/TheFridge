import type {
  OriginalRecipeIngredientLine,
  OriginalRecipeSupportDataset,
  OriginalRecipeSupportDetailEntry,
  OriginalRecipeSupportEntry,
} from '@/domain/support';

let supportDatasetPromise: Promise<OriginalRecipeSupportDataset> | null = null;
const detailChunkPromises = new Map<string, Promise<{ entries: OriginalRecipeSupportDetailEntry[] }>>();
let supportLookupPromise: Promise<OriginalRecipeSupportLookupDataset> | null = null;

type PackedIngredientLine = [string, string, string, boolean];
type PackedSupportEntry = [
  string,
  string,
  string,
  string,
  string,
  string,
  string | null | undefined,
  PackedIngredientLine[],
  string,
  string[],
  number | null | undefined,
  number | null | undefined,
  string,
];
type PackedDetailEntry = [
  string,
  string,
  string,
  string,
  string,
  string,
  string | null | undefined,
  PackedIngredientLine[],
  string,
  string,
  string[],
  number | null | undefined,
  number | null | undefined,
  string,
];
type PackedLookupEntry = [string, string, string, string];

interface PackedSupportDatasetResponse {
  generatedAt: string;
  sourceFile: string;
  sourceRecordCount?: number;
  entryCount: number;
  entries: Array<OriginalRecipeSupportEntry | PackedSupportEntry>;
}

interface PackedDetailChunkResponse {
  entryCount: number;
  entries: Array<OriginalRecipeSupportDetailEntry | PackedDetailEntry>;
}

export interface OriginalRecipeSupportLookupEntry {
  id: string;
  title: string;
  detailChunk: string;
  servingsText: string;
}

export interface OriginalRecipeSupportLookupDataset {
  generatedAt: string;
  entryCount: number;
  entries: OriginalRecipeSupportLookupEntry[];
}

interface PackedLookupDatasetResponse {
  generatedAt: string;
  entryCount: number;
  entries: Array<OriginalRecipeSupportLookupEntry | PackedLookupEntry>;
}

function getPublicAssetBaseUrl() {
  const baseUrl = import.meta.env.BASE_URL || '/';

  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function getOriginalRecipeSupportAssetUrl(relativePath: string) {
  const normalizedPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  return `${getPublicAssetBaseUrl()}${normalizedPath}`;
}

function decodeIngredientLine(line: OriginalRecipeIngredientLine | PackedIngredientLine): OriginalRecipeIngredientLine {
  if (!Array.isArray(line)) {
    return line;
  }

  return {
    displayName: line[0],
    normalizedName: line[1],
    quantityText: line[2],
    isSectionLabel: line[3],
  };
}

function decodePackedSupportEntry(entry: PackedSupportEntry): OriginalRecipeSupportEntry {
  const [
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    noteOrPreview,
    packedIngredients,
    instructionText,
    originPlaces,
    preparationMinutes,
    cookMinutes,
    detailChunk,
  ] = entry;

  return {
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    notePreview: noteOrPreview ?? undefined,
    ingredientPreview: packedIngredients.map(decodeIngredientLine),
    instructionPreview: instructionText,
    originPlaces,
    preparationMinutes: preparationMinutes ?? undefined,
    cookMinutes: cookMinutes ?? undefined,
    detailChunk,
  };
}

function decodePackedDetailEntry(entry: PackedDetailEntry): OriginalRecipeSupportDetailEntry {
  const [
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    note,
    packedIngredients,
    instructionText,
    instructionPreview,
    originPlaces,
    preparationMinutes,
    cookMinutes,
    detailChunk,
  ] = entry;

  return {
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    note: note ?? undefined,
    ingredientPreview: packedIngredients.map(decodeIngredientLine),
    ingredients: packedIngredients.map(decodeIngredientLine),
    instructionText,
    instructionPreview,
    originPlaces,
    preparationMinutes: preparationMinutes ?? undefined,
    cookMinutes: cookMinutes ?? undefined,
    detailChunk,
  };
}

export function decodeOriginalRecipeSupportDatasetResponse(
  response: PackedSupportDatasetResponse,
): OriginalRecipeSupportDataset {
  return {
    generatedAt: response.generatedAt,
    sourceFile: response.sourceFile,
    sourceRecordCount: response.sourceRecordCount,
    entryCount: response.entryCount,
    entries: response.entries.map((entry) =>
      Array.isArray(entry)
        ? decodePackedSupportEntry(entry)
        : {
            ...entry,
            ingredientPreview: entry.ingredientPreview.map(decodeIngredientLine),
          },
    ),
  };
}

export function decodeOriginalRecipeSupportDetailChunkResponse(
  response: PackedDetailChunkResponse,
): { entries: OriginalRecipeSupportDetailEntry[] } {
  return {
    entries: response.entries.map((entry) =>
      Array.isArray(entry)
        ? decodePackedDetailEntry(entry)
        : {
            ...entry,
            ingredientPreview: entry.ingredientPreview.map(decodeIngredientLine),
            ingredients: entry.ingredients.map(decodeIngredientLine),
          },
    ),
  };
}

export function decodeOriginalRecipeSupportLookupResponse(
  response: PackedLookupDatasetResponse,
): OriginalRecipeSupportLookupDataset {
  return {
    generatedAt: response.generatedAt,
    entryCount: response.entryCount,
    entries: response.entries.map((entry) =>
      Array.isArray(entry)
        ? {
            id: entry[0],
            title: entry[1],
            detailChunk: entry[2],
            servingsText: entry[3],
          }
        : entry,
    ),
  };
}

export function loadOriginalRecipeSupportDataset(): Promise<OriginalRecipeSupportDataset> {
  if (!supportDatasetPromise) {
    supportDatasetPromise = fetch(getOriginalRecipeSupportAssetUrl('support/original-recipes-support.json')).then(async (response) => {
      if (!response.ok) {
        throw new Error('Impossibile caricare l archivio ricette originale.');
      }

      return decodeOriginalRecipeSupportDatasetResponse(
        (await response.json()) as PackedSupportDatasetResponse,
      );
    });
  }

  return supportDatasetPromise;
}

export function loadOriginalRecipeSupportLookup(): Promise<OriginalRecipeSupportLookupDataset> {
  if (!supportLookupPromise) {
    supportLookupPromise = fetch(getOriginalRecipeSupportAssetUrl('support/original-recipes-lookup.json')).then(async (response) => {
      if (!response.ok) {
        throw new Error('Impossibile caricare l indice ricette originale.');
      }

      return decodeOriginalRecipeSupportLookupResponse(
        (await response.json()) as PackedLookupDatasetResponse,
      );
    });
  }

  return supportLookupPromise;
}

export async function loadOriginalRecipeSupportDetail(
  entry: OriginalRecipeSupportEntry,
): Promise<OriginalRecipeSupportDetailEntry> {
  const chunkKey = entry.detailChunk;
  if (!detailChunkPromises.has(chunkKey)) {
    detailChunkPromises.set(
      chunkKey,
      fetch(getOriginalRecipeSupportAssetUrl(`support/original-recipes-details/${chunkKey}.json`)).then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossibile caricare il dettaglio ricetta originale.');
        }

        return decodeOriginalRecipeSupportDetailChunkResponse(
          (await response.json()) as PackedDetailChunkResponse,
        );
      }),
    );
  }

  const chunk = await detailChunkPromises.get(chunkKey);
  const detail = chunk?.entries.find((item) => item.id === entry.id);
  if (!detail) {
    throw new Error('Dettaglio ricetta originale non trovato.');
  }

  return detail;
}

export async function loadOriginalRecipeSupportDetailByLookup(
  entry: OriginalRecipeSupportLookupEntry,
): Promise<OriginalRecipeSupportDetailEntry> {
  if (!detailChunkPromises.has(entry.detailChunk)) {
    detailChunkPromises.set(
      entry.detailChunk,
      fetch(getOriginalRecipeSupportAssetUrl(`support/original-recipes-details/${entry.detailChunk}.json`)).then(async (response) => {
        if (!response.ok) {
          throw new Error('Impossibile caricare il dettaglio ricetta originale.');
        }

        return decodeOriginalRecipeSupportDetailChunkResponse(
          (await response.json()) as PackedDetailChunkResponse,
        );
      }),
    );
  }

  const chunk = await detailChunkPromises.get(entry.detailChunk);
  const detail = chunk?.entries.find((item) => item.id === entry.id);
  if (!detail) {
    throw new Error('Dettaglio ricetta originale non trovato.');
  }

  return detail;
}
