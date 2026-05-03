/**
 * PayrollReport.tsx
 *
 * Live payroll calculation preview.  Implements the same 4-column token-based
 * layout used by HistoryView so that the "calculate" preview and the immutable
 * "history" audit look identical.
 *
 * Management-by-Exception: rows where every field is zero/empty are filtered
 * out before the grid is rendered.  (The backend already applies the same
 * filter, so this is a defensive client-side guard.)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import api from '../api/axios';
import { useAuth } from '../auth/AuthContext';
import './modules.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import QuickSearch from './QuickSearch';

import {
  hasVariations,
  IncidencesCellRenderer,
  NominaPillCellRenderer,
  formatCurrency,
  buildTokens,
} from './Nomina/GridRenderers';
import { 
  WarningCircle, 
  CheckCircle, 
  Calculator,
  CircleNotch 
} from '@phosphor-icons/react';
import type { DesgloseRow } from './Nomina/GridRenderers';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Flat row returned by /api/payroll/calculate/.
 * Identical to DesgloseRow but we alias it here for clarity.
 */
type CalcRow = DesgloseRow;

// ── Total calculation ─────────────────────────────────────────────────────────

/** Mirrors the backend's total_pagar formula: sum(bonos) + paid_extra_hours – loan_deduction */
const computeTotal = (row: CalcRow): number => {
  const bonosSum = Object.values(row.bonos ?? {}).reduce((acc, v) => acc + Number(v), 0);
  return bonosSum + Number(row.paid_extra_hours) - Number(row.loan_deduction);
};

// ── Column Definitions (4-column, token-based) ────────────────────────────────

const buildColumnDefs = (): ColDef<CalcRow>[] => [
  // 1. No. Nómina — pill renderer with safe fallback
  {
    headerName: 'No. Nómina',
    sortable: true, filter: true,
    width: 130,
    pinned: 'left',
    valueGetter: (p) => p.data?.no_nomina || (p.data as never as { empleado_no_nomina?: string })?.empleado_no_nomina || '',
    cellRenderer: NominaPillCellRenderer,
    getQuickFilterText: (p) => p.value ? p.value.toString() : ''
  },

  // 2. Nombre
  {
    field: 'nombre',
    headerName: 'Nombre',
    sortable: true, filter: true,
    flex: 1.4, minWidth: 160,
    pinned: 'left',
    getQuickFilterText: (p) => p.value ? p.value.toString() : ''
  },

  // 3. Resumen Operativo – token pills
  {
    headerName: 'Resumen Operativo',
    flex: 3,
    minWidth: 300,
    sortable: false,
    cellRenderer: IncidencesCellRenderer,
    autoHeight: true,
    getQuickFilterText: (p) => p.data ? buildTokens(p.data).map(t => t.label).join(' ') : ''
  },

];

const columnDefs = buildColumnDefs();

// ── Component ─────────────────────────────────────────────────────────────────

