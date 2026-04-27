/**
 * GridRenderers.tsx
 *
 * Shared cell renderers, column factories, and data-pipeline helpers used by
 * both HistoryView.tsx (snapshot grid) and PayrollReport.tsx (live-calc grid).
 *
 * ── Ausentismos wire format (v2 — date-injected) ────────────────────────────
 *   "F:2026-04-20|2026-04-22, V:2026-04-23|2026-04-24|2026-04-25"
 *    └── abbrev : pipe-separated ISO dates ──────────────────────────────────┘
 *
 * ── Ausentismos wire format (v1 — legacy count-based) ────────────────────────
 *   "F: 2, V: 3"
 *   Backward-compatible: if the value after the colon parses as a plain number
 *   the parser falls back to count-only mode (dates array will be empty).
 *
 * ── Canonical abbreviation map (backend schema) ───────────────────────────────
 *   Falta:            F, FALTA       plural: Faltas
 *   Vacaciones:       V, VACACIONES  plural: Vacaciones (invariant)
 *   Incapacidad:      INC, INCAPACIDAD plural: Incapacidades
 *   Alta:             ALTA, A        (status — no plural)
 *   Baja:             BAJA, B        (status — no plural)
 *   Permiso c/ Goce:  PCG            plural: Permisos c/Goce
 *   Permiso s/ Goce:  PSG            plural: Permisos s/Goce
 *   Asueto:           ASU, ASUETO    plural: Asuetos
 *
 * ── Exclusions from date tracking ────────────────────────────────────────────
 *   HX  (Horas Extra)       — kept as "X hrs"
 *   DA  (Día Abastecedor)   — rendered as currency bono pill
 *   Bonos Nocturno/Mensual  — rendered as currency bono pills
 */

import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Bonos {
  Nocturno: number;
  Mensual: number;
  Abastecedor: number;
}

/** Flat payroll row – returned by /api/payroll/calculate/ and stored as
 *  PayrollSnapshot.desglose on the backend. */
export interface DesgloseRow {
  no_nomina: string;
  nombre: string;
  ausentismos: string;
  paid_extra_hours: number;
  bonos: Bonos;
  loan_deduction: number;
  pagos_realizados: number;
  total_pagos: number;
}

/** Parsed representation of a single incidence entry. */
export interface ParsedIncidence {
  /** Total day-count (dates.length for v2; parsed number for v1). */
  count: number;
  /** ISO date strings, sorted chronologically.  Empty array for legacy v1 records. */
  dates: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const formatCurrency = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ── Ausentismos Parser (backward-compatible v1 + v2) ─────────────────────────

/**
 * Cache key: the raw `ausentismos` string itself (not the row object) so that
 * legacy snapshot rows (stored in DB as plain JSON) also hit the cache when
 * they carry the same string value.
 */
const _parseCache = new Map<string, Map<string, ParsedIncidence>>();

/**
 * Parses the `ausentismos` field into a Map of UPPERCASE abbreviation →
 * `{ count, dates }`.
 *
 * v2 format (date-injected):
 *   "F:2026-04-20|2026-04-22, V:2026-04-23|2026-04-24"
 *   → { F: { count: 2, dates: ['2026-04-20','2026-04-22'] },
 *       V: { count: 2, dates: ['2026-04-23','2026-04-24'] } }
 *
 * v1 format (legacy count-only):
 *   "F: 2, V: 3"
 *   → { F: { count: 2, dates: [] }, V: { count: 3, dates: [] } }
 */
export const parseAusentismos = (
  row: { ausentismos?: string }
): Map<string, ParsedIncidence> => {
  const raw = row.ausentismos ?? '';

  if (_parseCache.has(raw)) return _parseCache.get(raw)!;

  const map = new Map<string, ParsedIncidence>();

  if (raw && raw.trim()) {
    // Split on ", " but protect dates that themselves contain commas (none do in ISO 8601).
    raw.split(/,\s*/).forEach(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) return;

      const abbrev  = part.slice(0, colonIdx).trim().toUpperCase();
      const payload = part.slice(colonIdx + 1).trim();
      if (!abbrev) return;

      // Detect v2: payload contains a '-' that is part of an ISO date (YYYY-MM-DD),
      // OR contains a '|' separator.  A plain count never contains '-' or '|'.
      const isV2 = payload.includes('|') || /^\d{4}-\d{2}-\d{2}/.test(payload);

      if (isV2) {
        const dates = payload.split('|').map(d => d.trim()).filter(Boolean).sort();
        map.set(abbrev, { count: dates.length, dates });
      } else {
        // v1 legacy: plain numeric count
        const count = parseFloat(payload);
        if (!isNaN(count)) {
          map.set(abbrev, { count, dates: [] });
        }
      }
    });
  }

  _parseCache.set(raw, map);
  return map;
};

