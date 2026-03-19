import type { PropsWithChildren } from 'react';

interface EmptyStateProps extends PropsWithChildren {
  title: string;
  description: string;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}
