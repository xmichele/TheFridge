import { z } from 'zod';

import {
  APP_DATA_VERSION,
  MEAL_PLAN_SOURCE_OPTIONS,
  MEAL_PLAN_STATUS_OPTIONS,
  MEAL_SLOT_OPTIONS,
  MOVEMENT_REASON_OPTIONS,
  SHOPPING_SOURCE_OPTIONS,
  UNIT_OPTIONS,
} from '@/domain/models';

const isoDateString = z.string().datetime({ offset: true }).or(z.string().datetime());

export const unitSchema = z.enum(UNIT_OPTIONS);

export const pantryItemSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  normalizedName: z.string().min(1),
  quantity: z.number().min(0),
  unit: unitSchema,
  category: z.string().min(1).optional(),
  minThreshold: z.number().min(0).optional(),
  expirationDate: z.string().date().optional(),
  notes: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const pantryItemInputSchema = z.object({
  displayName: z.string().min(1, 'Inserisci il nome ingrediente.'),
  quantity: z.number().min(0, 'La quantita non puo essere negativa.'),
  unit: unitSchema,
  category: z.string().optional(),
  minThreshold: z.number().min(0, 'La soglia minima non puo essere negativa.').optional(),
  expirationDate: z.string().date().optional().or(z.literal('')).transform((value) => value || undefined),
  notes: z.string().optional(),
});

export const recipeIngredientSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  normalizedName: z.string().min(1),
  quantity: z.number().positive(),
  unit: unitSchema,
  optional: z.boolean().optional(),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  servings: z.number().int().positive(),
  ingredients: z.array(recipeIngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const recipeInputSchema = z.object({
  title: z.string().min(1, 'Inserisci il titolo della ricetta.'),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  servings: z.number().int().positive('Le porzioni devono essere maggiori di zero.'),
  ingredients: z
    .array(
      z.object({
        id: z.string().optional(),
        displayName: z.string().min(1, 'Ogni ingrediente deve avere un nome.'),
        quantity: z.number().positive('La quantita ingrediente deve essere positiva.'),
        unit: unitSchema,
        optional: z.boolean().optional(),
      }),
    )
    .min(1, 'Aggiungi almeno un ingrediente.'),
  steps: z.array(z.string().min(1)).min(1, 'Aggiungi almeno uno step.'),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const mealPlanSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  slot: z.enum(MEAL_SLOT_OPTIONS),
  recipeId: z.string().min(1),
  recipeTitle: z.string().min(1).optional(),
  recipeSource: z.enum(MEAL_PLAN_SOURCE_OPTIONS).optional(),
  servings: z.number().int().positive(),
  status: z.enum(MEAL_PLAN_STATUS_OPTIONS),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const mealPlanInputSchema = z.object({
  date: z.string().date(),
  slot: z.enum(MEAL_SLOT_OPTIONS),
  recipeId: z.string().min(1, 'Seleziona una ricetta.'),
  recipeTitle: z.string().min(1).optional(),
  recipeSource: z.enum(MEAL_PLAN_SOURCE_OPTIONS).optional(),
  servings: z.number().int().positive('Le porzioni devono essere maggiori di zero.'),
});

export const shoppingItemSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  normalizedName: z.string().min(1),
  quantity: z.number().min(0),
  unit: unitSchema,
  checked: z.boolean(),
  sourceType: z.enum(SHOPPING_SOURCE_OPTIONS),
  sourceRefId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const shoppingItemInputSchema = z.object({
  displayName: z.string().min(1, 'Inserisci il nome prodotto.'),
  quantity: z.number().min(0, 'La quantita non puo essere negativa.'),
  unit: unitSchema,
  notes: z.string().optional(),
});

export const inventoryMovementSchema = z.object({
  id: z.string().min(1),
  ingredientNormalizedName: z.string().min(1),
  ingredientDisplayName: z.string().min(1),
  delta: z.number(),
  unit: unitSchema,
  reason: z.enum(MOVEMENT_REASON_OPTIONS),
  createdAt: isoDateString,
  referenceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: isoDateString,
});

export const appExportSchema = z.object({
  version: z.literal(APP_DATA_VERSION),
  exportedAt: isoDateString,
  pantryItems: z.array(pantryItemSchema),
  recipes: z.array(recipeSchema),
  mealPlans: z.array(mealPlanSchema),
  shoppingItems: z.array(shoppingItemSchema),
  inventoryMovements: z.array(inventoryMovementSchema),
  appSettings: z.array(appSettingSchema),
});
