import React from 'react';
import IncidenceForm from '../IncidenceForm';
import { ClipboardText } from '@phosphor-icons/react';
import '../modules.css';
import '../Dashboard.css'; // reuse form-card, data-form, form-group, etc.

const IncidencesView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ClipboardText size={32} weight="duotone" color="var(--accent-primary)" />
          Incidencias
        </h1>
        <p>Registra faltas, permisos, días extra y asuetos. Selecciona "Asueto" para activar la opción de aplicación masiva.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IncidenceForm />
      </div>
    </div>
  );
};

export default IncidencesView;
