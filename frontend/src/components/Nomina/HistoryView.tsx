import React, { useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueGetterParams, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import api from '../../api/axios';
import '../modules.css';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of the `desglose` JSON field.
 * This is the exact `row` dict appended to `results` in services.py:
 *
 *   {
 *     no_nomina:        string,
 *     nombre:           string,
 *     ausentismos:      string,   ← "ABBREV: count, ABBREV: count" flat string
 *     paid_extra_hours: float,    ← quantity of hours paid (NOT money)
 *     bonos: {
 *       Nocturno:    float,       ← weekly night-shift bonus ($)
 *       Mensual:     float,       ← monthly bonus ($)
 *       Abastecedor: float,       ← abastecedor incentive ($)
 *     },
 *     loan_deduction:   float,
 *     pagos_realizados: number,
 *     total_pagos:      number,
 *   }
 *
 * Incidences live inside the `ausentismos` string as abbreviation codes:
 *   F  = Falta          V   = Vacaciones        I   = Incapacidad
 *   PSG/PGS = Permiso c/ Goce    PsSG = Permiso s/ Goce    ASU = Asueto
 *   ALTA = Alta         BAJA = Baja
 */
interface Bonos {
  Nocturno: number;
  Mensual: number;
  Abastecedor: number;
}

interface Desglose {
  no_nomina: string;
  nombre: string;
  ausentismos: string;       // e.g. "F: 1, V: 2, ALTA: 1"
  paid_extra_hours: number;  // quantity in hours, NOT money
  bonos: Bonos;
  loan_deduction: number;
  pagos_realizados: number;
  total_pagos: number;
}

interface PayrollSnapshot {
  id: number;
  semana_num: number;
  fecha_cierre: string;
  empleado_no_nomina: string;
  empleado_nombre: string;
  total_pagar: string;
  desglose: Desglose;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('es-MX', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

/**
 * Parses the flat `ausentismos` string ("F: 1, ALTA: 1, V: 2") into a Map
 * of abbreviation → numeric count. Memoised per row by reference equality.
 */
const parseAusentismos = (() => {
  const cache = new WeakMap<PayrollSnapshot, Map<string, number>>();
  return (row: PayrollSnapshot): Map<string, number> => {
    if (cache.has(row)) return cache.get(row)!;
    const map = new Map<string, number>();
    const raw = row.desglose?.ausentismos ?? '';
    if (raw) {
      raw.split(',').forEach(part => {
        const [abbrev, count] = part.split(':').map(s => s.trim());
        if (abbrev && count !== undefined) {
          map.set(abbrev.toUpperCase(), parseFloat(count) || 0);
        }
      });
    }
    cache.set(row, map);
    return map;
  };
})();

/** Extract a numeric value from the ausentismos string by abbreviation code. */
const getAbrev = (row: PayrollSnapshot, ...codes: string[]): number => {
  const map = parseAusentismos(row);
  for (const code of codes) {
    const v = map.get(code.toUpperCase());
    if (v != null && v > 0) return v;
  }
  return 0;
};

// ── Status Pill ───────────────────────────────────────────────────────────────

interface PillRendererProps extends ICellRendererParams<PayrollSnapshot> {
  pillLabel: string;
  variant: 'success' | 'error';
}

const StatusPill: React.FC<PillRendererProps> = ({ value, pillLabel, variant }) => {
  if (!value) return null;
  const ok = variant === 'success';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.15rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: ok ? 'var(--success-bg)' : 'var(--error-bg)',
      color:      ok ? 'var(--success-text)' : 'var(--error-text)',
      border:     `1px solid ${ok ? 'var(--success-border)' : 'var(--error-border)'}`,
      lineHeight: 1.4,
    }}>
      {pillLabel}
    </span>
  );
};

// ── Column Definitions ────────────────────────────────────────────────────────

