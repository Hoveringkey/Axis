import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import api from '../../api/axios';
import '../modules.css';
import '../Dashboard.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

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
    <div className="module-page">
      <div className="module-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>⏱️ Banco de Horas Extra</h1>
          <p>
            {loading
              ? 'Cargando…'
              : `${rows.length} registros · Total acumulado: ${totalHours.toFixed(2)} hrs`}
          </p>
        </div>
        <div
          id="btn-reload-extra-hours"
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          🔄 Actualizar
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.875rem 1rem',
          background: 'var(--error-bg)',
          border: '1px solid var(--error-border)',
          borderRadius: '8px',
          color: 'var(--error-text)',
          fontSize: '0.875rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      <div className="eh-grid-wrapper" style={{ height: '65vh' }}>
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={25}
            animateRows={true}
            rowHeight={44}
            headerHeight={44}
            overlayLoadingTemplate={
              '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando banco de horas…</span>'
            }
            overlayNoRowsTemplate={
              '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay registros de horas extra</span>'
            }
          />
        </div>
      </div>
    </div>
  );
};

export default ExtraHoursView;
