import type { HTMLAttributes, ReactNode } from 'react';
import './ui.css';

type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: StatusBadgeVariant;
}

const StatusBadge = ({
  children,
  className = '',
  variant = 'neutral',
  ...props
}: StatusBadgeProps) => (
  <span className={`axis-status-badge axis-status-badge--${variant} ${className}`.trim()} {...props}>
    {children}
  </span>
);

export default StatusBadge;
