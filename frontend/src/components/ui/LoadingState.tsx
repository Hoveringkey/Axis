import './ui.css';
import GlassCard from './GlassCard';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

const LoadingState = ({ message = 'Cargando...', fullScreen = false }: LoadingStateProps) => {
  const content = (
    <GlassCard variant="strong" className="axis-state__card">
      <div className="axis-state__spinner" aria-hidden="true" />
      <p className="axis-state__eyebrow">Axis</p>
      <h2 className="axis-state__title">{message}</h2>
    </GlassCard>
  );

  return fullScreen ? <div className="axis-state">{content}</div> : content;
};

export default LoadingState;
