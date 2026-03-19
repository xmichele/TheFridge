import type { AppExportPayload } from '@/domain/models';
import { appExportSchema } from '@/validation/schemas';

export function createExportPayload(payload: AppExportPayload): AppExportPayload {
  return appExportSchema.parse(payload);
}

export function parseImportPayload(raw: string):
  | { success: true; data: AppExportPayload }
  | { success: false; error: string } {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      success: false,
      error: 'Il file non contiene JSON valido.',
    };
  }

  const parsed = appExportSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Il file importato non e valido.',
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