const PayrollReport: React.FC = () => {
  const { hasPermission } = useAuth();
  const [calcWeekNum, setCalcWeekNum]   = useState('');
  const [calcResults, setCalcResults]   = useState<CalcRow[]>([]);
  const [calcError, setCalcError]       = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isClosing, setIsClosing]       = useState(false);
  const [isClosed, setIsClosed]         = useState(false);
  const [quickFilterText, setQuickFilterText] = useState('');
  const canManagePayroll = hasPermission('can_manage_payroll');

  useEffect(() => {
    // Auto-fetch current week on mount to streamline UX
    api.get('/api/payroll/current-week/')
      .then(res => {
        if (res.data.current_week) {
          setCalcWeekNum(String(res.data.current_week));
        }
      })
      .catch(err => console.error("Error auto-fetching week:", err));
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!calcWeekNum) return;
    setIsCalculating(true);
    setCalcError(null);
    setIsClosed(false);
    try {
      const response = await api.get('/api/payroll/preview/', {
        params: { semana_num: parseInt(calcWeekNum, 10) },
      });
      const raw: CalcRow[] = response.data.results ?? response.data ?? [];
      // ── MBE filter: defensive client-side guard (backend already filters) ──
      setCalcResults(raw.filter(hasVariations));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setCalcError(e.response?.data?.detail ?? 'No se pudo calcular la nómina. Intenta de nuevo.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleClosePayroll = async () => {
    if (!calcWeekNum) return;
    if (!canManagePayroll) {
      setCalcError('No tienes permiso para cerrar la nómina.');
      return;
    }
    setIsClosing(true);
    setCalcError(null);
    try {
      await api.post('/api/payroll/commit/', {
        semana_num: parseInt(calcWeekNum, 10),
      });
      setIsClosed(true);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      if (e.response?.status === 403) {
        setCalcError('No tienes permiso para cerrar la nómina.');
      } else {
        setCalcError(e.response?.data?.detail ?? 'No se pudo cerrar la nómina. Intenta de nuevo.');
      }
    } finally {
      setIsClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCalculate();
  };

  // ── Derived labels ─────────────────────────────────────────────────────────

  const year        = new Date().getFullYear();
  const periodLabel = calcWeekNum ? `Semana ${calcWeekNum}, ${year}` : 'Selecciona un período';

  const grandTotal = useMemo(
    () => calcResults.reduce((sum, row) => sum + computeTotal(row), 0),
    [calcResults]
  );

  const recordLabel = useMemo(() => {
    const n = calcResults.length;
    if (n === 0) return 'Sin variaciones calculadas';
    return `${n} empleado${n !== 1 ? 's' : ''} con variaciones · Total: ${formatCurrency(grandTotal)}`;
  }, [calcResults.length, grandTotal]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tab-pane fade-in">

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'var(--sidebar-bg)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px', padding: '1rem 1.5rem',
        marginBottom: '1.5rem', boxShadow: 'var(--shadow-md)',
        flexWrap: 'wrap',
      }}>
        {/* Period info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-inverse)', marginBottom: '0.15rem' }}>
            {periodLabel}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {recordLabel}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <QuickSearch value={quickFilterText} onChange={setQuickFilterText} />
          {/* Week input */}
          <label htmlFor="payroll-semana-input"
            style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Semana No.
          </label>
          <input
            id="payroll-semana-input"
            type="number"
            placeholder="1 – 53"
            min={1} max={53}
            value={calcWeekNum}
            onChange={e => setCalcWeekNum(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '90px', padding: '0.45rem 0.75rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)',
              color: 'var(--text-inverse)', fontSize: '0.9rem', outline: 'none',
            }}
          />

          {/* Run Report */}
          <button
            id="payroll-calculate-btn"
            onClick={handleCalculate}
            disabled={isCalculating || !calcWeekNum}
            style={{
              padding: '0.45rem 1.25rem', borderRadius: '8px', border: 'none',
              background: isCalculating ? 'rgba(79,70,229,0.5)' : 'var(--accent-primary)',
              color: 'var(--color-white)', fontWeight: 600, fontSize: '0.875rem',
              cursor: isCalculating || !calcWeekNum ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease', boxShadow: '0 2px 8px var(--accent-shadow)',
            }}>
            {isCalculating ? 'Calculando…' : 'Calcular Nómina'}
          </button>

          {/* Close Payroll */}
          {canManagePayroll && (
            <button
              id="payroll-close-btn"
              onClick={handleClosePayroll}
              disabled={isClosing || calcResults.length === 0 || isClosed || isCalculating}
              title={calcResults.length === 0 ? 'Ejecuta el reporte primero' : ''}
              style={{
                padding: '0.45rem 1.25rem', borderRadius: '8px',
                background: isClosed ? 'rgba(16,185,129,0.2)' : 'var(--accent-primary)',
                color: isClosed ? 'var(--color-emerald, #10b981)' : 'var(--color-white)',
                fontWeight: 600, fontSize: '0.875rem',
                cursor: (isClosing || calcResults.length === 0 || isClosed || isCalculating)
                  ? 'not-allowed'
                  : 'pointer',
                opacity: (calcResults.length === 0 && !isClosed) ? 0.5 : 1,
                transition: 'all 0.2s ease', boxShadow: '0 2px 8px var(--accent-shadow)',
                border: isClosed ? '1px solid rgba(16,185,129,0.4)' : 'none',
              }}>
              {isClosing ? (
                <><CircleNotch className="animate-spin" size={16} /> Cerrando…</>
              ) : isClosed ? (
                <><CheckCircle weight="fill" size={16} /> Nómina Cerrada</>
              ) : (
                'Cerrar Nómina'
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {calcError && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          color: 'var(--error-text)', fontSize: '0.875rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <WarningCircle size={18} weight="fill" />
          {calcError}
        </div>
      )}

      {/* ── AG Grid ── */}
      {calcResults.length > 0 && (
      <div className="eh-grid-wrapper" style={{ padding: '1.5rem' }}>
        <div className="ag-theme-alpine" style={{ width: '100%' }}>
          <AgGridReact<CalcRow>
            theme="legacy"
            rowData={calcResults}
            columnDefs={columnDefs}
            pagination={false}
            suppressPaginationPanel={true}
            domLayout="autoHeight"
            quickFilterText={quickFilterText}
            animateRows={true}
            rowHeight={56}
            headerHeight={48}
            defaultColDef={{ 
              filter: true,
              floatingFilter: false,
              menuTabs: ['filterMenuTab'],
              resizable: true 
            }}
            rowStyle={{ borderBottom: '1px solid var(--bg-secondary)' }}
            autoSizeStrategy={{ type: 'fitGridWidth' }}
          />
        </div>
      </div>
      )}

      {/* ── Empty state (after calculation returned nothing) ── */}
      {calcResults.length === 0 && !isCalculating && calcWeekNum && !calcError && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '12px', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <CheckCircle size={48} weight="duotone" style={{ marginBottom: '1rem', color: 'var(--color-emerald)' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Todos los empleados tuvieron una semana limpia en la Semana {calcWeekNum}.<br />
            No hay variaciones que mostrar.
          </p>
        </div>
      )}

      {/* ── Initial prompt ── */}
      {!calcWeekNum && !isCalculating && calcResults.length === 0 && !calcError && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '12px', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <Calculator size={48} weight="duotone" style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Ingresa el número de semana y presiona <strong>Calcular Nómina</strong> para ver las variaciones.
          </p>
        </div>
      )}
    </div>
  );
};

export default PayrollReport;
