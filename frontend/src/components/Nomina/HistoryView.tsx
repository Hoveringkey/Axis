import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MagnifyingGlass, WarningCircle, CircleNotch } from '@phosphor-icons/react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import api from '../../api/axios';
import '../modules.css';
import './Nomina.css';
import QuickSearch from '../QuickSearch';
import { PageShell, GlassCard, Button, EmptyState } from '../ui';

import {
  hasVariations,
  IncidencesCellRenderer,
  NominaPillCellRenderer,
  buildTokens,
} from './GridRenderers';
import type { DesgloseRow } from './GridRenderers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayrollSnapshot {
  id: number;
  semana_num: number;
  iso_year: number;
  fecha_cierre: string;
  empleado_no_nomina: string;
  empleado_nombre: string;
  total_pagar: string;
  desglose: DesgloseRow;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Management-by-Exception filter for snapshots.
 * Delegates to the shared `hasVariations` helper which inspects `desglose`.
 */
const isNotClean = (snap: PayrollSnapshot): boolean =>
  hasVariations(snap.desglose);

// ── Column Definitions (4-column token layout) ────────────────────────────────

/**
 * The snapshot grid shares the same 4-column architecture used by PayrollReport.
 * The "Resumen Operativo" column receives the normalised `desglose` object so
 * that IncidencesCellRenderer can work against a plain DesgloseRow.
 */
const buildColumnDefs = (): ColDef<PayrollSnapshot>[] => [
  // 1. No. Nómina — pill renderer with safe fallback
  {
    headerName: 'No. Nómina',
    sortable: true, filter: true,
    width: 130,
    pinned: 'left',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.empleado_no_nomina || p.data?.desglose?.no_nomina || '',
    cellRenderer: NominaPillCellRenderer,
    getQuickFilterText: (p) => p.value ? p.value.toString() : ''
  },

  // 2. Nombre
  {
    field: 'empleado_nombre',
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
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) => p.data?.desglose ?? null,
    cellRenderer: ({ value }: { value: DesgloseRow | null }) =>
      value ? <IncidencesCellRenderer data={value} {...({} as unknown as Omit<ICellRendererParams<DesgloseRow>, 'data'>)} /> : null,
    autoHeight: true,
    getQuickFilterText: (p) => p.data?.desglose ? buildTokens(p.data.desglose).map(t => t.label).join(' ') : ''
  },

];

// ── Component ─────────────────────────────────────────────────────────────────

const columnDefs = buildColumnDefs();

const HistoryView: React.FC = () => {
  const [semanaInput, setSemanaInput]         = useState('');
  const [isoYearInput, setIsoYearInput]       = useState('');
  const [semanaQueried, setSemanaQueried]     = useState<number | null>(null);
  const [isoYearQueried, setIsoYearQueried]   = useState<number | null>(null);
  const [snapshots, setSnapshots]             = useState<PayrollSnapshot[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  useEffect(() => {
    // Pre-fill ISO year from backend current period so cross-year searches are explicit.
    api.get('/api/payroll/current-week/')
      .then(res => {
        if (res.data.current_iso_year) {
          setIsoYearInput(String(res.data.current_iso_year));
        }
      })
      .catch(err => console.error('Error auto-fetching ISO year:', err));
  }, []);

  const handleSearch = useCallback(async () => {
    const parsedSemana = parseInt(semanaInput, 10);
    if (!semanaInput || isNaN(parsedSemana) || parsedSemana < 1 || parsedSemana > 53) {
      setError('Ingresa un número de semana válido (1–53).');
      return;
    }
    const parsedYear = parseInt(isoYearInput, 10);
    if (!isoYearInput || isNaN(parsedYear) || parsedYear < 1 || parsedYear > 9999) {
      setError('Ingresa un año ISO válido (1–9999).');
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshots([]);
    setSemanaQueried(parsedSemana);
    setIsoYearQueried(parsedYear);
    try {
      const res = await api.get<PayrollSnapshot[]>(
        `/api/payroll/snapshots/?semana_num=${parsedSemana}&iso_year=${parsedYear}`
      );
      // ── MBE filter: drop completely clean records ──────────────────────────
      const filtered = res.data.filter(isNotClean);
      setSnapshots(filtered);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail ?? 'Error al obtener los datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [semanaInput, isoYearInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const periodLabel = semanaQueried !== null && isoYearQueried !== null
    ? `Semana ${semanaQueried}, ${isoYearQueried}`
    : 'Selecciona un período';

  // Record count label is derived from post-filter snapshots
  const recordLabel = useMemo(() => {
    const n = snapshots.length;
    if (n === 0) return 'Consulta un período para ver su historial';
    return `${n} registro${n !== 1 ? 's' : ''} con variaciones`;
  }, [snapshots.length]);

  return (
    <PageShell
      title="Historia de Nómina"
      description="Auditoría inmutable de períodos de nómina permanentemente cerrados."
    >
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
              <label htmlFor="history-semana-input" className="pr-week-label">
                Semana No.
              </label>
              <input
                id="history-semana-input"
                type="number"
                placeholder="1 – 53"
                min={1} max={53}
                value={semanaInput}
                onChange={e => setSemanaInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pr-week-input"
              />
              <label htmlFor="history-iso-year-input" className="pr-week-label">
                Año ISO
              </label>
              <input
                id="history-iso-year-input"
                type="number"
                placeholder="2026"
                min={1} max={9999}
                value={isoYearInput}
                onChange={e => setIsoYearInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pr-week-input"
              />
              <Button
                id="history-search-btn"
                variant="primary"
                onClick={handleSearch}
                disabled={loading || !semanaInput || !isoYearInput}
              >
                {loading
                  ? <><CircleNotch className="animate-spin" size={16} /> Buscando…</>
                  : <><MagnifyingGlass size={16} weight="duotone" /> Consultar</>
                }
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* ── Error Banner ── */}
        {error && (
          <div className="pr-error-banner">
            <WarningCircle size={18} weight="fill" />
            {error}
          </div>
        )}

        {/* ── AG Grid ── */}
        {snapshots.length > 0 && (
          <GlassCard padding="md">
            <div className="ag-theme-alpine" style={{ width: '100%' }}>
              <AgGridReact<PayrollSnapshot>
                theme="legacy"
                rowData={snapshots}
                columnDefs={columnDefs}
                pagination={false}
                suppressPaginationPanel={true}
                domLayout="autoHeight"
                quickFilterText={quickFilterText}
                animateRows={true}
                rowHeight={52}
                headerHeight={52}
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

        {/* ── Empty State (post-filter) ── */}
        {!loading && semanaQueried !== null && isoYearQueried !== null && snapshots.length === 0 && !error && (
          <EmptyState
            title={`Semana ${semanaQueried} de ${isoYearQueried} sin variaciones`}
            message="No se encontraron registros con variaciones. Todos los empleados tuvieron una semana limpia, o la nómina aún no se ha cerrado."
          />
        )}

        {/* ── Initial Prompt ── */}
        {semanaQueried === null && !loading && (
          <div className="pr-prompt">
            <MagnifyingGlass size={48} weight="duotone" color="var(--color-accent)" />
            <p>Ingresa el número de semana y el año ISO que deseas auditar, y presiona <strong>Consultar</strong>.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default HistoryView;