/**
 * Returns the summed count for ALL provided abbreviation codes.
 * Also accumulates any dates arrays from the parsed incidences.
 */
export const getAbrev = (
  row: DesgloseRow,
  ...codes: string[]
): ParsedIncidence => {
  const map = parseAusentismos(row);
  let totalCount = 0;
  let allDates: string[] = [];
  for (const code of codes) {
    const entry = map.get(code.toUpperCase());
    if (entry && entry.count > 0) {
      totalCount += entry.count;
      allDates = allDates.concat(entry.dates);
    }
  }
  return { count: totalCount, dates: allDates.sort() };
};

/**
 * Management-by-Exception filter.
 *
 * A record is "clean" (returns false) when ALL of the following hold:
 *   - ausentismos is empty / whitespace
 *   - paid_extra_hours === 0
 *   - loan_deduction  === 0
 *   - ALL bonos values === 0
 */
export const hasVariations = (row: DesgloseRow): boolean => {
  const ausentismosHasContent = !!(row.ausentismos && row.ausentismos.trim());
  const hasExtraHours         = Number(row.paid_extra_hours) > 0;
  const hasLoan               = Number(row.loan_deduction)   > 0;
  const hasBonus              = Object.values(row.bonos ?? {}).some(v => Number(v) > 0);
  return ausentismosHasContent || hasExtraHours || hasLoan || hasBonus;
};

// ── Date Formatting Helpers ───────────────────────────────────────────────────

const ES_MONTHS: readonly string[] = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/**
 * Formats an ISO date string ("2026-04-20") → "20 Abr".
 * Parses using string splitting to avoid timezone shifts from `new Date()`.
 */
const fmtDate = (iso: string): string => {
  const [, mm, dd] = iso.split('-');
  const day   = parseInt(dd, 10);
  const month = ES_MONTHS[parseInt(mm, 10) - 1] ?? mm;
  return `${day} ${month}`;
};

/**
 * Returns true if the given array of sorted ISO date strings forms a run of
 * strictly consecutive calendar days.
 */
const areConsecutive = (sortedDates: string[]): boolean => {
  if (sortedDates.length < 2) return true;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
    const curr = new Date(sortedDates[i]     + 'T00:00:00');
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs !== 86_400_000) return false; // not exactly 1 day apart
  }
  return true;
};

/**
 * Strict Spanish pluralization dictionary.
 * Maps singular label → plural form.  Invariant plurals map to themselves.
 * Unlisted labels fall back to appending 's' (safe default for proper nouns).
 */
const ES_PLURAL: Record<string, string> = {
  'Falta':          'Faltas',
  'Vacaciones':     'Vacaciones',    // invariant
  'Incapacidad':    'Incapacidades',
  'Permiso c/Goce': 'Permisos c/Goce',
  'Permiso s/Goce': 'Permisos s/Goce',
  'Asueto':         'Asuetos',
};

/** Returns the correct plural (or singular) for a Spanish incidence label. */
const esPlural = (label: string, count: number): string =>
  count === 1 ? label : (ES_PLURAL[label] ?? `${label}s`);

/**
 * Smart date token label builder.
 *
 * Rules:
 *  - No dates (v1 legacy)       → "{count} {Plural}"         e.g. "2 Faltas"
 *  - 1 date                     → "{Singular} ({DD MMM})"    e.g. "Falta (20 Abr)"
 *  - ≥ 3 strictly consecutive   → "{count} {Plural} ({DD MMM} al {DD MMM})"
 *  - 2 days OR non-consecutive  → "{count} {Plural} ({DD MMM}, {DD MMM}, …)"
 *
 * `isStatus` = true/false marks Alta/Baja — never show a count, label only.
 */
