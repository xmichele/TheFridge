import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { OriginalRecipeSupportPanel } from '@/components/ui/OriginalRecipeSupportPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { mealPlanRepository, pantryRepository, recipeRepository, shoppingRepository } from '@/data/repositories';
import {
  isPantryItemBelowThreshold,
  isPantryItemExpired,
  isPantryItemExpiringSoon,
} from '@/domain/pantry';
import { MEAL_SLOT_LABELS } from '@/domain/display';
import { formatQuantity, formatUnitLabel } from '@/domain/units';

export default function DashboardPage() {
  const data = useLiveQuery(async () => {
    const [pantryItems, recipes, mealPlans, shoppingItems] = await Promise.all([
      pantryRepository.list(),
      recipeRepository.list(),
      mealPlanRepository.list(),
      shoppingRepository.list(),
    ]);

    return { pantryItems, recipes, mealPlans, shoppingItems };
  }, []);

  if (data === undefined) {
    return <div className="loading-card">Caricamento dashboard...</div>;
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const lowStockItems = data.pantryItems.filter(isPantryItemBelowThreshold);
  const expiringItems = data.pantryItems.filter(
    (item) => isPantryItemExpiringSoon(item) || isPantryItemExpired(item),
  );
  const todayPlans = data.mealPlans.filter((mealPlan) => mealPlan.date === today);
  const shoppingToBuy = data.shoppingItems.filter((item) => !item.checked);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Dashboard"
        title="La tua cucina, oggi"
        description="Controlla scorte, pasti pianificati e acquisti da chiudere senza uscire dal flusso."
      />

      <section className="stat-grid">
        <StatCard label="Dispensa" value={String(data.pantryItems.length)} detail="ingredienti attivi" />
        <StatCard label="Ricette" value={String(data.recipes.length)} detail="piatti salvati" />
        <StatCard label="Planner oggi" value={String(todayPlans.length)} detail="pasti previsti" />
        <StatCard label="Da comprare" value={String(shoppingToBuy.length)} detail="righe in lista spesa" />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Azioni veloci</h2>
            <p>Vai subito nelle aree operative principali.</p>
          </div>
        </div>
        <div className="quick-actions">
          <Link className="button" to="/pantry">
            Aggiorna dispensa
          </Link>
          <Link className="button button-secondary" to="/recipes/new">
            Crea ricetta
          </Link>
          <Link className="button button-secondary" to="/planner">
            Pianifica pasti
          </Link>
          <Link className="button button-secondary" to="/shopping-list">
            Apri spesa
          </Link>
        </div>
      </section>

      <div className="split-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Da monitorare</h2>
              <p>Scorte basse e prodotti in scadenza.</p>
            </div>
            <StatusBadge tone={lowStockItems.length > 0 || expiringItems.length > 0 ? 'warn' : 'success'}>
              {lowStockItems.length + expiringItems.length} attenzioni
            </StatusBadge>
          </div>
          <div className="stack-md">
            {lowStockItems.slice(0, 4).map((item) => (
              <article key={item.id} className="list-card compact">
                <div className="card-header">
                  <h3>{item.displayName}</h3>
                  <StatusBadge tone="warn">Scorta bassa</StatusBadge>
                </div>
                <p>
                  {formatQuantity(item.quantity)} {formatUnitLabel(item.unit)}
                </p>
              </article>
            ))}
            {expiringItems.slice(0, 4).map((item) => (
              <article key={item.id} className="list-card compact">
                <div className="card-header">
                  <h3>{item.displayName}</h3>
                  <StatusBadge tone={isPantryItemExpired(item) ? 'danger' : 'warn'}>
                    {isPantryItemExpired(item) ? 'Scaduto' : 'In scadenza'}
                  </StatusBadge>
                </div>
                <p>{item.expirationDate}</p>
              </article>
            ))}
            {lowStockItems.length === 0 && expiringItems.length === 0 ? (
              <EmptyState
                title="Nessuna criticita"
                description="Le scorte principali e le date di scadenza sono sotto controllo."
              />
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Oggi nel planner</h2>
              <p>Pasti previsti per la giornata.</p>
            </div>
          </div>
          {todayPlans.length === 0 ? (
            <EmptyState
              title="Nessun pasto previsto"
              description="Aggiungi un pasto al planner per organizzare la giornata."
            >
              <Link className="button" to="/planner">
                Pianifica
              </Link>
            </EmptyState>
          ) : (
            <div className="stack-md">
              {todayPlans.map((plan) => {
                const recipe =
                  plan.recipeSource === 'personal'
                    ? data.recipes.find((item) => item.id === plan.recipeId)
                    : null;
                return (
                  <article key={plan.id} className="list-card compact">
                    <div className="card-header">
                      <div>
                        <h3>{plan.recipeTitle ?? recipe?.title ?? 'Ricetta rimossa'}</h3>
                        <p>
                          {MEAL_SLOT_LABELS[plan.slot]}
                          {plan.recipeSource === 'original' ? ' • Archivio originale' : ''}
                        </p>
                      </div>
                      <StatusBadge tone={plan.status === 'consumed' ? 'success' : 'neutral'}>
                        {plan.status === 'consumed' ? 'Consumata' : 'Pianificata'}
                      </StatusBadge>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <OriginalRecipeSupportPanel pantryItems={data.pantryItems} />
    </div>
  );
}
