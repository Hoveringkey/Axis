import React from 'react';
import PayrollReport from '../PayrollReport';
import '../modules.css';
import '../Dashboard.css'; // reuse submit-button, ag-grid styles, etc.
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const PayrollView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1>🧮 Calcular Nómina</h1>
        <p>Ejecuta el reporte de variaciones por semana. Previsualiza antes de cerrar el período.</p>
      </div>
      <PayrollReport />
    </div>
  );
};

export default PayrollView;
