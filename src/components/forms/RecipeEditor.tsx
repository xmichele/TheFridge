import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import type { Recipe } from '@/domain/models';
import { UNIT_OPTIONS } from '@/domain/models';
import type { RecipeInput } from '@/data/services/recipeService';
import { formatUnitLabel } from '@/domain/units';
import { recipeInputSchema } from '@/validation/schemas';

interface IngredientField {
  id: string;
  displayName: string;
  quantity: string;
  unit: (typeof UNIT_OPTIONS)[number];
  optional: boolean;
}

interface RecipeEditorProps {
  initialRecipe?: Recipe | null;
  categorySuggestions?: string[];
  ingredientSuggestions?: string[];
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}

function emptyIngredient(): IngredientField {
  return {
    id: crypto.randomUUID(),
    displayName: '',
    quantity: '',
    unit: 'g',
    optional: false,
  };
}

export function RecipeEditor({
  initialRecipe,
  categorySuggestions = [],
  ingredientSuggestions = [],
  submitLabel,
  onSubmit,
}: RecipeEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [servings, setServings] = useState('2');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientField[]>([emptyIngredient()]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!initialRecipe) {
      return;
    }

    setTitle(initialRecipe.title);
    setDescription(initialRecipe.description ?? '');
    setCategory(initialRecipe.category ?? '');
    setTags(initialRecipe.tags?.join(', ') ?? '');
    setServings(String(initialRecipe.servings));
    setPrepTimeMinutes(initialRecipe.prepTimeMinutes ? String(initialRecipe.prepTimeMinutes) : '');
    setCookTimeMinutes(initialRecipe.cookTimeMinutes ? String(initialRecipe.cookTimeMinutes) : '');
    setNotes(initialRecipe.notes ?? '');
    setIngredients(
      initialRecipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        displayName: ingredient.displayName,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
        optional: Boolean(ingredient.optional),
      })),
    );
    setSteps(initialRecipe.steps.length > 0 ? initialRecipe.steps : ['']);
  }, [initialRecipe]);

  function updateIngredient(id: string, partial: Partial<IngredientField>) {
    setIngredients((current) =>
      current.map((ingredient) => (ingredient.id === id ? { ...ingredient, ...partial } : ingredient)),
    );
  }

  function updateStep(index: number, value: string) {
    setSteps((current) => current.map((step, currentIndex) => (currentIndex === index ? value : step)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const parsed = recipeInputSchema.safeParse({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      servings: Number(servings),
      ingredients: ingredients.map((ingredient) => ({
        id: ingredient.id,
        displayName: ingredient.displayName.trim(),
        quantity: Number(ingredient.quantity),
        unit: ingredient.unit,
        optional: ingredient.optional,
      })),
      steps: steps.map((step) => step.trim()).filter(Boolean),
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : undefined,
      cookTimeMinutes: cookTimeMinutes ? Number(cookTimeMinutes) : undefined,
      notes: notes.trim() || undefined,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Controlla i campi della ricetta.');
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossibile salvare la ricetta.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Titolo</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            <span>Categoria</span>
            <input
              list="recipe-category-suggestions"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Es. Primi, Pesce, Dessert"
            />
          </label>
          <label>
            <span>Porzioni</span>
            <input
              type="number"
              min="1"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Tag</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="veloce, meal-prep, frigo"
            />
          </label>
          <label>
            <span>Preparazione (min)</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={prepTimeMinutes}
              onChange={(event) => setPrepTimeMinutes(event.target.value)}
            />
          </label>
          <label>
            <span>Cottura (min)</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={cookTimeMinutes}
              onChange={(event) => setCookTimeMinutes(event.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Descrizione</span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Spiega quando usarla o perche e comoda."
          />
        </label>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Ingredienti</h2>
            <p>Aggiungi, rimuovi o marca come opzionali.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={() => setIngredients((current) => [...current, emptyIngredient()])}>
            Aggiungi ingrediente
          </button>
        </div>

        <div className="stack-md">
          {ingredients.map((ingredient, index) => (
            <div key={ingredient.id} className="recipe-row">
              <label>
                <span>Ingrediente {index + 1}</span>
                <input
                  list="recipe-ingredient-suggestions"
                  value={ingredient.displayName}
                  onChange={(event) => updateIngredient(ingredient.id, { displayName: event.target.value })}
                  placeholder="Es. Farina 00, Pesce spada, Zucchine"
                  required
                />
              </label>
              <label>
                <span>Quantita</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(event) => updateIngredient(ingredient.id, { quantity: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Unita</span>
                <select
                  value={ingredient.unit}
                  onChange={(event) =>
                    updateIngredient(ingredient.id, {
                      unit: event.target.value as IngredientField['unit'],
                    })
                  }
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {formatUnitLabel(unit)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={ingredient.optional}
                  onChange={(event) => updateIngredient(ingredient.id, { optional: event.target.checked })}
                />
                <span>Opzionale</span>
              </label>
              <button
                className="button button-ghost"
                type="button"
                onClick={() =>
                  setIngredients((current) =>
                    current.length === 1 ? [emptyIngredient()] : current.filter((item) => item.id !== ingredient.id),
                  )
                }
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Procedimento</h2>
            <p>Gli step possono essere riordinati.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={() => setSteps((current) => [...current, ''])}>
            Aggiungi step
          </button>
        </div>

        <div className="stack-md">
          {steps.map((step, index) => (
            <div key={`${index}-${step}`} className="step-row">
              <label>
                <span>Step {index + 1}</span>
                <textarea rows={3} value={step} onChange={(event) => updateStep(index, event.target.value)} />
              </label>
              <div className="inline-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  disabled={index === 0}
                  onClick={() =>
                    setSteps((current) => {
                      const next = [...current];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })
                  }
                >
                  Su
                </button>
                <button
                  className="button button-ghost"
                  type="button"
                  disabled={index === steps.length - 1}
                  onClick={() =>
                    setSteps((current) => {
                      const next = [...current];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      return next;
                    })
                  }
                >
                  Giu
                </button>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setSteps((current) => (current.length === 1 ? [''] : current.filter((_, stepIndex) => stepIndex !== index)))}
                >
                  Rimuovi
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <label>
          <span>Note</span>
          <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </section>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <datalist id="recipe-category-suggestions">
        {categorySuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>

      <datalist id="recipe-ingredient-suggestions">
        {ingredientSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>

      <div className="inline-actions">
        <button className="button" type="submit" disabled={isSaving}>
          {isSaving ? 'Salvataggio...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
