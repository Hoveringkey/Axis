import type { HTMLAttributes, ReactNode } from 'react';
import './ui.css';

type GlassCardVariant = 'default' | 'strong' | 'subtle' | 'interactive';
type GlassCardPadding = 'sm' | 'md' | 'lg' | 'none';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GlassCardVariant;
  padding?: GlassCardPadding;
}

const GlassCard = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  ...props
}: GlassCardProps) => {
  const variantClass = variant === 'default' ? '' : ` axis-glass-card--${variant}`;
  const paddingClass = padding === 'none' ? '' : ` axis-glass-card--padding-${padding}`;

  return (
    <div className={`axis-glass-card${variantClass}${paddingClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export default GlassCard;
