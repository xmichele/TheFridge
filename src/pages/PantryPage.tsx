import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/ToastProvider';
import { pantryRepository } from '@/data/repositories';
import {
  createPantryItem,
  deletePantryItem,
  updatePantryItem,
  type PantryItemInput,
} from '@/data/services/pantryService';
import type { PantryFilter } from '@/domain/pantry';
import {
  isPantryItemBelowThreshold,
  isPantryItemDepleted,
  isPantryItemExpired,
  isPantryItemExpiringSoon,
  matchesPantryFilter,
} from '@/domain/pantry';
import { normalizeIngredientName } from '@/domain/normalization';
import { UNIT_OPTIONS, type PantryItem } from '@/domain/models';
import { formatQuantity, formatUnitLabel } from '@/domain/units';
import { pantryItemInputSchema } from '@/validation/schemas';

interface PantryFormState {
  displayName: string;
  quantity: string;
  unit: PantryItem['unit'];
  category: string;
  minThreshold: string;
  expirationDate: string;
  notes: string;
}

const FILTERS: Array<{ value: PantryFilter; label: string }> = [
  { value: 'all', label: 'Tutti' },
  { value: 'below-threshold', label: 'Sotto soglia' },
  { value: 'expiring-soon', label: 'In scadenza' },
  { value: 'expired', label: 'Scaduti' },
  { value: 'depleted', label: 'Esauriti' },
];

function emptyForm(): PantryFormState {
  return {
    displayName: '',
    quantity: '',
    unit: 'g',
    category: '',
    minThreshold: '',
    expirationDate: '',
    notes: '',
  };
}

export default function PantryPage() {
  const pantryItems = useLiveQuery(() => pantryRepository.list(), [], []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PantryFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PantryFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  const filteredItems = useMemo(
    () =>
      pantryItems.filter((item) => {
        const matchesSearch = item.normalizedName.includes(normalizeIngredientName(search));
        return matchesSearch && matchesPantryFilter(item, filter);
      }),
    [filter, pantryItems, search],
  );

  function startEdit(item: PantryItem) {
    setEditingId(item.id);
    setErrorMessage('');
    setFormState({
      displayName: item.displayName,
      quantity: String(item.quantity),
      unit: item.unit,
      category: item.category ?? '',
      minThreshold: item.minThreshold ? String(item.minThreshold) : '',
      expirationDate: item.expirationDate ?? '',
      notes: item.notes ?? '',
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const parsed = pantryItemInputSchema.safeParse({
      displayName: formState.displayName.trim(),
      quantity: Number(formState.quantity),
      unit: formState.unit,
      category: formState.category.trim() || undefined,
      minThreshold: formState.minThreshold ? Number(formState.minThreshold) : undefined,
      expirationDate: formState.expirationDate,
      notes: formState.notes.trim() || undefined,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Controlla i campi della dispensa.');
      return;
    }

    const payload = parsed.data as PantryItemInput;

    if (editingId) {
      await updatePantryItem(editingId, payload);
      showToast({ tone: 'success', title: 'Ingrediente aggiornato' });
    } else {
      await createPantryItem(payload);
      showToast({ tone: 'success', title: 'Ingrediente aggiunto in dispensa' });
    }

    setEditingId(null);
    setFormState(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questo ingrediente dalla dispensa?')) {
      return;
    }

    await deletePantryItem(id);
    showToast({ tone: 'success', title: 'Ingrediente eliminato' });
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyForm());
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Dispensa"
        title="Gestione dispensa"
        description="Aggiorna giacenze, soglie minime, scadenze e note senza perdere lo storico dei movimenti."
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{editingId ? 'Modifica ingrediente' : 'Nuovo ingrediente'}</h2>
            <p>Ogni modifica aggiorna anche lo storico movimenti.</p>
          </div>
        </div>
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>Ingrediente</span>
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
                    unit: event.target.value as PantryFormState['unit'],
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
            <label>
              <span>Categoria</span>
              <input
                value={formState.category}
                onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))}
              />
            </label>
            <label>
              <span>Soglia minima</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.minThreshold}
                onChange={(event) => setFormState((current) => ({ ...current, minThreshold: event.target.value }))}
              />
            </label>
            <label>
              <span>Scadenza</span>
              <input
                type="date"
                value={formState.expirationDate}
                onChange={(event) => setFormState((current) => ({ ...current, expirationDate: event.target.value }))}
              />
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
              {editingId ? 'Salva ingrediente' : 'Aggiungi ingrediente'}
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
            <span>Cerca ingrediente</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Es. latte" />
          </label>
          <label>
            <span>Filtro</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as PantryFilter)}>
              {FILTERS.map((filterOption) => (
                <option key={filterOption.value} value={filterOption.value}>
                  {filterOption.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="Dispensa vuota per questo filtro"
          description="Aggiungi un ingrediente oppure cambia filtro di ricerca."
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
                    {item.category ? ` • ${item.category}` : ''}
                  </p>
                </div>
                <div className="badge-row">
                  {isPantryItemBelowThreshold(item) ? <StatusBadge tone="warn">Sotto soglia</StatusBadge> : null}
                  {isPantryItemExpiringSoon(item) ? <StatusBadge tone="warn">In scadenza</StatusBadge> : null}
                  {isPantryItemExpired(item) ? <StatusBadge tone="danger">Scaduto</StatusBadge> : null}
                  {isPantryItemDepleted(item) ? <StatusBadge tone="danger">Esaurito</StatusBadge> : null}
                </div>
              </div>
              {item.expirationDate ? <p>Scadenza: {item.expirationDate}</p> : null}
              {item.minThreshold !== undefined ? <p>Soglia minima: {item.minThreshold}</p> : null}
              {item.notes ? <p>{item.notes}</p> : null}
              <div className="inline-actions">
                <button className="button button-secondary" onClick={() => startEdit(item)}>
                  Modifica
                </button>
                <button className="button button-danger" onClick={() => handleDelete(item.id)}>
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
