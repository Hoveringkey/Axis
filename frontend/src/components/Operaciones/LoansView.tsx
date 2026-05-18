import React, { useState, useEffect, useCallback } from 'react';
import LoanForm from '../LoanForm';
import { ArrowClockwise } from '@phosphor-icons/react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import api from '../../api/axios';
import { PageShell, GlassCard, Button, ErrorState } from '../ui';
import '../modules.css';
import '../Dashboard.css';
import './Operaciones.css';
import QuickSearch from '../QuickSearch';

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
  const [filter, setFilter] = useState<'Activos' | 'Pagados' | 'Todos'>('Activos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch {
      setError('No se pudieron cargar los préstamos. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLoans();
  }, [fetchLoans]);

  const filteredLoans = loans.filter(loan => {
    if (filter === 'Activos') return loan.is_active;
    if (filter === 'Pagados') return !loan.is_active;
    return true; // Todos
  });

  const columnDefs: ColDef[] = [
    { field: 'empleado_no_nomina', headerName: 'No. Nómina', sortable: true, filter: true, width: 140, getQuickFilterText: p => p.value ? p.value.toString() : '' },
    { field: 'empleado_nombre', headerName: 'Nombre', sortable: true, filter: true, flex: 2, getQuickFilterText: p => p.value ? p.value.toString() : '' },
    {
      field: 'monto_total',
      headerName: 'Monto Total',
      sortable: true,
      filter: true,
      type: 'numericColumn',
      headerClass: 'header-left-aligned',
      cellStyle: { textAlign: 'left' },
      valueFormatter: p => p.value != null ? `$${p.value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      getQuickFilterText: p => p.value != null ? `${p.value} $${p.value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
    },
    {
      field: 'abono_semanal',
      headerName: 'Abono Semanal',
      sortable: true,
      filter: true,
      type: 'numericColumn',
      headerClass: 'header-left-aligned',
      cellStyle: { textAlign: 'left' },
      valueFormatter: p => p.value != null ? `$${p.value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      getQuickFilterText: p => p.value != null ? `${p.value} $${p.value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
    },
    {
      field: 'pagos_realizados',
      headerName: 'Pagos Realizados',
      sortable: true,
      filter: true,
      type: 'numericColumn',
      headerClass: 'header-left-aligned',
      cellStyle: { textAlign: 'left' },
      valueFormatter: p => p.value != null ? p.value.toLocaleString('es-MX') : '',
      getQuickFilterText: p => p.value != null ? `${p.value} ${p.value.toLocaleString('es-MX')}` : ''
    },
    {
      field: 'status',
      headerName: 'Estado',
      sortable: true,
      filter: true,
      getQuickFilterText: p => p.value ? p.value.toString() : '',
      cellRenderer: ({ data, value }: ICellRendererParams<LoanDisplay>) => (
        <span className={`badge ${data?.is_active ? 'badge-active' : 'badge-inactive'}`}>
          {value}
        </span>
      )
    },
  ];

  return (
    <PageShell
      title="Préstamos"
      description="Registra nuevos préstamos y visualiza el estado de cuenta de cada empleado."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {error && (
          <ErrorState
            title="Error al cargar préstamos"
            message={error}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setError(null); fetchLoans(); }}
              >
                Reintentar
              </Button>
            }
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LoanForm onLoanAdded={fetchLoans} />
        </div>

        <GlassCard padding="md">
          <div className="operaciones-toolbar">
            <div className="operaciones-filter-group">
              {(['Activos', 'Pagados', 'Todos'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`operaciones-filter-btn${filter === opt ? ' operaciones-filter-btn--active' : ''}`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="operaciones-toolbar-right">
              <QuickSearch value={quickFilterText} onChange={setQuickFilterText} />
              <Button variant="ghost" size="sm" onClick={fetchLoans} disabled={loading}>
                <ArrowClockwise weight="bold" /> Actualizar
              </Button>
            </div>
          </div>

          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              theme="legacy"
              rowData={filteredLoans}
              columnDefs={columnDefs}
              pagination={false}
              domLayout="autoHeight"
              animateRows={true}
              quickFilterText={quickFilterText}
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
        </GlassCard>
      </div>
    </PageShell>
  );
};

export default LoansView;
