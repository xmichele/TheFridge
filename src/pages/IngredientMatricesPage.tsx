import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ingredientNutritionSeed, type IngredientNutritionSeedEntry } from '@/data/ingredientNutritionSeed';

function formatAliases(aliases: string[]) {
  return aliases.length > 0 ? aliases.join(', ') : '—';
}

function formatMeasures(entry: IngredientNutritionSeedEntry) {
  const parts = [
    entry.gramsPerPiece ? `1 pz ${entry.gramsPerPiece} g` : '',
    entry.gramsPerTablespoon ? `1 cucchiaio ${entry.gramsPerTablespoon} g` : '',
    entry.gramsPerTeaspoon ? `1 cucchiaino ${entry.gramsPerTeaspoon} g` : '',
    entry.densityGramsPerMl ? `1 ml ${entry.densityGramsPerMl} g` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' • ') : '—';
}

function formatOptionalNumber(value: number | undefined, suffix = '') {
  return typeof value === 'number' ? `${value}${suffix}` : '—';
}

function renderTable(
  rows: IngredientNutritionSeedEntry[],
  showExtended: boolean,
) {
  return (
    <div className="table-wrap">
      <table className="nutrition-table">
        <thead>
          <tr>
            <th>Alimento</th>
            <th>Alias</th>
            <th>Acqua</th>
            <th>Proteine</th>
            <th>Lipidi</th>
            <th>Carboidrati</th>
            <th>Fibra</th>
            <th>Energia</th>
            <th>Conversioni</th>
            {showExtended ? (
              <>
                <th>Sodio</th>
                <th>Potassio</th>
                <th>Ferro</th>
                <th>Calcio</th>
                <th>Fosforo</th>
                <th>Vit. A</th>
                <th>Vit. C</th>
                <th>Vit. E</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.normalizedName}>
              <td>
                <strong>{entry.displayName}</strong>
              </td>
              <td>{formatAliases(entry.aliases)}</td>
              <td>{formatOptionalNumber(entry.waterPer100g, ' g')}</td>
              <td>{formatOptionalNumber(entry.proteinPer100g, ' g')}</td>
              <td>{formatOptionalNumber(entry.fatPer100g, ' g')}</td>
              <td>{formatOptionalNumber(entry.carbsPer100g, ' g')}</td>
              <td>{formatOptionalNumber(entry.fiberPer100g, ' g')}</td>
              <td>
                {entry.caloriesPer100g} kcal
                <br />
                <span className="table-muted">
                  {Math.round((entry.energyKjPer100g ?? entry.caloriesPer100g * 4.184) * 10) / 10} kJ
                </span>
              </td>
              <td>{formatMeasures(entry)}</td>
              {showExtended ? (
                <>
                  <td>{formatOptionalNumber(entry.sodiumMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.potassiumMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.ironMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.calciumMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.phosphorusMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.vitaminAUgPer100g, ' µg')}</td>
                  <td>{formatOptionalNumber(entry.vitaminCMgPer100g, ' mg')}</td>
                  <td>{formatOptionalNumber(entry.vitaminEMgPer100g, ' mg')}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IngredientMatricesPage() {
  const [search, setSearch] = useState('');
  const [showExtended, setShowExtended] = useState(false);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...ingredientNutritionSeed]
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'it'))
      .filter((entry) => {
        if (!normalizedSearch) {
          return true;
        }

        const haystack = [entry.displayName, ...entry.aliases].join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [search]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, IngredientNutritionSeedEntry[]>();

    for (const row of rows) {
      const section = row.pdfSection ?? 'Altri ingredienti';
      const existing = groups.get(section) ?? [];
      existing.push(row);
      groups.set(section, existing);
    }

    return [...groups.entries()];
  }, [rows]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Ingredienti di base"
        title="Tabella ingredienti di base"
        description="Struttura allineata alle tabelle INRAN/CLITT: stesse famiglie di alimenti, valori per 100 g e vista estesa opzionale per minerali e vitamine."
      />

      <section className="panel">
        <div className="form-grid">
          <label>
            <span>Cerca ingrediente</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Es. latte, limone, yogurt"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showExtended}
              onChange={(event) => setShowExtended(event.target.checked)}
            />
            <span>Vista estesa con sodio, minerali e vitamine</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tabelle</h2>
            <p>{rows.length} ingredienti base locali, organizzati per le stesse famiglie del PDF.</p>
          </div>
          <div className="badge-row">
            <StatusBadge>Per 100 g</StatusBadge>
            <StatusBadge tone="neutral">Seed locale ampliato dal PDF</StatusBadge>
            <a
              className="button button-secondary"
              href="https://detoxify.it/wp-content/uploads/2017/07/dietetica-Tabelle-Composizione-Alimenti.pdf"
              target="_blank"
              rel="noreferrer"
            >
              PDF riferimento
            </a>
          </div>
        </div>
        <div className="stack-lg">
          {groupedRows.map(([section, sectionRows]) => (
            <section key={section} className="stack-sm">
              <div className="section-heading">
                <div>
                  <h3>{section}</h3>
                  <p>{sectionRows.length} ingredienti in questa famiglia.</p>
                </div>
              </div>
              {renderTable(sectionRows, showExtended)}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
