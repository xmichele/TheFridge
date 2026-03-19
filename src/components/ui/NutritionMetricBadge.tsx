import { useId, useState } from 'react';

import { StatusBadge } from '@/components/ui/StatusBadge';
import type { NutrientLevelLabel, NutritionMetricSource } from '@/domain/nutrition';

interface NutritionMetricBadgeProps {
  metricLabel: string;
  qualitativeLabel: NutrientLevelLabel;
  value?: number;
  unit: 'kcal' | 'g';
  basisLabel?: string;
  metricSource?: NutritionMetricSource | null;
}

function formatMetricValue(value: number, unit: 'kcal' | 'g') {
  return unit === 'kcal' ? `${Math.round(value)} kcal` : `${value.toFixed(1)} g`;
}

export function NutritionMetricBadge({
  metricLabel,
  qualitativeLabel,
  value,
  unit,
  basisLabel,
  metricSource,
}: NutritionMetricBadgeProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const hasDetail = Boolean(metricSource) || (typeof value === 'number' && basisLabel);

  return (
    <span
      className={`badge-detail ${hasDetail ? 'has-detail' : ''}`}
      onMouseEnter={() => hasDetail && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="badge-button"
        aria-describedby={hasDetail && open ? detailId : undefined}
        aria-expanded={hasDetail ? open : undefined}
        onClick={() => hasDetail && setOpen((current) => !current)}
      >
        <StatusBadge tone={qualitativeLabel.tone}>
          {metricLabel}: {qualitativeLabel.label}
        </StatusBadge>
      </button>
      {hasDetail && open ? (
        <span id={detailId} role="tooltip" className="badge-detail-popover">
          {metricSource ? (
            <>
              <span className="badge-detail-title">{metricSource.referenceName}</span>
              <span className="badge-detail-line">
                <strong>kCal</strong> {Math.round(metricSource.per100g.calories)}
              </span>
              <span className="badge-detail-line">
                <strong>Carbo</strong> {metricSource.per100g.carbs.toFixed(1)} g
              </span>
              <span className="badge-detail-line">
                <strong>Prot.</strong> {metricSource.per100g.protein.toFixed(1)} g
              </span>
              <span className="badge-detail-line">
                <strong>Grassi</strong> {metricSource.per100g.fat.toFixed(1)} g
              </span>
            </>
          ) : (
            <span className="badge-detail-line">
              {metricLabel}: {formatMetricValue(value!, unit)} • {basisLabel}
            </span>
          )}
        </span>
      ) : null}
    </span>
  );
}
