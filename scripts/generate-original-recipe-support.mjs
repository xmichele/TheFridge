import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

const sourcePath = path.resolve('old/data/RicetteOriginal.txt');
const targetPath = path.resolve('public/support/original-recipes-support.json');
const lookupPath = path.resolve('public/support/original-recipes-lookup.json');
const detailsDirPath = path.resolve('public/support/original-recipes-details');

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

function parseQuotedFields(line) {
  return [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

function parseIngredientNames(rawValue) {
  // The original export stores ingredients as "quantity ==== ingredient" lines.
  // We preserve both sides so the UI can show the original quantity text in the
  // archive popup even when we cannot normalize it into machine-safe units yet.
  const entries = rawValue
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
        isSectionLabel: displayName.endsWith(':') || /^(per|per la|per il|per i|per le)\b/i.test(displayName),
      };
    })
    .filter(Boolean);

  return entries.filter(
    (entry, index) =>
      entries.findIndex(
        (candidate) =>
          candidate.displayName === entry.displayName &&
          candidate.quantityText === entry.quantityText &&
          candidate.isSectionLabel === entry.isSectionLabel,
      ) === index,
  );
}

function extractOriginPlaces(note) {
  if (!note || note === '-') {
    return [];
  }

  return Array.from(new Set([...note.matchAll(/Luogo:\s*([^.]+)\./gi)].map((match) => cleanText(match[1] ?? '')).filter(Boolean)));
}

function extractMinutes(note, label) {
  if (!note || note === '-') {
    return undefined;
  }

  const match = note.match(new RegExp(`${label}:\\s*(\\d+)\\s*minuti`, 'i'));
  return match ? Number(match[1]) : undefined;
}

function slugifyCategory(value) {
  return normalizeIngredientName(value || 'archivio').replace(/\s+/g, '-');
}

function packIngredientLines(lines) {
  return lines.map((line) => [
    line.displayName,
    line.normalizedName,
    line.quantityText,
    line.isSectionLabel,
  ]);
}

const text = new TextDecoder('windows-1252').decode(fs.readFileSync(sourcePath));
const sourceRecordCount = text.split(/\r?\n/).filter((line) => line.trim()).length;
const detailChunks = new Map();
const lookupEntries = [];
const seenRecipes = new Set();
const entries = [];
let recipeSequence = 0;

fs.rmSync(detailsDirPath, { recursive: true, force: true });
fs.mkdirSync(detailsDirPath, { recursive: true });

for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) {
    continue;
  }

  const [rawTitle, rawCategory, rawPrimaryIngredient, rawServings, rawNotes, rawIngredients, rawInstructions] =
    parseQuotedFields(line);

  if (!rawInstructions) {
    continue;
  }

  const title = cleanText(rawTitle.replace(/\s+\(\d+\)$/, ''));
  const category = cleanText(rawCategory);
  const primaryIngredient = cleanText(rawPrimaryIngredient);
  const primaryIngredientNormalized = normalizeIngredientName(primaryIngredient);

  if (!title || !primaryIngredientNormalized) {
    continue;
  }

  const dedupeKey = `${category}|${normalizeIngredientName(title)}|${primaryIngredientNormalized}`;
  if (seenRecipes.has(dedupeKey)) {
    continue;
  }

  const ingredients = parseIngredientNames(rawIngredients);
  const ingredientPreview = ingredients.slice(0, 8);
  if (ingredientPreview.filter((entry) => !entry.isSectionLabel).length === 0) {
    continue;
  }

  seenRecipes.add(dedupeKey);
  recipeSequence += 1;
  const id = `originale-${recipeSequence}`;
  const detailChunk = slugifyCategory(category);
  const servingsText = cleanText(rawServings);
  const note = rawNotes && rawNotes !== '-' ? cleanText(rawNotes) : undefined;
  const instructionText = cleanText(rawInstructions);
  const instructionPreview = instructionText.slice(0, 180);
  const originPlaces = extractOriginPlaces(rawNotes);
  const preparationMinutes = extractMinutes(rawNotes, 'Preparazione');
  const cookMinutes = extractMinutes(rawNotes, 'Cottura');
  const detailEntry = [
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    note ?? null,
    packIngredientLines(ingredients),
    instructionText,
    instructionPreview,
    originPlaces,
    preparationMinutes ?? null,
    cookMinutes ?? null,
    detailChunk,
  ];
  const summaryEntry = [
    id,
    title,
    category,
    primaryIngredient,
    primaryIngredientNormalized,
    servingsText,
    note ? note.slice(0, 180) : null,
    packIngredientLines(ingredientPreview),
    instructionPreview,
    originPlaces,
    preparationMinutes ?? null,
    cookMinutes ?? null,
    detailChunk,
  ];

  entries.push(summaryEntry);
  lookupEntries.push([id, title, detailChunk, servingsText]);
  const chunkEntries = detailChunks.get(detailChunk) ?? [];
  chunkEntries.push(detailEntry);
  detailChunks.set(detailChunk, chunkEntries);
}

fs.writeFileSync(
  targetPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceFile: 'old/data/RicetteOriginal.txt',
      sourceRecordCount,
      entryCount: entries.length,
      entries,
    },
  ),
);

fs.writeFileSync(
  lookupPath,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    entryCount: lookupEntries.length,
    entries: lookupEntries,
  }),
);

for (const [chunkKey, chunkEntries] of detailChunks.entries()) {
  fs.writeFileSync(
    path.join(detailsDirPath, `${chunkKey}.json`),
    JSON.stringify(
      {
        entryCount: chunkEntries.length,
        entries: chunkEntries,
      },
    ),
  );
}

console.log(`Generated ${entries.length} support recipes in ${path.relative(process.cwd(), targetPath)}`);
