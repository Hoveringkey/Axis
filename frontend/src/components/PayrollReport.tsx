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
import { GlassCard, Button, EmptyState } from './ui';
import './Nomina/Nomina.css';

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

const isValidIsoYear = (raw: string): boolean => {
  const n = parseInt(raw, 10);
  return !isNaN(n) && n >= 1 && n <= 9999 && String(n) === raw.trim();
};

const isValidWeek = (raw: string): boolean => {
  const n = parseInt(raw, 10);
  return !isNaN(n) && n >= 1 && n <= 53;
};

const PayrollReport: React.FC = () => {
  const { hasPermission } = useAuth();
  const [calcWeekNum, setCalcWeekNum]   = useState('');
  const [calcIsoYear, setCalcIsoYear]   = useState('');
  const [calcResults, setCalcResults]   = useState<CalcRow[]>([]);
  const [calcError, setCalcError]       = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isClosing, setIsClosing]       = useState(false);
  const [isClosed, setIsClosed]         = useState(false);
  const [quickFilterText, setQuickFilterText] = useState('');
  const canManagePayroll = hasPermission('can_manage_payroll');

  const weekValid = isValidWeek(calcWeekNum);
  const yearValid = isValidIsoYear(calcIsoYear);
  const periodValid = weekValid && yearValid;

  useEffect(() => {
    // Auto-fetch current ISO period on mount to streamline UX
    api.get('/api/payroll/current-week/')
      .then(res => {
        if (res.data.current_week) {
          setCalcWeekNum(String(res.data.current_week));
        }
        if (res.data.current_iso_year) {
          setCalcIsoYear(String(res.data.current_iso_year));
        }
      })
      .catch(err => console.error("Error auto-fetching week:", err));
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!periodValid) return;
    setIsCalculating(true);
    setCalcError(null);
    setIsClosed(false);
    try {
      const response = await api.get('/api/payroll/preview/', {
        params: {
          semana_num: parseInt(calcWeekNum, 10),
          year: parseInt(calcIsoYear, 10),
        },
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
    if (!periodValid) return;
    if (!canManagePayroll) {
      setCalcError('No tienes permiso para cerrar la nómina.');
      return;
    }
    setIsClosing(true);
    setCalcError(null);
    try {
      await api.post('/api/payroll/commit/', {
        semana_num: parseInt(calcWeekNum, 10),
        year: parseInt(calcIsoYear, 10),
      });
      setIsClosed(true);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string; error?: string } } };
      const status = e.response?.status;
      const data   = e.response?.data;
      if (status === 403) {
        setCalcError('No tienes permiso para cerrar la nómina.');
      } else if (status === 409) {
        setCalcError(data?.error ?? 'La nómina de esta semana ya fue cerrada.');
      } else {
        setCalcError(data?.detail ?? data?.error ?? 'No se pudo cerrar la nómina. Intenta de nuevo.');
      }
    } finally {
      setIsClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCalculate();
  };

  // ── Derived labels ─────────────────────────────────────────────────────────

  const periodLabel = periodValid
    ? `Semana ${calcWeekNum}, ${calcIsoYear}`
    : 'Selecciona un período';

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
    <div className="payroll-report">

      {/* ── Toolbar bar ── */}
      <GlassCard padding="md" className="pr-toolbar-card">
        <div className="pr-toolbar">
          <div className="pr-toolbar-info">
            <span className="pr-period-label">{periodLabel}</span>
            <span className="pr-record-label">{recordLabel}</span>
          </div>
          <div className="pr-toolbar-controls">
            <QuickSearch value={quickFilterText} onChange={setQuickFilterText} />
            <label htmlFor="payroll-semana-input" className="pr-week-label">
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
              className="pr-week-input"
            />
            <label htmlFor="payroll-iso-year-input" className="pr-week-label">
              Año ISO
            </label>
            <input
              id="payroll-iso-year-input"
              type="number"
              placeholder="2026"
              min={1} max={9999}
              value={calcIsoYear}
              onChange={e => setCalcIsoYear(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-week-input"
            />
            <Button
              id="payroll-calculate-btn"
              variant="primary"
              onClick={handleCalculate}
              disabled={isCalculating || !periodValid}
            >
              {isCalculating
                ? <><CircleNotch className="animate-spin" size={16} /> Calculando…</>
                : <><Calculator size={16} weight="duotone" /> Calcular Nómina</>
              }
            </Button>
            {canManagePayroll && (
              <Button
                id="payroll-close-btn"
                variant={isClosed ? 'success' : 'danger'}
                onClick={handleClosePayroll}
                disabled={isClosing || calcResults.length === 0 || isClosed || isCalculating || !periodValid}
                title={calcResults.length === 0 ? 'Ejecuta el reporte primero' : ''}
              >
                {isClosing
                  ? <><CircleNotch className="animate-spin" size={16} /> Cerrando…</>
                  : isClosed
                    ? <><CheckCircle weight="fill" size={16} /> Nómina Cerrada</>
                    : 'Cerrar Nómina'
                }
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ── Error Banner ── */}
      {calcError && (
        <div className="pr-error-banner">
          <WarningCircle size={18} weight="fill" />
          {calcError}
        </div>
      )}

      {/* ── AG Grid ── */}
      {calcResults.length > 0 && (
        <GlassCard padding="md">
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
        </GlassCard>
      )}

      {/* ── Empty state (after calculation returned nothing) ── */}
      {calcResults.length === 0 && !isCalculating && periodValid && !calcError && (
        <EmptyState
          title={`Semana ${calcWeekNum} de ${calcIsoYear} sin variaciones`}
          message="Todos los empleados tuvieron una semana limpia. No hay variaciones que mostrar."
        />
      )}

      {/* ── Initial prompt ── */}
      {!periodValid && !isCalculating && calcResults.length === 0 && !calcError && (
        <div className="pr-prompt">
          <Calculator size={48} weight="duotone" color="var(--color-accent)" />
          <p>Ingresa el número de semana y el año ISO, y presiona <strong>Calcular Nómina</strong> para ver las variaciones.</p>
        </div>
      )}
    </div>
  );
};

export default PayrollReport;
