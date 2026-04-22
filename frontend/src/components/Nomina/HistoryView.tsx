import React, { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueGetterParams } from 'ag-grid-community';
import api from '../../api/axios';
import '../modules.css';

import {
  hasVariations,
  IncidencesCellRenderer,
  TotalPillCellRenderer,
  NominaPillCellRenderer,
} from './GridRenderers';
import type { DesgloseRow, Bonos } from './GridRenderers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayrollSnapshot {
  id: number;
  semana_num: number;
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
/** Mirrors backend total_pagar: sum(bonos) + paid_extra_hours – loan_deduction */
const computeSnapshotTotal = (snap: PayrollSnapshot): number => {
  const d = snap.desglose;
  const bonosSum = Object.values((d.bonos ?? {}) as Bonos).reduce((acc, v) => acc + Number(v), 0);
  return bonosSum + Number(d.paid_extra_hours) - Number(d.loan_deduction);
};

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
  },

  // 2. Nombre
  {
    field: 'empleado_nombre',
    headerName: 'Nombre',
    sortable: true, filter: true,
    flex: 1.4, minWidth: 160,
    pinned: 'left',
  },

  // 3. Resumen Operativo – token pills
  // valueGetter extracts the full desglose so IncidencesCellRenderer always
  // gets a plain DesgloseRow with the correct `ausentismos` string — this is
  // the fix for HistoryView date rendering: snap.desglose IS a DesgloseRow
  // with the v2 ausentismos string written at close-time by services.py.
  {
    headerName: 'Resumen Operativo',
    flex: 3,
    minWidth: 300,
    sortable: false,
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) => p.data?.desglose ?? null,
    cellRenderer: ({ value }: { value: DesgloseRow | null }) =>
      value ? <IncidencesCellRenderer data={value} {...({} as never)} /> : null,
    autoHeight: true,
  },

  // 4. Total a Pagar — blank header; count-gate runs inside renderer
  {
    headerName: '',
    sortable: true,
    width: 155,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data ? computeSnapshotTotal(p.data) : 0,
    cellRenderer: ({ value, data }: { value: number; data: PayrollSnapshot }) =>
      data ? <TotalPillCellRenderer value={value} data={data.desglose} {...({} as never)} /> : null,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const columnDefs = buildColumnDefs();

const HistoryView: React.FC = () => {
  const [semanaInput, setSemanaInput]     = useState('');
  const [semanaQueried, setSemanaQueried] = useState<number | null>(null);
  const [snapshots, setSnapshots]         = useState<PayrollSnapshot[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const parsed = parseInt(semanaInput, 10);
    if (!semanaInput || isNaN(parsed) || parsed < 1 || parsed > 53) {
      setError('Ingresa un número de semana válido (1–53).');
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshots([]);
    setSemanaQueried(parsed);
    try {
      const res = await api.get<PayrollSnapshot[]>(
        `/api/payroll/snapshots/?semana_num=${parsed}`
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
  }, [semanaInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const year        = new Date().getFullYear();
  const periodLabel = semanaQueried ? `Semana ${semanaQueried}, ${year}` : 'Selecciona un período';

  // Record count label is derived from post-filter snapshots
  const recordLabel = useMemo(() => {
    const n = snapshots.length;
    if (n === 0) return 'Consulta un período para ver su historial';
    return `${n} registro${n !== 1 ? 's' : ''} con variaciones`;
  }, [snapshots.length]);

  return (
    <div className="module-page">

      {/* ── Header ── */}
      <div className="module-page-header">
        <h1>📜 Historia de Nómina</h1>
        <p>Auditoría inmutable de períodos de nómina permanentemente cerrados.</p>
      </div>

      {/* ── Search Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'var(--sidebar-bg)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px', padding: '1rem 1.5rem',
        marginBottom: '1.5rem', boxShadow: 'var(--shadow-md)',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-inverse)', marginBottom: '0.15rem' }}>
            {periodLabel}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {recordLabel}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label htmlFor="history-semana-input"
            style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Semana No.
          </label>
          <input
            id="history-semana-input"
            type="number" placeholder="1 – 53" min={1} max={53}
            value={semanaInput}
            onChange={e => setSemanaInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '90px', padding: '0.45rem 0.75rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)',
              color: 'var(--text-inverse)', fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            id="history-search-btn"
            onClick={handleSearch}
            disabled={loading || !semanaInput}
            style={{
              padding: '0.45rem 1.25rem', borderRadius: '8px', border: 'none',
              background: loading ? 'rgba(79,70,229,0.5)' : 'var(--accent-primary)',
              color: 'var(--color-white)', fontWeight: 600, fontSize: '0.875rem',
              cursor: loading || !semanaInput ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease', boxShadow: '0 2px 8px var(--accent-shadow)',
            }}>
            {loading ? 'Buscando…' : 'Consultar'}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          color: 'var(--error-text)', fontSize: '0.875rem', marginBottom: '1rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── AG Grid ── */}
      {snapshots.length > 0 && (
        <div className="eh-grid-wrapper">
          <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
            <AgGridReact<PayrollSnapshot>
              rowData={snapshots}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={25}
              animateRows={true}
              rowHeight={56}
              headerHeight={48}
              defaultColDef={{ resizable: true }}
            />
          </div>
        </div>
      )}

      {/* ── Empty State (post-filter) ── */}
      {!loading && semanaQueried !== null && snapshots.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '12px', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            No se encontraron registros con variaciones para la Semana {semanaQueried}.<br />
            Todos los empleados tuvieron una semana limpia, o la nómina aún no se ha cerrado.
          </p>
        </div>
      )}

      {/* ── Initial Prompt ── */}
      {semanaQueried === null && !loading && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '12px', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Ingresa el número de semana que deseas auditar y presiona <strong>Consultar</strong>.
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryView;
