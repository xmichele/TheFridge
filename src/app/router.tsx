import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '@/app/layout/AppShell';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const PantryPage = lazy(() => import('@/pages/PantryPage'));
const RecipesPage = lazy(() => import('@/pages/RecipesPage'));
const RecipeFormPage = lazy(() => import('@/pages/RecipeFormPage'));
const RecipeDetailPage = lazy(() => import('@/pages/RecipeDetailPage'));
const PlannerPage = lazy(() => import('@/pages/PlannerPage'));
const ShoppingListPage = lazy(() => import('@/pages/ShoppingListPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const OriginalArchivePage = lazy(() => import('@/pages/OriginalArchivePage'));
const OriginalArchiveRecipePage = lazy(() => import('@/pages/OriginalArchiveRecipePage'));
const IngredientMatricesPage = lazy(() => import('@/pages/IngredientMatricesPage'));

function suspense(element: ReactNode) {
  return <Suspense fallback={<div className="loading-card">Caricamento in corso...</div>}>{element}</Suspense>;
}

function getRouterBasename() {
  const baseUrl = import.meta.env.BASE_URL;

  if (!baseUrl || baseUrl === '/') {
    return '/';
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function createAppRouter() {
  return createBrowserRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: suspense(<DashboardPage />) },
          { path: 'pantry', element: suspense(<PantryPage />) },
          { path: 'recipes', element: suspense(<RecipesPage />) },
          { path: 'recipes/new', element: suspense(<RecipeFormPage />) },
          { path: 'recipes/:id', element: suspense(<RecipeDetailPage />) },
          { path: 'recipes/:id/edit', element: suspense(<RecipeFormPage />) },
          { path: 'planner', element: suspense(<PlannerPage />) },
          { path: 'shopping-list', element: suspense(<ShoppingListPage />) },
          { path: 'original-archive', element: suspense(<OriginalArchivePage />) },
          { path: 'original-archive/:id', element: suspense(<OriginalArchiveRecipePage />) },
          { path: 'ingredient-matrices', element: suspense(<IngredientMatricesPage />) },
          { path: 'settings', element: suspense(<SettingsPage />) },
          { path: 'history', element: suspense(<HistoryPage />) },
        ],
      },
    ],
    { basename: getRouterBasename() },
  );
}
