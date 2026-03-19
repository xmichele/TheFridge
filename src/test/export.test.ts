import { describe, expect, it } from 'vitest';

import { createDemoSeed } from '@/data/seed';
import { createExportPayload, parseImportPayload } from '@/domain/export';

describe('import/export roundtrip', () => {
  it('validates and round-trips a versioned export payload', () => {
    const payload = createDemoSeed(new Date('2026-03-18T12:00:00.000Z'));
    const exported = createExportPayload(payload);
    const roundTrip = parseImportPayload(JSON.stringify(exported));

    expect(roundTrip.success).toBe(true);
    if (!roundTrip.success) {
      return;
    }

    expect(roundTrip.data.version).toBe(payload.version);
    expect(roundTrip.data.pantryItems).toHaveLength(payload.pantryItems.length);
    expect(roundTrip.data.recipes).toHaveLength(payload.recipes.length);
  });
});
