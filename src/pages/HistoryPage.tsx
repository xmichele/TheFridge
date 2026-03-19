import { useLiveQuery } from 'dexie-react-hooks';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { movementRepository } from '@/data/repositories';
import { formatDateTimeLabel, MOVEMENT_REASON_LABELS } from '@/domain/display';
import { formatQuantity, formatUnitLabel } from '@/domain/units';

export default function HistoryPage() {
  const movements = useLiveQuery(() => movementRepository.list(), [], []);

  if (movements === undefined) {
    return <div className="loading-card">Caricamento storico...</div>;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Storico"
        title="Movimenti inventario"
        description="Ogni variazione critica della dispensa resta tracciata in ordine dal piu recente."
      />

      {movements.length === 0 ? (
        <EmptyState title="Storico vuoto" description="I movimenti appariranno dopo le prime operazioni su dispensa e planner." />
      ) : (
        <div className="stack-md">
          {movements.map((movement) => (
            <article key={movement.id} className="list-card">
              <div className="card-header">
                <div>
                  <h2>{movement.ingredientDisplayName}</h2>
                  <p>{formatDateTimeLabel(movement.createdAt)}</p>
                </div>
                <StatusBadge tone={movement.delta >= 0 ? 'success' : 'warn'}>
                  {movement.delta >= 0 ? '+' : ''}
                  {formatQuantity(movement.delta)} {formatUnitLabel(movement.unit)}
                </StatusBadge>
              </div>
              <p>{MOVEMENT_REASON_LABELS[movement.reason]}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
