import React from 'react';
import BulkDataMapper from '../BulkDataMapper';
import { FileArrowDown } from '@phosphor-icons/react';
import '../modules.css';
import '../Dashboard.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const ImportView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <FileArrowDown size={32} weight="duotone" color="var(--accent-primary)" />
          Importar Empleados
        </h1>
        <p>Pega datos desde Excel o CSV. La primera fila debe contener los encabezados del sistema.</p>
      </div>
      <BulkDataMapper />
    </div>
  );
};

export default ImportView;