export const formatDateToken = (
  label: string,
  count: number,
  dates: string[],
  isStatus?: boolean,
): string => {
  // Status events (Alta / Baja) — label [+ date] only, never a count
  if (isStatus !== undefined) {
    if (dates.length === 1) return `${label} (${fmtDate(dates[0])})`;
    return label;
  }

  const singular = label;
  const plural   = esPlural(label, count);

  // Legacy v1 — no date info
  if (dates.length === 0) {
    return `${count} ${plural}`;
  }

  // Single day
  if (dates.length === 1) {
    return `${singular} (${fmtDate(dates[0])})`;
  }

  // Multiple days — range compression for ≥ 3 consecutive
  if (dates.length >= 3 && areConsecutive(dates)) {
    return `${count} ${plural} (${fmtDate(dates[0])} al ${fmtDate(dates[dates.length - 1])})`;
  }

  // Direct list (2 days, or non-consecutive)
  return `${count} ${plural} (${dates.map(fmtDate).join(', ')})`;
};

// ── Token Builder ─────────────────────────────────────────────────────────────

interface Token {
  label: string;
  color: string;
  bg: string;
  border: string;
}

/**
 * Bulletproof incidence definitions.
 * Each entry lists ALL possible database abbreviations for that incidence type.
 * getAbrev sums counts and merges dates across all codes so no record is lost.
 */
const INCIDENCE_DEFS: {
  codes: string[];
  label: string;
  /** true = Alta (success green), false = Baja (error red), undefined = day-unit */
  isStatus?: boolean;
}[] = [
  { codes: ['ALTA', 'A'],          label: 'Alta',           isStatus: true  },
  { codes: ['BAJA', 'B'],          label: 'Baja',           isStatus: false },
  { codes: ['F', 'FALTA'],         label: 'Falta'                           },
  { codes: ['V', 'VACACIONES'],    label: 'Vacaciones'                      },
  { codes: ['INC', 'INCAPACIDAD'], label: 'Incapacidad'                     },
  { codes: ['PCG'],                label: 'Permiso c/Goce'                  },
  { codes: ['PSG'],                label: 'Permiso s/Goce'                  },
  { codes: ['ASU', 'ASUETO'],      label: 'Asueto'                          },
];

/** Builds the ordered array of display tokens for a DesgloseRow. */
export const buildTokens = (row: DesgloseRow): Token[] => {
  const tokens: Token[] = [];

  for (const { codes, label, isStatus } of INCIDENCE_DEFS) {
    const { count, dates } = getAbrev(row, ...codes);
    if (count <= 0) continue;

    const tokenLabel = formatDateToken(label, count, dates, isStatus);

    if (isStatus === true) {
      tokens.push({
        label:  tokenLabel,
        color:  'var(--success-text)',
        bg:     'var(--success-bg)',
        border: 'var(--success-border)',
      });
    } else if (isStatus === false) {
      tokens.push({
        label:  tokenLabel,
        color:  'var(--error-text)',
        bg:     'var(--error-bg)',
        border: 'var(--error-border)',
      });
    } else {
      tokens.push({
        label:  tokenLabel,
        color:  'var(--error-text)',
        bg:     'var(--error-bg)',
        border: 'var(--error-border)',
      });
    }
  }

  // ── Bonos (currency pills — NO date tracking) ─────────────────────────────
  const { Nocturno = 0, Mensual = 0, Abastecedor = 0 } = row.bonos ?? {};
  if (Number(Nocturno) > 0) {
    tokens.push({
      label:  `Noc: ${formatCurrency(Nocturno)}`,
      color:  'var(--color-violet, #7c3aed)',
      bg:     'rgba(124,58,237,0.08)',
      border: 'rgba(124,58,237,0.25)',
    });
  }
  if (Number(Mensual) > 0) {
    tokens.push({
      label:  `Mens: ${formatCurrency(Mensual)}`,
      color:  'var(--color-amber, #d97706)',
      bg:     'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.25)',
    });
  }
  if (Number(Abastecedor) > 0) {
    tokens.push({
      label:  `Abast: ${formatCurrency(Abastecedor)}`,
      color:  'var(--color-amber, #d97706)',
      bg:     'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.25)',
    });
  }

  // ── Extra Hours (kept as "X hrs" — NO date tracking per spec) ────────────
  const hx = Number(row.paid_extra_hours);
  if (hx > 0) {
    tokens.push({
      label:  `HX: ${hx}h`,
      color:  'var(--accent-primary)',
      bg:     'rgba(79,70,229,0.08)',
      border: 'rgba(79,70,229,0.25)',
    });
  }

  // ── Loan ─────────────────────────────────────────────────────────────────
  const loan = Number(row.loan_deduction);
  if (loan > 0) {
    const { pagos_realizados: done = 0, total_pagos: total = 0 } = row;
    tokens.push({
      label:  `Préstamo: ${formatCurrency(loan)} (${done}/${total})`,
      color:  'var(--error-text)',
      bg:     'var(--error-bg)',
      border: 'var(--error-border)',
    });
  }

  return tokens;
};

