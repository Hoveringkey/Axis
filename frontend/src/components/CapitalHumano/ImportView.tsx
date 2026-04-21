import React from 'react';
import BulkDataMapper from '../BulkDataMapper';
import '../modules.css';
import '../Dashboard.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const ImportView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1>📥 Importar Empleados</h1>
        <p>Pega datos desde Excel o CSV. La primera fila debe contener los encabezados del sistema.</p>
      </div>
      <BulkDataMapper />
    </div>
  );
};

export default ImportView;
