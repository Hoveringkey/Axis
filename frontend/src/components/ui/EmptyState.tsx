import type { ReactNode } from 'react';
import './ui.css';
import GlassCard from './GlassCard';

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

const EmptyState = ({ action, message, title }: EmptyStateProps) => (
  <GlassCard variant="subtle" className="axis-state__card">
    <p className="axis-state__eyebrow">Sin registros</p>
    <h2 className="axis-state__title">{title}</h2>
    {message && <p className="axis-state__message">{message}</p>}
    {action && <div className="axis-state__actions">{action}</div>}
  </GlassCard>
);

export default EmptyState;
