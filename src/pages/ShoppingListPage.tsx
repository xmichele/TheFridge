import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { shoppingRepository } from '@/data/repositories';
import {
  createShoppingItem,
  deleteShoppingItem,
  toggleShoppingItemChecked,
  transferPurchasedItemsToPantry,
  updateShoppingItem,
  type ShoppingItemInput,
} from '@/data/services/shoppingService';
import type { ShoppingItem } from '@/domain/models';
import { UNIT_OPTIONS } from '@/domain/models';
import { SHOPPING_SOURCE_LABELS } from '@/domain/display';
import { formatQuantity, formatUnitLabel } from '@/domain/units';
import { shoppingItemInputSchema } from '@/validation/schemas';

type ShoppingFilter = 'all' | 'to-buy' | 'purchased';

interface ShoppingFormState {
  displayName: string;
  quantity: string;
  unit: ShoppingItem['unit'];
  notes: string;
}

function emptyForm(): ShoppingFormState {
  return {
    displayName: '',
    quantity: '',
    unit: 'g',
    notes: '',
  };
}

export default function ShoppingListPage() {
  const shoppingItems = useLiveQuery(() => shoppingRepository.list(), [], []);
  const [filter, setFilter] = useState<ShoppingFilter>('to-buy');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ShoppingFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  const filteredItems = useMemo(
    () =>
      shoppingItems.filter((item) => {
        if (filter === 'to-buy') {
          return !item.checked;
        }

        if (filter === 'purchased') {
          return item.checked;
        }

        return true;
      }),
    [filter, shoppingItems],
  );

  function startEdit(item: ShoppingItem) {
    setEditingId(item.id);
    setErrorMessage('');
    setFormState({
      displayName: item.displayName,
      quantity: String(item.quantity),
      unit: item.unit,
      notes: item.notes ?? '',
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const parsed = shoppingItemInputSchema.safeParse({
      displayName: formState.displayName.trim(),
      quantity: Number(formState.quantity),
      unit: formState.unit,
      notes: formState.notes.trim() || undefined,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Controlla i campi della spesa.');
      return;
    }

    const payload = parsed.data as ShoppingItemInput;

    if (editingId) {
      await updateShoppingItem(editingId, payload);
      showToast({ tone: 'success', title: 'Voce spesa aggiornata' });
    } else {
      await createShoppingItem(payload);
      showToast({ tone: 'success', title: 'Voce aggiunta alla spesa' });
    }

    setEditingId(null);
    setFormState(emptyForm());
  }

  async function handleTransferPurchased() {
    const result = await transferPurchasedItemsToPantry();
    showToast({
      tone: 'success',
      title: 'Dispensa aggiornata',
      description:
        result.moved > 0
          ? `${result.moved} voci acquistate sono state trasferite in dispensa.`
          : 'Nessun prodotto acquistato da trasferire.',
    });
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Lista spesa"
        title="Compra, spunta, trasferisci"
        description="Tieni insieme articoli manuali, mancanti da ricetta e deficit generati dal consumo dei pasti."
        actions={
          <button className="button" onClick={handleTransferPurchased}>
            Porta acquistati in dispensa
          </button>
        }
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{editingId ? 'Modifica voce spesa' : 'Nuova voce spesa'}</h2>
            <p>Le voci acquistate possono essere trasferite direttamente in dispensa.</p>
          </div>
        </div>
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>Prodotto</span>
              <input
                value={formState.displayName}
                onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Quantita</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.quantity}
                onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Unita</span>
              <select
                value={formState.unit}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    unit: event.target.value as ShoppingFormState['unit'],
                  }))
                }
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {formatUnitLabel(unit)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Note</span>
            <textarea
              rows={3}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          <div className="inline-actions">
            <button className="button" type="submit">
              {editingId ? 'Salva voce' : 'Aggiungi alla spesa'}
            </button>
            {editingId ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormState(emptyForm());
                }}
              >
                Annulla
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Filtro lista</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as ShoppingFilter)}>
              <option value="to-buy">Da comprare</option>
              <option value="purchased">Acquistati</option>
              <option value="all">Tutti</option>
            </select>
          </label>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="Lista spesa vuota"
          description="Aggiungi una voce manuale oppure genera mancanti da ricetta e consumo."
        />
      ) : (
        <div className="card-grid">
          {filteredItems.map((item) => (
            <article key={item.id} className="list-card">
              <div className="card-header">
                <div>
                  <h2>{item.displayName}</h2>
                  <p>
                    {formatQuantity(item.quantity)} {formatUnitLabel(item.unit)}
                  </p>
                </div>
                <StatusBadge tone={item.checked ? 'success' : 'neutral'}>
                  {item.checked ? 'Acquistato' : 'Da comprare'}
                </StatusBadge>
              </div>

              <div className="badge-row">
                <StatusBadge>{SHOPPING_SOURCE_LABELS[item.sourceType]}</StatusBadge>
              </div>

              {item.notes ? <p>{item.notes}</p> : null}

              <div className="inline-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => toggleShoppingItemChecked(item.id, event.target.checked)}
                  />
                  <span>Segna acquistato</span>
                </label>
                <button className="button button-secondary" onClick={() => startEdit(item)}>
                  Modifica
                </button>
                <button
                  className="button button-danger"
                  onClick={async () => {
                    if (!window.confirm('Eliminare questa voce dalla lista spesa?')) {
                      return;
                    }

                    await deleteShoppingItem(item.id);
                    showToast({ tone: 'success', title: 'Voce eliminata dalla spesa' });
                }}
                >
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