const buildColumnDefs = (): ColDef<PayrollSnapshot>[] => [

  // ── Identity ──────────────────────────────────────────────────────────────
  {
    field: 'empleado_no_nomina',
    headerName: 'No. Nómina',
    sortable: true, filter: true,
    width: 120,
    pinned: 'left',
  },
  {
    field: 'empleado_nombre',
    headerName: 'Nombre',
    sortable: true, filter: true,
    flex: 2, minWidth: 160,
    pinned: 'left',
  },
  {
    field: 'fecha_cierre',
    headerName: 'Fecha Cierre',
    sortable: true,
    width: 155,
    cellRenderer: (p: ICellRendererParams<PayrollSnapshot>) =>
      p.value ? formatDate(p.value as string) : '—',
  },
  {
    field: 'total_pagar',
    headerName: 'Total a Pagar',
    sortable: true,
    width: 135,
    type: 'numericColumn',
    cellRenderer: (p: ICellRendererParams<PayrollSnapshot>) => (
      <span style={{ color: 'var(--color-emerald)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(p.value as string)}
      </span>
    ),
  },

  // ── Status Events (from ausentismos string) ───────────────────────────────
  {
    headerName: 'Alta',
    sortable: true,
    width: 90,
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data ? getAbrev(p.data, 'ALTA') : 0,
    cellRenderer: (p: ICellRendererParams<PayrollSnapshot>) => (
      <StatusPill {...p} pillLabel="ALTA" variant="success" />
    ),
  },
  {
    headerName: 'Baja',
    sortable: true,
    width: 90,
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data ? getAbrev(p.data, 'BAJA') : 0,
    cellRenderer: (p: ICellRendererParams<PayrollSnapshot>) => (
      <StatusPill {...p} pillLabel="BAJA" variant="error" />
    ),
  },

  // ── Bonuses (from desglose.bonos object) ─────────────────────────────────
  {
    headerName: 'Bono Nocturno',
    sortable: true,
    width: 145,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.desglose?.bonos?.Nocturno ?? 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) => {
      const n = Number(p.value ?? 0);
      return n > 0 ? formatCurrency(n) : '—';
    },
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--color-violet)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
  },
  {
    headerName: 'Bono Mensual',
    sortable: true,
    width: 135,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.desglose?.bonos?.Mensual ?? 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) => {
      const n = Number(p.value ?? 0);
      return n > 0 ? formatCurrency(n) : '—';
    },
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--color-amber)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
  },
  {
    headerName: 'Día Abastecedor',
    sortable: true,
    width: 145,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.desglose?.bonos?.Abastecedor ?? 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) => {
      const n = Number(p.value ?? 0);
      return n > 0 ? formatCurrency(n) : '—';
    },
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--color-amber)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
  },

  // ── Extra Hours — quantity, NOT money (desglose.paid_extra_hours) ─────────
  {
    headerName: 'Horas Extra',
    sortable: true,
    width: 120,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.desglose?.paid_extra_hours ?? 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) =>
      `${Number(p.value ?? 0)} hrs`,
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
  },

  // ── Day-Unit Incidences (parsed from desglose.ausentismos string) ─────────
  // Each entry: { codes: string[] = DB abbreviation(s), header: string }
  ...([
    { codes: ['F'],              header: 'Faltas'           },
    { codes: ['V'],              header: 'Vacaciones'       },
    { codes: ['I'],              header: 'Incapacidad'      },
    { codes: ['PSG', 'PGS'],    header: 'Permiso c/ Goce'  },
    { codes: ['PSGS', 'PsSG'],  header: 'Permiso s/ Goce'  },
    { codes: ['ASU'],            header: 'Asueto'           },
  ] as { codes: string[]; header: string }[]).map(({ codes, header }): ColDef<PayrollSnapshot> => ({
    headerName: header,
    sortable: true,
    width: 130,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data ? getAbrev(p.data, ...codes) : 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) =>
      `${Number(p.value ?? 0)} días`,
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--error-text)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
  })),

  // ── Loans (from desglose directly) ───────────────────────────────────────
  {
    headerName: 'Préstamo',
    sortable: true,
    width: 135,
    type: 'numericColumn',
    valueGetter: (p: ValueGetterParams<PayrollSnapshot>) =>
      p.data?.desglose?.loan_deduction ?? 0,
    valueFormatter: (p: ValueFormatterParams<PayrollSnapshot>) => {
      const n = Number(p.value ?? 0);
      if (n <= 0) return '—';
      const row = (p as ValueFormatterParams<PayrollSnapshot>).data;
      const done = row?.desglose?.pagos_realizados ?? 0;
      const total = row?.desglose?.total_pagos ?? 0;
      return `${formatCurrency(n)} (${done}/${total})`;
    },
    cellStyle: (p) => ({
      color: Number(p.value) > 0 ? 'var(--error-text)' : 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }),
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
      setSnapshots(res.data);
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
            {snapshots.length > 0
              ? `${snapshots.length} registro${snapshots.length !== 1 ? 's' : ''} encontrado${snapshots.length !== 1 ? 's' : ''}`
              : 'Consulta un período para ver su historial'}
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
              rowHeight={48}
              headerHeight={48}
              defaultColDef={{ resizable: true }}
            />
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && semanaQueried !== null && snapshots.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '12px', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            No se encontraron registros para la Semana {semanaQueried}.<br />
            Asegúrate de haber cerrado la nómina de ese período.
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
