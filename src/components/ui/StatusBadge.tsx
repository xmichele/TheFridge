import type { ReactNode } from 'react';

interface StatusBadgeProps {
  tone?: 'neutral' | 'warn' | 'danger' | 'success';
  children: ReactNode;
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