// ── Cell Renderers ────────────────────────────────────────────────────────────

/**
 * IncidencesCellRenderer
 *
 * Renders the "Resumen Operativo" column as a horizontal row of coloured
 * pill-shaped tokens, one per variation.
 *
 * In PayrollReport `data` is the raw DesgloseRow.
 * In HistoryView the column uses valueGetter to expose snap.desglose, so this
 * renderer always receives a plain DesgloseRow regardless of view.
 */
/**
 * NominaPillCellRenderer
 *
 * Renders the No. Nómina column as a compact, neutral pill badge.
 * Reads from `value` (set by valueGetter in the column def) with a fallback
 * to `data.no_nomina` or `data.empleado_no_nomina` when value is absent.
 */
export const NominaPillCellRenderer: React.FC<ICellRendererParams<DesgloseRow>> = ({ value, data }) => {
  const id: string =
    (value as string) ||
    (data as unknown as { empleado_no_nomina?: string })?.empleado_no_nomina ||
    data?.no_nomina ||
    '';

  if (!id) return null;

  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       '2px 8px',
        borderRadius:  '999px',
        fontSize:      '0.75rem',
        lineHeight:    '1rem',
        fontWeight:    700,
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
        background:    'var(--bg-secondary, #f1f5f9)',
        color:         'var(--text-secondary, #475569)',
        border:        '1px solid var(--border-color, #e2e8f0)',
        whiteSpace:    'nowrap',
      }}
    >
      {id}
    </span>
  );
};

export const IncidencesCellRenderer: React.FC<ICellRendererParams<DesgloseRow>> = ({ data }) => {
  if (!data) return null;
  const tokens = buildTokens(data);

  if (tokens.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  return (
    <div style={{
      display:    'flex',
      flexWrap:   'wrap',
      gap:        '0.3rem',
      alignItems: 'center',
      padding:    '0.3rem 0',
    }}>
      {tokens.map((tok, i) => (
        <span
          key={i}
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            padding:       '0.15rem 0.7rem',
            borderRadius:  '999px',
            fontSize:      '0.82rem',
            fontWeight:    700,
            letterSpacing: '0.03em',
            background:    tok.bg,
            color:         tok.color,
            border:        `1px solid ${tok.border}`,
            lineHeight:    1.5,
            whiteSpace:    'nowrap',
          }}
        >
          {tok.label}
        </span>
      ))}
    </div>
  );
};

/**
 * TotalPillCellRenderer
 *
 * Renders the "Total a Pagar" column as a green pill badge.
 *
 * Count-gate: only renders when ≥ 2 of the following monetary line items
 * are non-zero: Nocturno, Mensual, Abastecedor, loan_deduction.
 * `value` carries the pre-computed numeric total; `data` carries the full
 * DesgloseRow for the count-gate check.
 */
export const TotalPillCellRenderer: React.FC<ICellRendererParams<DesgloseRow>> = ({ value, data }) => {
  if (data == null || value == null) return null;

  const { Nocturno = 0, Mensual = 0, Abastecedor = 0 } = data.bonos ?? {};
  let count = 0;
  if (Number(Nocturno)           > 0) count++;
  if (Number(Mensual)            > 0) count++;
  if (Number(Abastecedor)        > 0) count++;
  if (Number(data.loan_deduction) > 0) count++;

  if (count < 2) return null;

  return (
    <span
      style={{
        display:            'inline-flex',
        alignItems:         'center',
        padding:            '0.25rem 0.9rem',
        borderRadius:       '999px',
        fontSize:           '1rem',
        fontWeight:         700,
        fontVariantNumeric: 'tabular-nums',
        background:         'rgba(5,150,105,0.1)',
        color:              'var(--color-emerald, #059669)',
        border:             '1px solid rgba(5,150,105,0.25)',
        letterSpacing:      '0.02em',
      }}
    >
      {formatCurrency(value)}
    </span>
  );
};
