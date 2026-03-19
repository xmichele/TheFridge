import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

import { RecipeEditor } from '@/components/forms/RecipeEditor';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ingredientNutritionSeed } from '@/data/ingredientNutritionSeed';
import { recipeRepository } from '@/data/repositories';
import { createRecipe, updateRecipe } from '@/data/services/recipeService';
import { useToast } from '@/app/ToastProvider';

export default function RecipeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const recipes = useLiveQuery(() => recipeRepository.list(), [], []);
  const recipe = useLiveQuery(async () => {
    if (!id) {
      return null;
    }

    return (await recipeRepository.get(id)) ?? null;
  }, [id]);
  const { showToast } = useToast();
  const categorySuggestions = Array.from(
    new Set(recipes.map((entry) => entry.category?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right, 'it'));
  const ingredientSuggestions = Array.from(
    new Set(
      [
        ...recipes.flatMap((entry) => entry.ingredients.map((ingredient) => ingredient.displayName.trim())),
        ...ingredientNutritionSeed.map((entry) => entry.displayName),
      ].filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'it'));

  if (isEdit && recipe === undefined) {
    return <div className="loading-card">Caricamento ricetta...</div>;
  }

  if (isEdit && !recipe) {
    return (
      <EmptyState
        title="Ricetta non trovata"
        description="La ricetta richiesta non esiste piu o e stata rimossa."
      />
    );
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={isEdit ? 'Modifica ricetta' : 'Nuova ricetta'}
        title={isEdit ? 'Aggiorna ricetta' : 'Crea una nuova ricetta'}
        description="Mantieni ingredienti, step e porzioni in un formato pronto per planner e spesa."
      />

      <RecipeEditor
        initialRecipe={recipe ?? null}
        categorySuggestions={categorySuggestions}
        ingredientSuggestions={ingredientSuggestions}
        submitLabel={isEdit ? 'Salva modifiche' : 'Crea ricetta'}
        onSubmit={async (input) => {
          if (isEdit && id) {
            await updateRecipe(id, input);
            showToast({ tone: 'success', title: 'Ricetta aggiornata' });
            navigate(`/recipes/${id}`);
            return;
          }

          await createRecipe(input);
          showToast({ tone: 'success', title: 'Ricetta creata' });
          navigate('/recipes');
        }}
      />
    </div>
  );
}
