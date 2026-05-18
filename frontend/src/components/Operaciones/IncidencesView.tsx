import React, { useState, useEffect, useCallback } from 'react';
import IncidenceForm from '../IncidenceForm';
import QuickSearch from '../QuickSearch';
import { ArrowClockwise } from '@phosphor-icons/react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import api from '../../api/axios';
import { PageShell, GlassCard, Button, ErrorState } from '../ui';
import '../modules.css';
import '../Dashboard.css';
import './Operaciones.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Incidence {
  id: number;
  fecha: string;
  semana_num: number;
  empleado: string;
  tipo_incidencia: number;
  cantidad: string;
}

interface Employee {
  no_nomina: string;
  nombre: string;
}

interface IncidenceCatalog {
  id: number;
  tipo: string;
  abreviatura: string;
}

interface IncidenceDisplay {
  id: number;
  empleado_no_nomina: string;
  empleado_nombre: string;
  tipo_incidencia: string;
  fecha: string;
}

const IncidencesView: React.FC = () => {
  const [incidences, setIncidences] = useState<IncidenceDisplay[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  const fetchCurrentWeek = async () => {
    try {
      const res = await api.get('/api/payroll/current-week/');
      if (res.data.current_week) {
        setCurrentWeek(res.data.current_week);
        setSelectedWeek(res.data.current_week);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentWeek();
  }, []);

  const fetchIncidences = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    setError(null);
    try {
      const [incRes, empRes, catRes] = await Promise.all([
        api.get('/api/payroll/incidence-records/'),
        api.get('/api/payroll/employees/'),
        api.get('/api/payroll/incidence-catalogs/')
      ]);

// Helper to calculate standard ISO week number
const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

      const empMap: Record<string, string> = {};
      (empRes.data as Employee[]).forEach(e => {
        empMap[e.no_nomina] = e.nombre;
      });

      const catMap: Record<number, string> = {};
      (catRes.data as IncidenceCatalog[]).forEach(c => {
        catMap[c.id] = c.tipo;
      });

      const rawData = incRes.data.results || incRes.data;
      const rawIncidences = (rawData as Incidence[]).filter(i => {
        if (!i.fecha) return false;
        // i.fecha is YYYY-MM-DD
        const [year, month, day] = i.fecha.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
        return getWeekNumber(dateObj) === selectedWeek;
      });
      // Sort by id descending as requested
      rawIncidences.sort((a, b) => b.id - a.id);

      const display: IncidenceDisplay[] = rawIncidences.map(i => ({
        id: i.id,
        empleado_no_nomina: i.empleado,
        empleado_nombre: empMap[i.empleado] || i.empleado,
        tipo_incidencia: catMap[i.tipo_incidencia] || 'Desconocido',
        fecha: i.fecha
      }));

      setIncidences(display);
    } catch {
      setError('No se pudieron cargar las incidencias. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIncidences();
  }, [fetchIncidences]);

  const columnDefs: ColDef[] = [
    { field: 'empleado_no_nomina', headerName: 'No. Nómina', sortable: true, filter: true, width: 140, getQuickFilterText: p => p.value ? p.value.toString() : '' },
    { field: 'empleado_nombre', headerName: 'Nombre', sortable: true, filter: true, flex: 2, getQuickFilterText: p => p.value ? p.value.toString() : '' },
    { field: 'tipo_incidencia', headerName: 'Tipo de Incidencia', sortable: true, filter: true, flex: 1.5, getQuickFilterText: p => p.value ? p.value.toString() : '' },
    { field: 'fecha', headerName: 'Fecha', sortable: true, filter: true, width: 150, headerClass: 'header-left-aligned', cellStyle: { textAlign: 'left' }, getQuickFilterText: p => p.value ? p.value.toString() : '' },
  ];

  return (
    <PageShell
      title="Incidencias"
      description="Registra faltas, permisos, días extra y asuetos. Selecciona «Asueto» para activar la opción de aplicación masiva."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {error && (
          <ErrorState
            title="Error al cargar incidencias"
            message={error}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setError(null); fetchIncidences(); }}
              >
                Reintentar
              </Button>
            }
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <IncidenceForm onIncidenceAdded={fetchIncidences} />
        </div>

        <GlassCard padding="md">
          <div className="operaciones-toolbar">
            <div className="operaciones-toolbar-left">
              <label htmlFor="week-selector" className="operaciones-toolbar-label">
                Semana No.
              </label>
              <select
                id="week-selector"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="operaciones-week-select"
              >
                {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>
                    Semana {w}{w === currentWeek ? ' (Actual)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="operaciones-toolbar-right">
              <QuickSearch value={quickFilterText} onChange={setQuickFilterText} />
              <Button variant="ghost" size="sm" onClick={fetchIncidences} disabled={loading}>
                <ArrowClockwise weight="bold" /> Actualizar
              </Button>
            </div>
          </div>

          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              theme="legacy"
              rowData={incidences}
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
                '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando incidencias…</span>'
              }
              overlayNoRowsTemplate={
                '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay incidencias para mostrar</span>'
              }
            />
          </div>
        </GlassCard>
      </div>
    </PageShell>
  );
};

export default IncidencesView;
