import type { ReactNode } from 'react';
import './ui.css';

interface PageShellProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

const PageShell = ({ title, description, actions, children, maxWidth }: PageShellProps) => (
  <main className="axis-page-shell">
    <div className="axis-page-shell__inner" style={maxWidth ? { maxWidth } : undefined}>
      {(title || description || actions) && (
        <header className="axis-page-shell__header">
          <div>
            {title && <h1 className="axis-page-shell__title">{title}</h1>}
            {description && <p className="axis-page-shell__description">{description}</p>}
          </div>
          {actions && <div className="axis-page-shell__actions">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  </main>
);

export default PageShell;
