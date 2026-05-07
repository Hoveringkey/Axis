import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import VacationStatus from './VacationStatus';
import { 
  IdentificationCard, 
  Calendar, 
  CircleNotch, 
  FloppyDisk, 
  ArrowsLeftRight, 
  CheckCircle, 
  CaretLeft,
  MagnifyingGlass,
  X
} from '@phosphor-icons/react';
import { Button, ErrorState, GlassCard, Input, LoadingState, PageShell, StatusBadge } from '../ui';
import './CapitalHumano.css';

type ActiveTab = 'datos' | 'vacaciones';

interface Employee {
  no_nomina: string;
  nombre: string;
  puesto: string;
  fecha_ingreso: string | null;
  is_active: boolean;
  horario_lv: string | null;
  horario_s: string | null;
}

interface SwapModalState {
  open: boolean;
  targetNomina: string;
  status: { type: 'success' | 'error'; message: string } | null;
  loading: boolean;
}

const EmployeeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('datos');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state (mirrors employee fields)
  const [nombre, setNombre] = useState('');
  const [puesto, setPuesto] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [horarioLv, setHorarioLv] = useState('');
  const [horarioS, setHorarioS] = useState('');

  // Swap modal
  const [swap, setSwap] = useState<SwapModalState>({
    open: false,
    targetNomina: '',
    status: null,
    loading: false,
  });
  const [swapSearchTerm, setSwapSearchTerm] = useState('');
  const [isSwapSearchOpen, setIsSwapSearchOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [empRes, allRes] = await Promise.all([
          api.get(`/api/payroll/employees/${id}/`),
          api.get('/api/payroll/employees/'),
        ]);
        const emp: Employee = empRes.data;
        setEmployee(emp);
        setAllEmployees(allRes.data);

        // Populate form
        setNombre(emp.nombre);
        setPuesto(emp.puesto);
        setFechaIngreso(emp.fecha_ingreso ?? '');
        setIsActive(emp.is_active);
        setHorarioLv(emp.horario_lv ?? '');
        setHorarioS(emp.horario_s ?? '');
        setFetchError(null);
      } catch {
        setFetchError('No se pudo cargar la información del empleado.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    setIsSaving(true);
    try {
      await api.patch(`/api/payroll/employees/${id}/`, {
        nombre,
        puesto,
        fecha_ingreso: fechaIngreso || null,
        is_active: isActive,
        horario_lv: horarioLv || null,
        horario_s: horarioS || null,
      });
      setSaveStatus({ type: 'success', message: 'Cambios guardados correctamente.' });
      // Refresh local employee data
      const res = await api.get(`/api/payroll/employees/${id}/`);
      setEmployee(res.data);
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        Object.values(err.response?.data ?? {})[0] ||
        'Error al guardar. Verifique los datos.';
      setSaveStatus({ type: 'error', message: String(detail) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwapSubmit = async () => {
    if (!swap.targetNomina || !id) return;
    setSwap(s => ({ ...s, loading: true, status: null }));
    try {
      await api.post('/api/payroll/employees/swap_shifts/', {
        no_nomina_1: id,
        no_nomina_2: swap.targetNomina,
      });
      setSwap(s => ({
        ...s,
        loading: false,
        status: { type: 'success', message: `Turnos intercambiados correctamente con ${swap.targetNomina}.` },
        targetNomina: '',
      }));
      // Refresh employee to show new schedule
      const res = await api.get(`/api/payroll/employees/${id}/`);
      const emp: Employee = res.data;
      setEmployee(emp);
      setHorarioLv(emp.horario_lv ?? '');
      setHorarioS(emp.horario_s ?? '');
    } catch (err: any) {
      setSwap(s => ({
        ...s,
        loading: false,
        status: {
          type: 'error',
          message: err.response?.data?.error || 'No se pudo realizar el intercambio.',
        },
      }));
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="1120px">
        <LoadingState message="Cargando información del empleado..." />
      </PageShell>
    );
  }

  if (fetchError || !employee) {
    return (
      <PageShell maxWidth="1120px">
        <ErrorState
          title="No se pudo cargar el empleado"
          message={fetchError ?? 'Empleado no encontrado.'}
          action={
            <Button variant="secondary" onClick={() => navigate('/capital-humano')}>
              <CaretLeft size={16} weight="bold" /> Volver al Directorio
            </Button>
          }
        />
      </PageShell>
    );
  }

  const otherEmployees = allEmployees.filter(e => e.no_nomina !== id);
  const selectedSwapEmployee = otherEmployees.find(emp => emp.no_nomina === swap.targetNomina);
  const normalizedSwapSearch = swapSearchTerm.trim().toLowerCase();
  const filteredSwapEmployees = (normalizedSwapSearch
    ? otherEmployees.filter(emp =>
        emp.no_nomina.toLowerCase().includes(normalizedSwapSearch) ||
        emp.nombre.toLowerCase().includes(normalizedSwapSearch)
      )
    : otherEmployees
  ).slice(0, 6);

  return (
    <PageShell maxWidth="1120px">
      <div className="employee-detail-page">
        <GlassCard variant="strong" padding="lg" className="employee-detail-header">
          <div className="employee-detail-header__main">
            <Button
              className="employee-detail-back"
              size="sm"
              variant="ghost"
              onClick={() => navigate('/capital-humano')}
            >
              <CaretLeft size={16} weight="bold" /> Directorio
            </Button>
            <div className="employee-detail-title-group">
              <div className="employee-detail-icon">
                <IdentificationCard size={28} weight="duotone" />
              </div>
              <div>
                <p className="employee-detail-eyebrow">Detalle de empleado</p>
                <h1>{employee.nombre}</h1>
                <div className="employee-detail-meta">
                  <span>No. Nómina: {employee.no_nomina}</span>
                  <span>{employee.puesto}</span>
                </div>
              </div>
            </div>
          </div>
          <StatusBadge variant={employee.is_active ? 'success' : 'neutral'}>
            {employee.is_active ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        </GlassCard>

        <GlassCard className="employee-detail-card" padding="none">
          <div className="employee-detail-tabs" role="tablist" aria-label="Detalle de empleado">
            <button
              id="tab-datos"
              type="button"
              role="tab"
              aria-selected={activeTab === 'datos'}
              className={`employee-detail-tab${activeTab === 'datos' ? ' active' : ''}`}
              onClick={() => setActiveTab('datos')}
            >
              <IdentificationCard size={18} weight={activeTab === 'datos' ? 'fill' : 'regular'} /> Datos
            </button>
            <button
              id="tab-vacaciones"
              type="button"
              role="tab"
              aria-selected={activeTab === 'vacaciones'}
              className={`employee-detail-tab${activeTab === 'vacaciones' ? ' active' : ''}`}
              onClick={() => setActiveTab('vacaciones')}
            >
              <Calendar size={18} weight={activeTab === 'vacaciones' ? 'fill' : 'regular'} /> Vacaciones
            </button>
          </div>

          <div className="employee-detail-tab-content">
            {activeTab === 'datos' && (
              <>
                {saveStatus && (
                  <div className={`employee-detail-status employee-detail-status--${saveStatus.type}`}>
                    {saveStatus.message}
                  </div>
                )}

                <form id="employee-edit-form" onSubmit={handleSave} className="employee-detail-form">
                  <Input
                    id="field-nombre"
                    required
                    type="text"
                    label="Nombre completo"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                  />

                  <Input
                    id="field-puesto"
                    required
                    type="text"
                    label="Puesto"
                    value={puesto}
                    onChange={e => setPuesto(e.target.value)}
                  />

                  <Input
                    className="employee-detail-date-input"
                    id="field-fecha-ingreso"
                    type="date"
                    label="Fecha de ingreso"
                    value={fechaIngreso}
                    onChange={e => setFechaIngreso(e.target.value)}
                  />

                  <div className="employee-detail-active-field">
                    <span className="axis-input__label">Estado</span>
                    <label className="employee-detail-checkbox" htmlFor="field-is-active">
                      <input
                        type="checkbox"
                        id="field-is-active"
                        checked={isActive}
                        onChange={e => setIsActive(e.target.checked)}
                      />
                      <span className="employee-detail-checkbox__control" aria-hidden="true" />
                      <span>Empleado activo</span>
                    </label>
                  </div>

                  <Input
                    id="field-horario-lv"
                    type="text"
                    label="Horario L-V"
                    value={horarioLv}
                    onChange={e => setHorarioLv(e.target.value)}
                    placeholder="ej. 08:00-17:00"
                  />

                  <Input
                    id="field-horario-s"
                    type="text"
                    label="Horario sábado"
                    value={horarioS}
                    onChange={e => setHorarioS(e.target.value)}
                    placeholder="ej. 08:00-13:00 (vacío si no aplica)"
                  />

                  <div className="employee-detail-actions">
                    <Button
                      id="btn-save-employee"
                      type="submit"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <><CircleNotch className="animate-spin" size={18} /> Guardando...</>
                      ) : (
                        <><FloppyDisk weight="fill" size={18} /> Guardar Cambios</>
                      )}
                    </Button>

                    <Button
                      id="btn-swap-shifts"
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSwapSearchTerm('');
                        setIsSwapSearchOpen(false);
                        setSwap(s => ({ ...s, open: true, status: null, targetNomina: '' }));
                      }}
                    >
                      <ArrowsLeftRight weight="bold" size={18} /> Intercambiar Turno
                    </Button>
                  </div>
                </form>
              </>
            )}

            {activeTab === 'vacaciones' && (
              <div className="employee-detail-vacations">
                <VacationStatus noNomina={employee.no_nomina} employeeName={employee.nombre} />
              </div>
            )}
          </div>
        </GlassCard>

        {swap.open && (
          <div
            className="ch-modal-overlay employee-swap-modal-overlay"
            onClick={() => {
              setSwapSearchTerm('');
              setIsSwapSearchOpen(false);
              setSwap(s => ({ ...s, open: false }));
            }}
          >
            <GlassCard
              className="employee-swap-modal"
              padding="lg"
              variant="strong"
              onClick={e => e.stopPropagation()}
            >
              <div className="employee-swap-modal__header">
                <div className="employee-swap-modal__title">
                  <span className="employee-swap-modal__icon">
                    <ArrowsLeftRight weight="duotone" size={24} />
                  </span>
                  <div>
                    <h3>Intercambiar Turno</h3>
                    <p>Selecciona el empleado destino para intercambiar horarios.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="employee-swap-modal__close"
                  aria-label="Cerrar intercambio de turno"
                  onClick={() => {
                    setSwapSearchTerm('');
                    setIsSwapSearchOpen(false);
                    setSwap(s => ({ ...s, open: false }));
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <p className="employee-swap-modal__copy">
                <strong>{employee.nombre}</strong> intercambiará sus horarios L-V y Sábado con el
                empleado seleccionado.
              </p>

              {swap.status && (
                <div className={`employee-detail-status employee-detail-status--${swap.status.type}`}>
                  {swap.status.message}
                </div>
              )}

              <div className="employee-swap-search">
                <span className="axis-input__label">Empleado destino</span>
                {!selectedSwapEmployee && (
                  <div className="employee-swap-search__input-wrap">
                    <MagnifyingGlass size={16} weight="bold" />
                    <input
                      id="swap-target"
                      className="employee-swap-search__input"
                      type="text"
                      placeholder="Buscar por nómina o nombre..."
                      value={swapSearchTerm}
                      onChange={e => {
                        setSwapSearchTerm(e.target.value);
                        setIsSwapSearchOpen(true);
                      }}
                      onFocus={() => setIsSwapSearchOpen(true)}
                    />
                  </div>
                )}

                {!selectedSwapEmployee && isSwapSearchOpen && (
                  <div className="employee-swap-search__results">
                    {filteredSwapEmployees.length > 0 ? (
                      filteredSwapEmployees.map(emp => {
                      return (
                        <button
                          key={emp.no_nomina}
                          type="button"
                          className="employee-swap-search__result"
                          onClick={() => {
                            setSwap(s => ({ ...s, targetNomina: emp.no_nomina }));
                            setSwapSearchTerm(`${emp.no_nomina} - ${emp.nombre}`);
                            setIsSwapSearchOpen(false);
                          }}
                        >
                          <span className="employee-swap-search__result-main">
                            <span>{emp.no_nomina}</span>
                            <span>{emp.nombre}</span>
                          </span>
                          {emp.puesto && (
                            <span className="employee-swap-search__result-meta">{emp.puesto}</span>
                          )}
                        </button>
                      );
                      })
                    ) : (
                      <div className="employee-swap-search__empty">No se encontraron empleados.</div>
                    )}
                  </div>
                )}

                {selectedSwapEmployee && (
                  <div className="employee-swap-search__selected">
                    <div>
                      <span>Empleado seleccionado</span>
                      <strong>{selectedSwapEmployee.no_nomina} - {selectedSwapEmployee.nombre}</strong>
                    </div>
                    <button
                      type="button"
                      className="employee-swap-search__clear"
                      aria-label="Limpiar empleado seleccionado"
                      onClick={() => {
                        setSwap(s => ({ ...s, targetNomina: '' }));
                        setSwapSearchTerm('');
                        setIsSwapSearchOpen(false);
                      }}
                    >
                      <X size={16} weight="bold" />
                    </button>
                  </div>
                )}
              </div>

              <div className="employee-swap-modal__actions">
                <Button
                  id="btn-confirm-swap"
                  onClick={handleSwapSubmit}
                  disabled={!swap.targetNomina || swap.loading}
                >
                  {swap.loading ? (
                    <><CircleNotch className="animate-spin" size={18} /> Procesando...</>
                  ) : (
                    <><CheckCircle weight="fill" size={18} /> Confirmar Intercambio</>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSwapSearchTerm('');
                    setIsSwapSearchOpen(false);
                    setSwap(s => ({ ...s, open: false }));
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default EmployeeDetail;
