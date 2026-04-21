import React from 'react';
import LoanForm from '../LoanForm';
import '../modules.css';
import '../Dashboard.css'; // reuse form-card, data-form, etc.

const LoansView: React.FC = () => {
  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1>💳 Préstamos</h1>
        <p>Registra nuevos préstamos para empleados y define el abono semanal de descuento.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <LoanForm />
      </div>
    </div>
  );
};

export default LoansView;
