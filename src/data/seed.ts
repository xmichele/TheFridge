import { addDays, format, subDays } from 'date-fns';

import { DEMO_SEED_VERSION } from '@/domain/models';
import type {
  AppExportPayload,
  AppSetting,
  MealPlan,
  PantryItem,
  Recipe,
  ShoppingItem,
} from '@/domain/models';
import { normalizeIngredientName } from '@/domain/normalization';

function isoTimestamp(date: Date): string {
  return date.toISOString();
}

function dateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function pantryItem(
  id: string,
  displayName: string,
  quantity: number,
  unit: PantryItem['unit'],
  extra: Partial<PantryItem>,
): PantryItem {
  return {
    id,
    displayName,
    normalizedName: normalizeIngredientName(displayName),
    quantity,
    unit,
    createdAt: extra.createdAt ?? new Date().toISOString(),
    updatedAt: extra.updatedAt ?? new Date().toISOString(),
    ...extra,
  };
}

function recipeIngredient(
  displayName: string,
  quantity: number,
  unit: PantryItem['unit'],
  optional = false,
) {
  return {
    id: crypto.randomUUID(),
    displayName,
    normalizedName: normalizeIngredientName(displayName),
    quantity,
    unit,
    optional: optional || undefined,
  };
}

function recipe(
  id: string,
  title: string,
  servings: number,
  ingredients: ReturnType<typeof recipeIngredient>[],
  steps: string[],
  extra: Partial<Recipe>,
): Recipe {
  return {
    id,
    title,
    servings,
    ingredients,
    steps,
    createdAt: extra.createdAt ?? new Date().toISOString(),
    updatedAt: extra.updatedAt ?? new Date().toISOString(),
    ...extra,
  };
}

