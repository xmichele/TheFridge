import { normalizeIngredientName } from '@/domain/normalization';
import ingredientNutritionSeedData from '@/data/ingredientNutritionSeedData.json';

export interface IngredientNutritionSeedEntry {
  displayName: string;
  normalizedName: string;
  pdfSection?: string;
  aliases: string[];
  waterPer100g?: number;
  caloriesPer100g: number;
  energyKjPer100g?: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g?: number;
  sodiumMgPer100g?: number;
  potassiumMgPer100g?: number;
  ironMgPer100g?: number;
  calciumMgPer100g?: number;
  phosphorusMgPer100g?: number;
  vitaminAUgPer100g?: number;
  vitaminCMgPer100g?: number;
  vitaminEMgPer100g?: number;
  highFiber?: boolean;
  highVitamins?: boolean;
  densityGramsPerMl?: number;
  gramsPerPiece?: number;
  gramsPerTablespoon?: number;
  gramsPerTeaspoon?: number;
}

interface IngredientNutritionSeedDataEntry
  extends Omit<IngredientNutritionSeedEntry, 'normalizedName' | 'aliases'> {
  aliases?: string[];
}

function nutritionEntry(entry: IngredientNutritionSeedDataEntry): IngredientNutritionSeedEntry {
  return {
    displayName: entry.displayName,
    normalizedName: normalizeIngredientName(entry.displayName),
    pdfSection: entry.pdfSection,
    aliases: (entry.aliases ?? []).map(normalizeIngredientName),
    waterPer100g: entry.waterPer100g,
    caloriesPer100g: entry.caloriesPer100g,
    energyKjPer100g: entry.energyKjPer100g,
    proteinPer100g: entry.proteinPer100g,
    fatPer100g: entry.fatPer100g,
    carbsPer100g: entry.carbsPer100g,
    fiberPer100g: entry.fiberPer100g,
    sodiumMgPer100g: entry.sodiumMgPer100g,
    potassiumMgPer100g: entry.potassiumMgPer100g,
    ironMgPer100g: entry.ironMgPer100g,
    calciumMgPer100g: entry.calciumMgPer100g,
    phosphorusMgPer100g: entry.phosphorusMgPer100g,
    vitaminAUgPer100g: entry.vitaminAUgPer100g,
    vitaminCMgPer100g: entry.vitaminCMgPer100g,
    vitaminEMgPer100g: entry.vitaminEMgPer100g,
    highFiber: entry.highFiber,
    highVitamins: entry.highVitamins,
    densityGramsPerMl: entry.densityGramsPerMl,
    gramsPerPiece: entry.gramsPerPiece,
    gramsPerTablespoon: entry.gramsPerTablespoon,
    gramsPerTeaspoon: entry.gramsPerTeaspoon,
  };
}

export const ingredientNutritionSeed: IngredientNutritionSeedEntry[] = ingredientNutritionSeedData.map(nutritionEntry);
