import type { ReactNode } from 'react';
import './ui.css';
import GlassCard from './GlassCard';

interface ErrorStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
  fullScreen?: boolean;
}

const ErrorState = ({ action, fullScreen = false, message, title }: ErrorStateProps) => {
  const content = (
    <GlassCard variant="strong" className="axis-state__card" role="alert">
      <p className="axis-state__eyebrow">Estado de acceso</p>
      <h2 className="axis-state__title">{title}</h2>
      {message && <p className="axis-state__message">{message}</p>}
      {action && <div className="axis-state__actions">{action}</div>}
    </GlassCard>
  );

  return fullScreen ? <div className="axis-state">{content}</div> : content;
};

export default ErrorState;
