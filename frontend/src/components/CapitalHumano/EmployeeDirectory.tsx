import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowClockwise, 
  Users, 
  UserPlus, 
  UserMinus, 
  CircleNotch,
  FloppyDisk,
  WarningCircle,
  X,
  MagnifyingGlass
} from '@phosphor-icons/react';
import { formatTimeRange } from '../../utils/timeUtils';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams, GridReadyEvent } from 'ag-grid-community';
import api from '../../api/axios';
import { Button, GlassCard, Input, PageShell } from '../ui';
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
  const [quickFilterText, setQuickFilterText] = useState('');

  // Modal States
  const [isAltaModalOpen, setIsAltaModalOpen] = useState(false);
  const [isBajaModalOpen, setIsBajaModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [altaError, setAltaError] = useState<string | null>(null);
  const [bajaError, setBajaError] = useState<string | null>(null);

  // Form States (Alta)
  const [altaForm, setAltaForm] = useState({
    no_nomina: '',
    nombre: '',
    puesto: '',
    fecha_ingreso: '',
    horario_lv: '07:00 - 17:00',
    horario_s: '07:00 - 12:00'
  });

  // Form States (Baja)
  const [bajaForm, setBajaForm] = useState({
    no_nomina: '',
    fecha_baja: new Date().toISOString().split('T')[0],
    motivo_baja: ''
  });

  // Autocomplete State
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredActive = employees.filter(e => 
    e.is_active && 
    (e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
     e.no_nomina.includes(searchTerm))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleAltaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAltaError(null);
    try {
      await api.post('/api/payroll/employees/alta/', altaForm);
      setIsAltaModalOpen(false);
      setAltaError(null);
      setAltaForm({
        no_nomina: '',
        nombre: '',
        puesto: '',
        fecha_ingreso: '',
        horario_lv: '07:00 - 17:00',
        horario_s: '07:00 - 12:00'
      });
      fetchEmployees();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setAltaError(apiError.response?.data?.error || 'Error al crear empleado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBajaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bajaForm.no_nomina) return;
    setSubmitting(true);
    setBajaError(null);
    try {
      await api.post(`/api/payroll/employees/${bajaForm.no_nomina}/baja/`, {
        fecha_baja: bajaForm.fecha_baja,
        motivo_baja: bajaForm.motivo_baja
      });
      setIsBajaModalOpen(false);
      setBajaError(null);
      setBajaForm({ no_nomina: '', fecha_baja: new Date().toISOString().split('T')[0], motivo_baja: '' });
      fetchEmployees();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setBajaError(apiError.response?.data?.error || 'Error al dar de baja');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      sortable: true,
      filter: true,
      flex: 2,
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'puesto',
      headerName: 'Puesto',
      sortable: true,
      filter: true,
      flex: 1.5,
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'fecha_ingreso',
      headerName: 'Fecha Ingreso',
      sortable: true,
      filter: true,
      width: 140,
      valueFormatter: (p) => p.value ?? '—',
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'horario_lv',
      headerName: 'Horario L-V',
      sortable: true,
      filter: true,
      flex: 1,
      valueFormatter: (p) => p.value ?? '—',
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'horario_s',
      headerName: 'Horario S',
      sortable: true,
      filter: true,
      flex: 1,
      valueFormatter: (p) => p.value ?? '—',
      getQuickFilterText: p => p.value ? p.value.toString() : ''
    },
    {
      field: 'is_active',
      headerName: 'Estado',
      sortable: true,
      filter: true,
      width: 110,
      getQuickFilterText: p => p.value ? 'Activo' : 'Inactivo',
      cellRenderer: BadgeCellRenderer,
    },
  ];

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  };

  return (
    <>
      <PageShell>
        <div className="employee-directory-page">
          <GlassCard variant="strong" padding="lg" className="employee-directory-header">
            <div className="employee-directory-title-group">
              <div className="employee-directory-icon">
                <Users size={28} weight="duotone" />
              </div>
              <div>
                <h1>Directorio de Empleados</h1>
                <p>
                  {loading
                    ? 'Cargando…'
                    : `${employees.filter(e => e.is_active).length} activos · ${employees.length} total`}
                </p>
              </div>
            </div>
            <div className="employee-directory-actions">
              <label className="employee-directory-search">
                <MagnifyingGlass size={16} />
                <input
                  type="text"
                  placeholder="Buscar empleado"
                  value={quickFilterText}
                  onChange={(e) => setQuickFilterText(e.target.value)}
                />
              </label>
              <Button
                onClick={() => {
                  setAltaError(null);
                  setIsAltaModalOpen(true);
                }}
              >
                <UserPlus size={18} weight="bold" /> Alta de Empleado
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setBajaError(null);
                  setIsBajaModalOpen(true);
                }}
              >
                <UserMinus size={18} weight="bold" /> Baja de Empleado
              </Button>
              <Button
                id="btn-reload-directory"
                variant="secondary"
                onClick={fetchEmployees}
              >
                <ArrowClockwise weight="bold" /> Actualizar
              </Button>
            </div>
          </GlassCard>

          {error && <div className="ch-status error employee-directory-status">{error}</div>}

          <GlassCard className="employee-directory-grid-card ch-grid-wrapper">
            <div className="ag-theme-alpine employee-directory-grid">
              <AgGridReact
                theme="legacy"
                rowData={employees}
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
                  resizable: true,
                }}
                onGridReady={onGridReady}
                onRowClicked={(e) => {
                  if (e.data?.no_nomina) {
                    navigate(`/capital-humano/${e.data.no_nomina}`);
                  }
                }}
                autoSizeStrategy={{ type: 'fitGridWidth' }}
                overlayLoadingTemplate={
                  '<span style="color:var(--accent-primary);font-family:Inter,sans-serif;font-size:14px">Cargando empleados…</span>'
                }
                overlayNoRowsTemplate={
                  '<span style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:14px">No hay empleados registrados</span>'
                }
              />
            </div>
          </GlassCard>
        </div>
      </PageShell>

      {/* ── Modal Alta ── */}
      {isAltaModalOpen && (
        <div className="ch-modal-overlay employee-directory-modal-overlay" onClick={() => {
          setAltaError(null);
          setIsAltaModalOpen(false);
        }}>
          <div className="ch-modal employee-directory-modal employee-directory-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="employee-directory-modal-header">
              <h3>
                <span className="employee-directory-modal-icon">
                  <UserPlus size={24} weight="duotone" />
                </span>
                Alta de Nuevo Empleado
              </h3>
              <button
                type="button"
                className="employee-directory-close"
                aria-label="Cerrar alta de empleado"
                onClick={() => {
                  setAltaError(null);
                  setIsAltaModalOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAltaSubmit} className="ch-form">
              {altaError && <div className="employee-directory-modal-error">{altaError}</div>}
              <Input required type="text" label="No. Nómina" value={altaForm.no_nomina} onChange={e => setAltaForm({ ...altaForm, no_nomina: e.target.value })} placeholder="Ex: 1024" />
              <Input required type="date" label="Fecha Ingreso" value={altaForm.fecha_ingreso} onChange={e => setAltaForm({ ...altaForm, fecha_ingreso: e.target.value })} />
              <Input className="ch-form-full" required type="text" label="Nombre Completo" value={altaForm.nombre} onChange={e => setAltaForm({ ...altaForm, nombre: e.target.value })} placeholder="Nombre y Apellidos" />
              <Input className="ch-form-full" required type="text" label="Puesto" value={altaForm.puesto} onChange={e => setAltaForm({ ...altaForm, puesto: e.target.value })} placeholder="Puesto Operativo" />
              <Input
                  type="text"
                  label="Horario L-V"
                  value={altaForm.horario_lv}
                  onChange={e => setAltaForm({ ...altaForm, horario_lv: e.target.value })}
                  onBlur={e => setAltaForm({ ...altaForm, horario_lv: formatTimeRange(e.target.value) })}
                  placeholder="Ex: 8 - 5"
              />
              <Input
                  type="text"
                  label="Horario Sábado"
                  value={altaForm.horario_s}
                  onChange={e => setAltaForm({ ...altaForm, horario_s: e.target.value })}
                  onBlur={e => setAltaForm({ ...altaForm, horario_s: formatTimeRange(e.target.value) })}
                  placeholder="Ex: 7 - 12"
              />
              <div className="employee-directory-form-actions ch-form-full">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAltaError(null);
                    setIsAltaModalOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <CircleNotch className="animate-spin" /> : <FloppyDisk weight="fill" />}
                  Guardar Empleado
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Baja ── */}
      {isBajaModalOpen && (
        <div className="ch-modal-overlay employee-directory-modal-overlay" onClick={() => {
          setBajaError(null);
          setIsBajaModalOpen(false);
        }}>
          <div className="ch-modal employee-directory-modal" onClick={e => e.stopPropagation()}>
            <div className="employee-directory-modal-header">
              <h3>
                <span className="employee-directory-modal-icon employee-directory-modal-icon--danger">
                  <UserMinus size={24} weight="duotone" />
                </span>
                Baja de Empleado
              </h3>
              <button
                type="button"
                className="employee-directory-close"
                aria-label="Cerrar baja de empleado"
                onClick={() => {
                  setBajaError(null);
                  setIsBajaModalOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="employee-directory-warning">Esta acción desactivará al empleado del sistema de nómina activa.</p>
            <form onSubmit={handleBajaSubmit} className="ch-form employee-directory-baja-form">
              {bajaError && <div className="employee-directory-modal-error">{bajaError}</div>}
              <div className="ch-field employee-directory-autocomplete" ref={searchRef}>
                <label>Buscar Empleado</label>
                <div className="employee-directory-autocomplete-input">
                  <MagnifyingGlass size={16} />
                  <input
                    type="text"
                    placeholder="No. Nómina o Nombre..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                  />
                </div>
                {showResults && searchTerm && (
                  <div className="employee-directory-autocomplete-results">
                    {filteredActive.length > 0 ? (
                      filteredActive.map(emp => (
                        <div
                          key={emp.no_nomina}
                          onClick={() => {
                            setBajaForm({ ...bajaForm, no_nomina: emp.no_nomina });
                            setSearchTerm(`${emp.no_nomina} - ${emp.nombre}`);
                            setShowResults(false);
                          }}
                          className="autocomplete-item"
                        >
                          <span>{emp.nombre}</span>
                          <span>{emp.no_nomina}</span>
                        </div>
                      ))
                    ) : (
                      <div className="employee-directory-autocomplete-empty">No se encontraron resultados</div>
                    )}
                  </div>
                )}
              </div>
              <Input required type="date" label="Fecha de Baja" value={bajaForm.fecha_baja} onChange={e => setBajaForm({ ...bajaForm, fecha_baja: e.target.value })} />
              <label className="axis-input">
                <span className="axis-input__label">Motivo de Baja</span>
                <textarea
                  className="axis-input__control employee-directory-textarea"
                  required
                  value={bajaForm.motivo_baja}
                  onChange={e => setBajaForm({ ...bajaForm, motivo_baja: e.target.value })}
                  placeholder="Ej: Renuncia voluntaria, fin de contrato..."
                />
              </label>
              <div className="employee-directory-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setBajaError(null);
                    setIsBajaModalOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" disabled={submitting || !bajaForm.no_nomina}>
                  {submitting ? <CircleNotch className="animate-spin" /> : <WarningCircle weight="fill" />}
                  Confirmar Baja
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeDirectory;
