import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ingredientNutritionSeed } from '@/data/ingredientNutritionSeed';
import { recipeRepository } from '@/data/repositories';
import { deleteRecipe, duplicateRecipe } from '@/data/services/recipeService';
import { useToast } from '@/app/ToastProvider';
import { formatRelativeTime } from '@/domain/display';
import { normalizeIngredientName } from '@/domain/normalization';

const IGNORED_INGREDIENT_SUGGESTIONS = new Set([
  'sale',
  'olio',
  'olio d oliva',
  'olio d oliva extra vergine',
  'olio extravergine',
  'aceto',
  'pepe',
  'aglio',
  'rosmarino',
  'origano',
  'prezzemolo',
  'basilico',
]);

export default function RecipesPage() {
  const recipes = useLiveQuery(() => recipeRepository.list(), [], []);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [ingredientSuggestionLimit, setIngredientSuggestionLimit] = useState(30);
  const { showToast } = useToast();

  useEffect(() => {
    function updateSuggestionLimit() {
      setIngredientSuggestionLimit(window.innerWidth < 720 ? 20 : 30);
    }

    updateSuggestionLimit();
    window.addEventListener('resize', updateSuggestionLimit);

    return () => {
      window.removeEventListener('resize', updateSuggestionLimit);
    };
  }, []);

  const categories = useMemo(
    () =>
      Array.from(new Set(recipes.map((recipe) => recipe.category).filter(Boolean))).sort((left, right) =>
        left!.localeCompare(right!, 'it'),
      ),
    [recipes],
  );

  const tags = useMemo(
    () =>
      Array.from(new Set(recipes.flatMap((recipe) => recipe.tags ?? []))).sort((left, right) =>
        left.localeCompare(right, 'it'),
      ),
    [recipes],
  );

  const ingredientSuggestions = useMemo(
    () => {
      const counts = new Map<string, { label: string; count: number }>();

      recipes.forEach((recipe) => {
        recipe.ingredients.forEach((ingredient) => {
          const normalized = normalizeIngredientName(ingredient.displayName);
          if (!normalized || IGNORED_INGREDIENT_SUGGESTIONS.has(normalized)) {
            return;
          }

          const current = counts.get(normalized);
          counts.set(normalized, {
            label: current?.label ?? ingredient.displayName.trim(),
            count: (current?.count ?? 0) + 1,
          });
        });
      });

      ingredientNutritionSeed.forEach((entry) => {
        if (!counts.has(entry.normalizedName) && !IGNORED_INGREDIENT_SUGGESTIONS.has(entry.normalizedName)) {
          counts.set(entry.normalizedName, {
            label: entry.displayName,
            count: 0,
          });
        }
      });

      return Array.from(counts.values())
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.label.localeCompare(right.label, 'it');
        })
        .slice(0, ingredientSuggestionLimit)
        .map((item) => item.label);
    },
    [ingredientSuggestionLimit, recipes],
  );

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = categoryFilter === 'all' || recipe.category === categoryFilter;
    const matchesTag = tagFilter === 'all' || recipe.tags?.includes(tagFilter);
    const normalizedIngredientFilter = normalizeIngredientName(ingredientFilter);
    const matchesIngredient =
      !normalizedIngredientFilter ||
      recipe.ingredients.some((ingredient) => {
        const normalizedIngredient = normalizeIngredientName(ingredient.displayName);
        return (
          normalizedIngredient.includes(normalizedIngredientFilter) ||
          normalizedIngredientFilter.includes(normalizedIngredient)
        );
      });
    return matchesSearch && matchesCategory && matchesTag && matchesIngredient;
  });

  async function handleDuplicate(id: string) {
    await duplicateRecipe(id);
    showToast({
      tone: 'success',
      title: 'Ricetta duplicata',
      description: 'La copia e pronta nell elenco ricette.',
    });
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questa ricetta?')) {
      return;
    }

    await deleteRecipe(id);
    showToast({
      tone: 'success',
      title: 'Ricetta eliminata',
    });
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Ricette personali"
        title="Ricette Personali"
        description="Cerca, filtra, duplica e mantieni le tue ricette pronte per planner e spesa."
        actions={
          <NavLink className="button" to="/recipes/new">
            Nuova ricetta
          </NavLink>
        }
      />

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Cerca per titolo</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Es. pasta" />
            <small className="field-hint">La ricerca qui considera solo il titolo della ricetta.</small>
          </label>
          <label>
            <span>Categoria</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Tutte</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">Tutti</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Ingrediente di base</span>
            <input
              list="recipe-ingredient-filter-list"
              value={ingredientFilter}
              onChange={(event) => setIngredientFilter(event.target.value)}
              placeholder="Es. Farina, Zucchine, Pesce spada"
            />
            <small className="field-hint">Filtra le ricette che contengono quell'ingrediente nella lista ingredienti.</small>
          </label>
        </div>
        <datalist id="recipe-ingredient-filter-list">
          {ingredientSuggestions.map((ingredient) => (
            <option key={ingredient} value={ingredient} />
          ))}
        </datalist>
      </section>

      {filteredRecipes.length === 0 ? (
        <EmptyState
          title="Nessuna ricetta trovata"
          description="Prova un filtro diverso oppure crea una nuova ricetta per iniziare."
        >
          <NavLink className="button" to="/recipes/new">
            Crea ricetta
          </NavLink>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {filteredRecipes.map((recipe) => (
            <article key={recipe.id} className="list-card">
              <div className="card-header">
                <div>
                  <h2>{recipe.title}</h2>
                  <p>
                    {recipe.servings} porzioni
                    {recipe.category ? ` • ${recipe.category}` : ''}
                  </p>
                </div>
                <StatusBadge>{formatRelativeTime(recipe.updatedAt)}</StatusBadge>
              </div>

              {recipe.description ? <p>{recipe.description}</p> : null}

              <div className="badge-row">
                {(recipe.tags ?? []).map((tag) => (
                  <StatusBadge key={tag}>{tag}</StatusBadge>
                ))}
              </div>

              <div className="meta-row">
                <span>{recipe.ingredients.length} ingredienti</span>
                <span>{recipe.steps.length} step</span>
              </div>

              <div className="inline-actions">
                <Link className="button button-secondary" to={`/recipes/${recipe.id}`}>
                  Apri
                </Link>
                <Link className="button button-ghost" to={`/recipes/${recipe.id}/edit`}>
                  Modifica
                </Link>
                <button className="button button-ghost" onClick={() => handleDuplicate(recipe.id)}>
                  Duplica
                </button>
                <button className="button button-danger" onClick={() => handleDelete(recipe.id)}>
                  Elimina
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
