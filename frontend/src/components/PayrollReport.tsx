import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import api from '../api/axios';

const PayrollReport: React.FC = () => {
  const [calcWeekNum, setCalcWeekNum] = useState('');
  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const handleCalculate = async () => {
    if (!calcWeekNum) return;
    setIsCalculating(true);
    setCalcError(null);
    setIsClosed(false); // Reset closure state on new query
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

  const handleClosePayroll = async () => {
    if (!calcWeekNum) return;
    setIsClosing(true);
    setCalcError(null);
    try {
      await api.post('/api/payroll/close/', {
        semana_num: parseInt(calcWeekNum, 10)
      });
      setIsClosed(true);
    } catch (err: any) {
      setCalcError(err.response?.data?.detail || 'Closing payroll failed.');
    } finally {
      setIsClosing(false);
    }
  };

  const getDashIfEmpty = (value: string | number | undefined | null) => {
    if (value === 0 || value === '0' || value === '0.0' || value === '0.00' || !value) {
      return <span style={{ color: 'var(--text-muted)' }}>-</span>;
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
        background: 'var(--sidebar-bg)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-inverse)' }}>Variations Report</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Executive Payroll Summary</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="period-selector" style={{ position: 'relative' }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              color: 'var(--text-inverse)',
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
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--text-inverse)'
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
          
          <button
            onClick={handleClosePayroll}
            disabled={isClosing || calcResults.length === 0 || isClosed || isCalculating}
            style={{ 
              margin: 0, 
              padding: '0.5rem 1.25rem',
              backgroundColor: isClosed ? 'var(--success-text)' : 'var(--accent-primary)',
              color: 'var(--color-white)',
              border: 'none',
              borderRadius: '6px',
              cursor: (isClosing || calcResults.length === 0 || isClosed || isCalculating) ? 'not-allowed' : 'pointer',
              opacity: (calcResults.length === 0 && !isClosed) ? 0.5 : 1,
              fontWeight: 600,
              boxShadow: '0 2px 8px var(--accent-shadow)',
              transition: 'all 0.2s ease'
            }}
            title={calcResults.length === 0 ? "Run a report first to enable closing" : ""}
          >
            {isClosing ? 'Closing...' : isClosed ? 'Closed Successfully' : 'Close Payroll'}
          </button>
        </div>
      </div>

      {calcError && <div className="dashboard-error mb-4">{calcError}</div>}

      {calcResults.length > 0 && (
        <div className="ag-theme-alpine" style={{ height: '600px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
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
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <p>No se encontraron variaciones para el período seleccionado.</p>
        </div>
      )}
    </div>
  );
};

export default PayrollReport;
