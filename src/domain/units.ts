import type { Unit } from '@/domain/models';

const UNIT_FAMILIES: Record<Unit, 'mass' | 'volume' | 'exact'> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  pcs: 'exact',
  tbsp: 'exact',
  tsp: 'exact',
};

const BASE_CONVERSIONS: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  pcs: 'pz',
  tbsp: 'cucchiaio',
  tsp: 'cucchiaino',
};

export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function areUnitsCompatible(from: Unit, to: Unit): boolean {
  if (from === to) {
    return true;
  }

  return UNIT_FAMILIES[from] !== 'exact' && UNIT_FAMILIES[from] === UNIT_FAMILIES[to];
}

export function convertQuantity(value: number, from: Unit, to: Unit): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (from === to) {
    return roundQuantity(value);
  }

  if (!areUnitsCompatible(from, to)) {
    return null;
  }

  const fromBase = BASE_CONVERSIONS[from];
  const toBase = BASE_CONVERSIONS[to];

  if (!fromBase || !toBase) {
    return null;
  }

  return roundQuantity((value * fromBase) / toBase);
}

export function sumCompatibleQuantities(
  entries: Array<{ quantity: number; unit: Unit }>,
  targetUnit: Unit,
): number {
  return roundQuantity(
    entries.reduce((total, entry) => {
      const converted = convertQuantity(entry.quantity, entry.unit, targetUnit);
      return converted === null ? total : total + converted;
    }, 0),
  );
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatUnitLabel(unit: Unit): string {
  return UNIT_LABELS[unit];
}
