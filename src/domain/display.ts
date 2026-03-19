import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

import type { MealSlot, MovementReason, ShoppingSourceType } from '@/domain/models';

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Snack',
};

export const SHOPPING_SOURCE_LABELS: Record<ShoppingSourceType, string> = {
  manual: 'Manuale',
  'recipe-missing': 'Mancanti ricetta',
  'consumption-deficit': 'Deficit consumo',
};

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  'manual-pantry-add': 'Aggiunta manuale',
  'manual-pantry-edit': 'Modifica manuale',
  'manual-pantry-delete': 'Eliminazione dispensa',
  'meal-consumption': 'Consumo pasto',
  'shopping-to-pantry-transfer': 'Trasferimento dalla spesa',
  import: 'Import dati',
  reset: 'Reset demo',
};

export function formatDateLabel(date: string, pattern = 'dd MMM'): string {
  return format(parseISO(date), pattern, { locale: it });
}

export function formatDayLabel(date: string): string {
  return format(parseISO(date), 'EEE dd MMM', { locale: it });
}

export function formatDateTimeLabel(dateTime: string): string {
  return format(parseISO(dateTime), 'dd MMM yyyy, HH:mm', { locale: it });
}

export function formatRelativeTime(dateTime: string): string {
  return formatDistanceToNow(parseISO(dateTime), { addSuffix: true, locale: it });
}
