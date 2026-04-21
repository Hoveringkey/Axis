import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams, GridReadyEvent } from 'ag-grid-community';
import api from '../../api/axios';
import './CapitalHumano.css';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Employee {
  no_nomina: string;
  nombre: string;
  puesto: string;
  fecha_ingreso: string | null;
  is_active: boolean;
  horario_lv: string | null;
  horario_s: string | null;
}

const EmployeeDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/payroll/employees/');
      setEmployees(res.data);
      setError(null);
    } catch {
      setError('No se pudo cargar el directorio. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const BadgeCellRenderer = (params: ICellRendererParams) => {
    const isActive = params.value === true;
    return (
      <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
        {isActive ? 'Activo' : 'Inactivo'}
      </span>
    );
  };

  const columnDefs: ColDef[] = [
    {
      field: 'no_nomina',
      headerName: 'No. Nómina',
      sortable: true,
      filter: true,
      width: 130,
      pinned: 'left',
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      field: 'puesto',
      headerName: 'Puesto',
      sortable: true,
      filter: true,
      flex: 1.5,
    },
    {
      field: 'fecha_ingreso',
      headerName: 'Fecha Ingreso',
      sortable: true,
      filter: true,
      width: 140,
      valueFormatter: (p) => p.value ?? '—',
    },
    {
      field: 'horario_lv',
      headerName: 'Horario L-V',
      sortable: true,
      filter: true,
      flex: 1,
      valueFormatter: (p) => p.value ?? '—',
    },
    {
      field: 'horario_s',
      headerName: 'Horario S',
      sortable: true,
      filter: true,
      flex: 1,
      valueFormatter: (p) => p.value ?? '—',
    },
    {
      field: 'is_active',
      headerName: 'Estado',
      sortable: true,
      filter: true,
      width: 110,
      cellRenderer: BadgeCellRenderer,
    },
  ];

  const onGridReady = (_params: GridReadyEvent) => {
    // intentionally empty – grid auto-sizes via flex
  };

  return (
    <div className="ch-page">
      <div className="ch-page-header">
        <div>
          <h1>Directorio de Empleados</h1>
          <p>
            {loading
              ? 'Cargando…'
              : `${employees.filter(e => e.is_active).length} activos · ${employees.length} total`}
          </p>
        </div>
        <button
          id="btn-reload-directory"
          className="ch-btn ch-btn-ghost"
          onClick={fetchEmployees}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && <div className="ch-status error">{error}</div>}

      <div className="ch-card ch-grid-wrapper" style={{ height: '70vh' }}>
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            rowData={employees}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={25}
            animateRows={true}
            rowHeight={44}
            headerHeight={44}
            onGridReady={onGridReady}
            onRowClicked={(e) => {
              if (e.data?.no_nomina) {
                navigate(`/capital-humano/${e.data.no_nomina}`);
              }
            }}
            rowStyle={{ cursor: 'pointer' }}
            overlayLoadingTemplate={
              '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando empleados…</span>'
            }
            overlayNoRowsTemplate={
              '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay empleados registrados</span>'
            }
          />
        </div>
      </div>
    </div>
  );
};

export default EmployeeDirectory;
