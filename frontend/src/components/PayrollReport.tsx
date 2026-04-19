import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import api from '../api/axios';

const PayrollReport: React.FC = () => {
  const [calcWeekNum, setCalcWeekNum] = useState('');
  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!calcWeekNum) return;
    setIsCalculating(true);
    setCalcError(null);
    try {
      const response = await api.post('/api/payroll/calculate/', {
        semana_num: parseInt(calcWeekNum, 10)
      });
      setCalcResults(response.data.results || response.data);
    } catch (err: any) {
      setCalcError(err.response?.data?.detail || 'Calculation failed.');
    } finally {
      setIsCalculating(false);
    }
  };

  const getDashIfEmpty = (value: string | number | undefined | null) => {
    if (value === 0 || value === '0' || value === '0.0' || value === '0.00' || !value) {
      return <span style={{ color: '#6b7280' }}>-</span>;
    }
    return value;
  };

  const calcColumnDefs: ColDef[] = [
    { 
      field: 'empleado', 
      headerName: 'Empleado', 
      sortable: true, 
      filter: true, 
      flex: 1.5,
      valueGetter: (params) => `${params.data.no_nomina} - ${params.data.nombre}`
    },
    { 
      field: 'ausentismos', 
      headerName: 'Ausentismos', 
      sortable: true, 
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => getDashIfEmpty(params.value)
    },
    { 
      field: 'paid_extra_hours', 
      headerName: 'Horas Extra', 
      sortable: true, 
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => getDashIfEmpty(params.value)
    },
    { 
      field: 'bonos', 
      headerName: 'Bonos', 
      sortable: true, 
      flex: 2,
      cellRenderer: (params: ICellRendererParams) => {
        const b = params.value;
        if (!b) return getDashIfEmpty(null);
        
        const parts: string[] = [];
        Object.entries(b).forEach(([key, value]) => {
          const numValue = Number(value);
          if (numValue > 0) {
            parts.push(`${key}: $${numValue}`);
          }
        });
        
        if (parts.length === 0) return getDashIfEmpty(null);
        return parts.join(' | ');
      }
    },
    { 
      field: 'prestamos', 
      headerName: 'Préstamos', 
      sortable: true, 
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => {
        const d = params.data.loan_deduction;
        if (!d || d === 0) return getDashIfEmpty(null);
        return `$${d} (${params.data.pagos_realizados}/${params.data.total_pagos})`;
      }
    }
  ];

  // Helper to construct modern period name
  const getPeriodName = () => {
    if (!calcWeekNum) return "Select a period";
    const year = new Date().getFullYear();
    return `Semana ${calcWeekNum}, ${year}`;
  };

  return (
    <div className="tab-pane fade-in">
      <div className="report-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc' }}>Variations Report</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>Executive Payroll Summary</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="period-selector" style={{ position: 'relative' }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              color: '#e2e8f0',
              fontWeight: 500
            }}>
              {getPeriodName()}
            </div>
          </div>
          
          <input
            type="number"
            placeholder="Week No."
            value={calcWeekNum}
            onChange={(e) => setCalcWeekNum(e.target.value)}
            min="1"
            max="53"
            style={{ 
              width: '100px', 
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: 'white'
            }}
          />
          <button
            className="submit-button"
            onClick={handleCalculate}
            disabled={isCalculating || !calcWeekNum}
            style={{ margin: 0, padding: '0.5rem 1.25rem' }}
          >
            {isCalculating ? 'Processing...' : 'Run Report'}
          </button>
        </div>
      </div>

      {calcError && <div className="dashboard-error mb-4">{calcError}</div>}

      {calcResults.length > 0 && (
        <div className="ag-theme-alpine-dark" style={{ height: '600px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
          <AgGridReact
            rowData={calcResults}
            columnDefs={calcColumnDefs}
            pagination={true}
            paginationPageSize={20}
            animateRows={true}
            rowHeight={48}
            headerHeight={48}
          />
        </div>
      )}
      
      {calcResults.length === 0 && !isCalculating && calcWeekNum && !calcError && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#1e293b', borderRadius: '8px' }}>
          <p>No variations found for the selected period.</p>
        </div>
      )}
    </div>
  );
};

export default PayrollReport;
