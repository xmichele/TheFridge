import { useId, useState } from 'react';

import { StatusBadge } from '@/components/ui/StatusBadge';
import type { NutritionStickerSource } from '@/domain/nutrition';

interface NutritionStickerBadgeProps {
  label: string;
  source?: NutritionStickerSource;
}

export function NutritionStickerBadge({ label, source }: NutritionStickerBadgeProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const hasDetail = Boolean(source);

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
        <StatusBadge tone="success">{label}</StatusBadge>
      </button>
      {hasDetail && open ? (
        <span id={detailId} role="tooltip" className="badge-detail-popover">
          <span className="badge-detail-line">
          </span>
          <span className="badge-detail-title">{source?.referenceName}</span>
        </span>
      ) : null}
    </span>
  );
}
