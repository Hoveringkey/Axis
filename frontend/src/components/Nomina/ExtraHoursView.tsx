import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import api from '../../api/axios';
import { ArrowClockwise } from '@phosphor-icons/react';
import { PageShell, GlassCard, Button, ErrorState, EmptyState } from '../ui';
import '../modules.css';
import '../Dashboard.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './Nomina.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ExtraHourRecord {
  id: number;
  empleado: string; // no_nomina FK
  horas_deuda: string;
}

interface Employee {
  no_nomina: string;
  nombre: string;
}

interface DisplayRow {
  id: number;
  no_nomina: string;
  nombre: string;
  horas_deuda: number;
}

const ExtraHoursView: React.FC = () => {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ehRes, empRes] = await Promise.all([
        api.get('/api/payroll/extra-hour-banks/'),
        api.get('/api/payroll/employees/'),
      ]);

      const empMap: Record<string, string> = {};
      (empRes.data as Employee[]).forEach(e => {
        empMap[e.no_nomina] = e.nombre;
      });

      const display: DisplayRow[] = (ehRes.data as ExtraHourRecord[]).map(r => ({
        id: r.id,
        no_nomina: r.empleado,
        nombre: empMap[r.empleado] ?? r.empleado,
        horas_deuda: parseFloat(r.horas_deuda),
      }));

      setRows(display);
    } catch {
      setError('No se pudo cargar el banco de horas extra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const totalHours = rows.reduce((s, r) => s + r.horas_deuda, 0);

  const columnDefs: ColDef[] = [
    { field: 'no_nomina', headerName: 'No. Nómina', sortable: true, filter: true, width: 140 },
    { field: 'nombre', headerName: 'Nombre', sortable: true, filter: true, flex: 2 },
    {
      field: 'horas_deuda',
      headerName: 'Horas en Deuda',
      sortable: true,
      filter: true,
      flex: 1,
      type: 'numericColumn',
      valueFormatter: p => `${parseFloat(p.value).toFixed(2)} hrs`,
      cellStyle: (p) => ({
        color: p.value > 0 ? 'var(--error-text)' : 'var(--success-text)',
        fontWeight: 600,
      }),
    },
  ];

  return (
    <PageShell
      title="Banco de Horas Extra"
      description="Consulta el banco acumulado de horas extra por empleado y valida saldos pendientes."
      actions={
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <ArrowClockwise weight="bold" /> Actualizar
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {error && (
          <ErrorState
            title="Error al cargar banco de horas"
            message={error}
            action={
              <Button variant="secondary" size="sm" onClick={fetchData}>
                Reintentar
              </Button>
            }
          />
        )}

        <GlassCard padding="md">
          {!loading && !error && rows.length > 0 && (
            <div className="nomina-summary-grid">
              <div className="nomina-summary-card">
                <span className="nomina-summary-label">Registros</span>
                <span className="nomina-summary-value">{rows.length}</span>
              </div>
              <div className="nomina-summary-card">
                <span className="nomina-summary-label">Total acumulado</span>
                <span className="nomina-summary-value">{totalHours.toFixed(2)} hrs</span>
              </div>
            </div>
          )}

          {!loading && !error && rows.length === 0 ? (
            <EmptyState title="No hay registros de horas extra." />
          ) : (
            <div className="ag-theme-alpine" style={{ width: '100%' }}>
              <AgGridReact
                theme="legacy"
                rowData={rows}
                columnDefs={columnDefs}
                pagination={false}
                suppressPaginationPanel={true}
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
                  '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando banco de horas…</span>'
                }
                overlayNoRowsTemplate={
                  '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay registros de horas extra</span>'
                }
              />
            </div>
          )}
        </GlassCard>
      </div>
    </PageShell>
  );
};

export default ExtraHoursView;
