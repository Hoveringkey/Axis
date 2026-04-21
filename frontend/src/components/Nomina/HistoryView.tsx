import React from 'react';
import '../modules.css';

const HistoryView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1>📜 Historia de Nómina</h1>
        <p>Registro de períodos de nómina cerrados.</p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 2rem',
        textAlign: 'center',
        background: 'rgba(22, 32, 51, 0.5)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.25rem', animation: 'float 3s ease-in-out infinite' }}>
          🚧
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem' }}>
          En Construcción
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', margin: 0 }}>
          El historial de nóminas cerradas estará disponible en la próxima iteración,
          junto con el endpoint de auditoría del backend.
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default HistoryView;
