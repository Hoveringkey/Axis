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

  // Modal States
  const [isAltaModalOpen, setIsAltaModalOpen] = useState(false);
  const [isBajaModalOpen, setIsBajaModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    try {
      await api.post('/api/payroll/employees/alta/', altaForm);
      setIsAltaModalOpen(false);
      setAltaForm({
        no_nomina: '',
        nombre: '',
        puesto: '',
        fecha_ingreso: '',
        horario_lv: '07:00 - 17:00',
        horario_s: '07:00 - 12:00'
      });
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear empleado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBajaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bajaForm.no_nomina) return;
    setSubmitting(true);
    try {
      await api.post(`/api/payroll/employees/${bajaForm.no_nomina}/baja/`, {
        fecha_baja: bajaForm.fecha_baja,
        motivo_baja: bajaForm.motivo_baja
      });
      setIsBajaModalOpen(false);
      setBajaForm({ no_nomina: '', fecha_baja: new Date().toISOString().split('T')[0], motivo_baja: '' });
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al dar de baja');
    } finally {
      setSubmitting(false);
    }
  };

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

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  };

  return (
    <>
      <div className="ch-page">
      <div className="ch-page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Users size={32} weight="duotone" color="var(--accent-primary)" />
            Directorio de Empleados
          </h1>
          <p>
            {loading
              ? 'Cargando…'
              : `${employees.filter(e => e.is_active).length} activos · ${employees.length} total`}
          </p>
        </div>
        <div className="ch-actions">
          <button
            className="ch-btn ch-btn-primary"
            onClick={() => setIsAltaModalOpen(true)}
          >
            <UserPlus size={18} weight="bold" /> Alta de Empleado
          </button>
          <button
            className="ch-btn ch-btn-ghost"
            style={{ color: 'var(--error-text)', borderColor: 'var(--error-border)' }}
            onClick={() => setIsBajaModalOpen(true)}
          >
            <UserMinus size={18} weight="bold" /> Baja de Empleado
          </button>
          <button
            id="btn-reload-directory"
            className="ch-btn ch-btn-ghost"
            onClick={fetchEmployees}
          >
            <ArrowClockwise weight="bold" /> Actualizar
          </button>
        </div>
      </div>

      {error && <div className="ch-status error">{error}</div>}

      <div className="ch-card ch-grid-wrapper" style={{ padding: '1.5rem' }}>
        <div className="ag-theme-alpine" style={{ width: '100%' }}>
          <AgGridReact
            rowData={employees}
            columnDefs={columnDefs}
            pagination={false}
            suppressPaginationPanel={true}
            domLayout="autoHeight"
            animateRows={true}
            rowHeight={52}
            headerHeight={52}
            onGridReady={onGridReady}
            onRowClicked={(e) => {
              if (e.data?.no_nomina) {
                navigate(`/capital-humano/${e.data.no_nomina}`);
              }
            }}
            rowStyle={{ cursor: 'pointer', borderBottom: '1px solid var(--bg-secondary)' }}
            autoSizeStrategy={{ type: 'fitGridWidth' }}
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

      {/* ── Modal Alta ── */}
      {isAltaModalOpen && (
        <div className="ch-modal-overlay" onClick={() => setIsAltaModalOpen(false)}>
          <div className="ch-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={24} weight="duotone" color="var(--accent-primary)" />
                Alta de Nuevo Empleado
              </h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAltaModalOpen(false)} />
            </div>
            <form onSubmit={handleAltaSubmit} className="ch-form">
              <div className="ch-field">
                <label>No. Nómina</label>
                <input required type="text" value={altaForm.no_nomina} onChange={e => setAltaForm({ ...altaForm, no_nomina: e.target.value })} placeholder="Ex: 1024" />
              </div>
              <div className="ch-field">
                <label>Fecha Ingreso</label>
                <input required type="date" value={altaForm.fecha_ingreso} onChange={e => setAltaForm({ ...altaForm, fecha_ingreso: e.target.value })} />
              </div>
              <div className="ch-field ch-form-full">
                <label>Nombre Completo</label>
                <input required type="text" value={altaForm.nombre} onChange={e => setAltaForm({ ...altaForm, nombre: e.target.value })} placeholder="Nombre y Apellidos" />
              </div>
              <div className="ch-field ch-form-full">
                <label>Puesto</label>
                <input required type="text" value={altaForm.puesto} onChange={e => setAltaForm({ ...altaForm, puesto: e.target.value })} placeholder="Puesto Operativo" />
              </div>
              <div className="ch-field">
                <label>Horario L-V</label>
                <input 
                  type="text" 
                  value={altaForm.horario_lv} 
                  onChange={e => setAltaForm({ ...altaForm, horario_lv: e.target.value })} 
                  onBlur={e => setAltaForm({ ...altaForm, horario_lv: formatTimeRange(e.target.value) })}
                  placeholder="Ex: 8 - 5" 
                />
              </div>
              <div className="ch-field">
                <label>Horario Sábado</label>
                <input 
                  type="text" 
                  value={altaForm.horario_s} 
                  onChange={e => setAltaForm({ ...altaForm, horario_s: e.target.value })} 
                  onBlur={e => setAltaForm({ ...altaForm, horario_s: formatTimeRange(e.target.value) })}
                  placeholder="Ex: 7 - 12" 
                />
              </div>
              <div className="ch-actions ch-form-full" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="ch-btn ch-btn-ghost" onClick={() => setIsAltaModalOpen(false)}>Cancelar</button>
                <button type="submit" className="ch-btn ch-btn-primary" disabled={submitting}>
                  {submitting ? <CircleNotch className="animate-spin" /> : <FloppyDisk weight="fill" />} 
                  Guardar Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Baja ── */}
      {isBajaModalOpen && (
        <div className="ch-modal-overlay" onClick={() => setIsBajaModalOpen(false)}>
          <div className="ch-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserMinus size={24} weight="duotone" color="var(--error-text)" />
                Baja de Empleado
              </h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsBajaModalOpen(false)} />
            </div>
            <p style={{ marginBottom: '1.5rem' }}>Esta acción desactivará al empleado del sistema de nómina activa.</p>
            <form onSubmit={handleBajaSubmit} className="ch-form" style={{ gridTemplateColumns: '1fr' }}>
              <div className="ch-field" ref={searchRef} style={{ position: 'relative' }}>
                <label>Buscar Empleado</label>
                <div style={{ position: 'relative' }}>
                  <MagnifyingGlass size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="No. Nómina o Nombre..." 
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    style={{ paddingLeft: '36px', width: '100%' }}
                  />
                </div>
                {showResults && searchTerm && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', marginTop: '4px', boxShadow: 'var(--shadow-lg)',
                    maxHeight: '200px', overflowY: 'auto'
                  }}>
                    {filteredActive.length > 0 ? (
                      filteredActive.map(emp => (
                        <div 
                          key={emp.no_nomina}
                          onClick={() => {
                            setBajaForm({ ...bajaForm, no_nomina: emp.no_nomina });
                            setSearchTerm(`${emp.no_nomina} - ${emp.nombre}`);
                            setShowResults(false);
                          }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', fontSize: '0.875rem',
                            borderBottom: '1px solid var(--bg-primary)',
                            display: 'flex', justifyContent: 'space-between'
                          }}
                          className="autocomplete-item"
                        >
                          <span>{emp.nombre}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{emp.no_nomina}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '14px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No se encontraron resultados</div>
                    )}
                  </div>
                )}
              </div>
              <div className="ch-field">
                <label>Fecha de Baja</label>
                <input required type="date" value={bajaForm.fecha_baja} onChange={e => setBajaForm({ ...bajaForm, fecha_baja: e.target.value })} />
              </div>
              <div className="ch-field">
                <label>Motivo de Baja</label>
                <textarea 
                  required 
                  value={bajaForm.motivo_baja} 
                  onChange={e => setBajaForm({ ...bajaForm, motivo_baja: e.target.value })}
                  placeholder="Ej: Renuncia voluntaria, fin de contrato..."
                  style={{ 
                    padding: '0.7rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.9rem',
                    fontFamily: 'Inter, sans-serif', minHeight: '80px', resize: 'vertical'
                  }}
                />
              </div>
              <div className="ch-actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="ch-btn ch-btn-ghost" onClick={() => setIsBajaModalOpen(false)}>Cancelar</button>
                <button type="submit" className="ch-btn" disabled={submitting || !bajaForm.no_nomina} style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}>
                  {submitting ? <CircleNotch className="animate-spin" /> : <WarningCircle weight="fill" />} 
                  Confirmar Baja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeDirectory;
