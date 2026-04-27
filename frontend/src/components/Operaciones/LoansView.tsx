import React, { useState, useEffect, useCallback } from 'react';
import LoanForm from '../LoanForm';
import { CreditCard, ArrowClockwise } from '@phosphor-icons/react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import api from '../../api/axios';
import '../modules.css';
import '../Dashboard.css'; // reuse form-card, data-form, etc.
import '../CapitalHumano/CapitalHumano.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Loan {
  id: number;
  empleado: string;
  monto_total: string;
  abono_semanal: string;
  pagos_realizados: number;
  is_active: boolean;
  status: string;
}

interface Employee {
  no_nomina: string;
  nombre: string;
}

interface LoanDisplay {
  id: number;
  empleado_no_nomina: string;
  empleado_nombre: string;
  monto_total: number;
  abono_semanal: number;
  pagos_realizados: number;
  is_active: boolean;
  status: string;
}

const LoansView: React.FC = () => {
  const [loans, setLoans] = useState<LoanDisplay[]>([]);
  const [filter, setFilter] = useState<'Activos' | 'Inactivos/Pagados' | 'Todos'>('Activos');
  const [, setLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const [loansRes, empRes] = await Promise.all([
        api.get('/api/payroll/loans/'),
        api.get('/api/payroll/employees/'),
      ]);

      const empMap: Record<string, string> = {};
      (empRes.data as Employee[]).forEach(e => {
        empMap[e.no_nomina] = e.nombre;
      });

      const display: LoanDisplay[] = (loansRes.data as Loan[]).map(l => ({
        id: l.id,
        empleado_no_nomina: l.empleado,
        empleado_nombre: empMap[l.empleado] || l.empleado,
        monto_total: parseFloat(l.monto_total),
        abono_semanal: parseFloat(l.abono_semanal),
        pagos_realizados: l.pagos_realizados,
        is_active: l.is_active,
        status: l.status,
      }));

      setLoans(display);
    } catch (err) {
      console.error('Failed to fetch loans', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const filteredLoans = loans.filter(loan => {
    if (filter === 'Activos') return loan.is_active;
    if (filter === 'Inactivos/Pagados') return !loan.is_active;
    return true; // Todos
  });

  const columnDefs: ColDef[] = [
    { field: 'empleado_no_nomina', headerName: 'No. Nómina', sortable: true, filter: true, width: 140 },
    { field: 'empleado_nombre', headerName: 'Nombre', sortable: true, filter: true, flex: 2 },
    { 
      field: 'monto_total', 
      headerName: 'Monto Total', 
      sortable: true, 
      filter: true, 
      type: 'numericColumn',
      valueFormatter: p => `$${p.value.toFixed(2)}`
    },
    { 
      field: 'abono_semanal', 
      headerName: 'Abono Semanal', 
      sortable: true, 
      filter: true, 
      type: 'numericColumn',
      valueFormatter: p => `$${p.value.toFixed(2)}`
    },
    { field: 'pagos_realizados', headerName: 'Pagos Realizados', sortable: true, filter: true, type: 'numericColumn' },
    { 
      field: 'status', 
      headerName: 'Estado', 
      sortable: true, 
      filter: true,
      cellRenderer: (p: any) => (
        <span className={`badge ${p.data.is_active ? 'badge-active' : 'badge-inactive'}`}>
          {p.value}
        </span>
      )
    },
  ];

  return (
    <div className="module-page">
      <div className="module-page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <CreditCard size={32} weight="duotone" color="var(--accent-primary)" />
          Préstamos
        </h1>
        <p>Registra nuevos préstamos para empleados y visualiza su estado de cuenta.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LoanForm onLoanAdded={fetchLoans} />
        </div>

        <div className="ch-card ch-grid-wrapper" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px' }}>
              {['Activos', 'Inactivos/Pagados', 'Todos'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt as any)}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: filter === opt ? 600 : 500,
                    background: filter === opt ? 'var(--card-bg)' : 'transparent',
                    color: filter === opt ? 'var(--text-main)' : 'var(--text-muted)',
                    boxShadow: filter === opt ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={fetchLoans}
              className="ch-btn ch-btn-ghost"
              style={{ fontSize: '0.85rem' }}
            >
              <ArrowClockwise weight="bold" /> Actualizar
            </button>
          </div>

          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              rowData={filteredLoans}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={10}
              domLayout="autoHeight"
              animateRows={true}
              rowHeight={52}
              headerHeight={52}
              defaultColDef={{
                filter: true,
                floatingFilter: false,
                menuTabs: ['filterMenuTab'],
                resizable: true,
              }}
              overlayLoadingTemplate={
                '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando préstamos…</span>'
              }
              overlayNoRowsTemplate={
                '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay préstamos para mostrar</span>'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoansView;