export function createDemoSeed(now = new Date()): AppExportPayload {
  const yesterday = subDays(now, 1);
  const twoDaysAgo = subDays(now, 2);
  const threeDaysAgo = subDays(now, 3);

  const timestamps = {
    older: isoTimestamp(threeDaysAgo),
    old: isoTimestamp(twoDaysAgo),
    recent: isoTimestamp(yesterday),
    now: isoTimestamp(now),
  };

  const pantryItems: PantryItem[] = [
    pantryItem('pantry-pasta', 'Pasta secca', 750, 'g', {
      category: 'Dispensa',
      minThreshold: 300,
      createdAt: timestamps.older,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-riso', 'Riso arborio', 600, 'g', {
      category: 'Dispensa',
      minThreshold: 250,
      createdAt: timestamps.older,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-passata', 'Passata di pomodoro', 700, 'ml', {
      category: 'Conserve',
      minThreshold: 400,
      createdAt: timestamps.old,
      updatedAt: timestamps.now,
    }),
    pantryItem('pantry-parmigiano', 'Parmigiano', 180, 'g', {
      category: 'Frigo',
      minThreshold: 80,
      expirationDate: dateOnly(addDays(now, 2)),
      createdAt: timestamps.old,
      updatedAt: timestamps.now,
    }),
    pantryItem('pantry-uova', 'Uova', 6, 'pcs', {
      category: 'Frigo',
      minThreshold: 4,
      expirationDate: dateOnly(addDays(now, 5)),
      createdAt: timestamps.old,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-latte', 'Latte fresco', 1, 'l', {
      category: 'Frigo',
      minThreshold: 0.5,
      expirationDate: dateOnly(addDays(now, 1)),
      createdAt: timestamps.recent,
      updatedAt: timestamps.now,
    }),
    pantryItem('pantry-ceci', 'Ceci cotti', 400, 'g', {
      category: 'Conserve',
      minThreshold: 200,
      createdAt: timestamps.old,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-yogurt', 'Yogurt bianco', 2, 'pcs', {
      category: 'Frigo',
      minThreshold: 2,
      expirationDate: dateOnly(addDays(now, 4)),
      createdAt: timestamps.recent,
      updatedAt: timestamps.now,
    }),
    pantryItem('pantry-carote', 'Carote', 500, 'g', {
      category: 'Verdure',
      expirationDate: dateOnly(addDays(now, 4)),
      createdAt: timestamps.recent,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-cipolla', 'Cipolla dorata', 300, 'g', {
      category: 'Verdure',
      createdAt: timestamps.recent,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-olio', 'Olio extravergine', 750, 'ml', {
      category: 'Dispensa',
      minThreshold: 250,
      createdAt: timestamps.older,
      updatedAt: timestamps.recent,
    }),
    pantryItem('pantry-avena', "Fiocchi d'avena", 350, 'g', {
      category: 'Dispensa',
      minThreshold: 120,
      createdAt: timestamps.recent,
      updatedAt: timestamps.now,
    }),
  ];

  const recipes: Recipe[] = [
    recipe(
      'recipe-pasta-pomodoro',
      'Pasta al pomodoro e basilico',
      2,
      [
        recipeIngredient('Pasta secca', 320, 'g'),
        recipeIngredient('Passata di pomodoro', 500, 'ml'),
        recipeIngredient('Olio extravergine', 2, 'tbsp'),
        recipeIngredient('Parmigiano', 40, 'g', true),
        recipeIngredient('Basilico', 4, 'pcs', true),
      ],
      [
        'Scalda la passata con un cucchiaio di olio e un pizzico di sale.',
        'Cuoci la pasta in acqua bollente.',
        'Salta la pasta con il sugo e completa con basilico e parmigiano.',
      ],
      {
        category: 'Primi',
        tags: ['veloce', 'classico'],
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        description: 'Una pasta semplice da tenere pronta anche nei giorni pieni.',
        createdAt: timestamps.older,
        updatedAt: timestamps.recent,
      },
    ),
    recipe(
      'recipe-frittata-zucchine',
      'Frittata alle zucchine',
      2,
      [
        recipeIngredient('Uova', 4, 'pcs'),
        recipeIngredient('Zucchine', 300, 'g'),
        recipeIngredient('Latte fresco', 30, 'ml'),
        recipeIngredient('Parmigiano', 30, 'g'),
        recipeIngredient('Olio extravergine', 1, 'tbsp'),
      ],
      [
        'Taglia le zucchine e falle rosolare.',
        'Sbatti le uova con latte e parmigiano.',
        'Versa il composto in padella e cuoci a fuoco basso.',
      ],
      {
        category: 'Secondi',
        tags: ['frigo', 'veloce'],
        prepTimeMinutes: 12,
        cookTimeMinutes: 12,
        createdAt: timestamps.old,
        updatedAt: timestamps.now,
      },
    ),
    recipe(
      'recipe-overnight-oats',
      'Overnight oats mela e yogurt',
      2,
      [
        recipeIngredient("Fiocchi d'avena", 120, 'g'),
        recipeIngredient('Latte fresco', 250, 'ml'),
        recipeIngredient('Yogurt bianco', 2, 'pcs'),
        recipeIngredient('Mela', 2, 'pcs'),
        recipeIngredient('Miele', 2, 'tbsp', true),
      ],
      [
        'Mescola avena e latte in un contenitore.',
        'Aggiungi yogurt e lascia riposare in frigo tutta la notte.',
        'Completa con mela a cubetti e miele prima di servire.',
      ],
      {
        category: 'Colazioni',
        tags: ['meal-prep', 'dolce'],
        prepTimeMinutes: 10,
        cookTimeMinutes: 0,
        createdAt: timestamps.older,
        updatedAt: timestamps.recent,
      },
    ),
    recipe(
      'recipe-zuppa-ceci',
      'Zuppa di ceci e carote',
      3,
      [
        recipeIngredient('Ceci cotti', 500, 'g'),
        recipeIngredient('Carote', 250, 'g'),
        recipeIngredient('Cipolla dorata', 150, 'g'),
        recipeIngredient('Brodo vegetale', 800, 'ml'),
        recipeIngredient('Olio extravergine', 1, 'tbsp'),
      ],
      [
        'Rosola cipolla e carote con l olio.',
        'Aggiungi ceci e brodo vegetale.',
        'Cuoci per 25 minuti e frulla una piccola parte per addensare.',
      ],
      {
        category: 'Zuppe',
        tags: ['batch-cooking', 'legumi'],
        prepTimeMinutes: 15,
        cookTimeMinutes: 25,
        createdAt: timestamps.old,
        updatedAt: timestamps.recent,
      },
    ),
    recipe(
      'recipe-risotto',
      'Risotto al parmigiano',
      4,
      [
        recipeIngredient('Riso arborio', 320, 'g'),
        recipeIngredient('Brodo vegetale', 1000, 'ml'),
        recipeIngredient('Parmigiano', 80, 'g'),
        recipeIngredient('Cipolla dorata', 80, 'g'),
        recipeIngredient('Burro', 30, 'g', true),
      ],
      [
        'Tosta il riso con la cipolla tritata.',
        'Aggiungi brodo poco per volta mescolando.',
        'Manteca con parmigiano e burro a fine cottura.',
      ],
      {
        category: 'Primi',
        tags: ['comfort', 'weekend'],
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        createdAt: timestamps.old,
        updatedAt: timestamps.old,
      },
    ),
    recipe(
      'recipe-insalata-tonno-fagioli',
      'Insalata tonno e fagioli',
      2,
      [
        recipeIngredient('Fagioli cannellini', 300, 'g'),
        recipeIngredient('Tonno', 200, 'g'),
        recipeIngredient('Pomodorini', 250, 'g'),
        recipeIngredient('Olio extravergine', 1, 'tbsp'),
        recipeIngredient('Limone', 1, 'pcs', true),
      ],
      [
        'Scola fagioli e tonno.',
        'Unisci pomodorini e condimento.',
        'Lascia riposare cinque minuti prima di servire.',
      ],
      {
        category: 'Piatti unici',
        tags: ['estate', 'senza-cottura'],
        prepTimeMinutes: 10,
        cookTimeMinutes: 0,
        createdAt: timestamps.recent,
        updatedAt: timestamps.now,
      },
    ),
  ];

  const mealPlans: MealPlan[] = [
    {
      id: 'plan-today-dinner',
      date: dateOnly(now),
      slot: 'dinner',
      recipeId: 'recipe-pasta-pomodoro',
      servings: 2,
      status: 'planned',
      createdAt: timestamps.recent,
      updatedAt: timestamps.recent,
    },
    {
      id: 'plan-tomorrow-lunch',
      date: dateOnly(addDays(now, 1)),
      slot: 'lunch',
      recipeId: 'recipe-zuppa-ceci',
      servings: 3,
      status: 'planned',
      createdAt: timestamps.recent,
      updatedAt: timestamps.now,
    },
  ];

  const shoppingItems: ShoppingItem[] = [
    {
      id: 'shopping-mele',
      displayName: 'Mele',
      normalizedName: normalizeIngredientName('Mele'),
      quantity: 4,
      unit: 'pcs',
      checked: false,
      sourceType: 'manual',
      notes: 'Per colazioni e snack',
      createdAt: timestamps.recent,
      updatedAt: timestamps.recent,
    },
    {
      id: 'shopping-zucchine',
      displayName: 'Zucchine',
      normalizedName: normalizeIngredientName('Zucchine'),
      quantity: 300,
      unit: 'g',
      checked: false,
      sourceType: 'recipe-missing',
      sourceRefId: 'recipe-frittata-zucchine',
      createdAt: timestamps.now,
      updatedAt: timestamps.now,
    },
  ];

  const appSettings: AppSetting[] = [
    {
      key: 'language',
      value: 'it',
      updatedAt: timestamps.now,
    },
    {
      key: 'demoSeedVersion',
      value: DEMO_SEED_VERSION,
      updatedAt: timestamps.now,
    },
    {
      key: 'accountArea',
      value: {
        provider: null,
        status: 'guest',
      },
      updatedAt: timestamps.now,
    },
  ];

  return {
    version: 1,
    exportedAt: timestamps.now,
    pantryItems,
    recipes,
    mealPlans,
    shoppingItems,
    inventoryMovements: [],
    appSettings,
  };
}
