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
  CaretLeft
} from '@phosphor-icons/react';
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
      <div className="ch-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 60px)' }}>
      <div className="kpi-spinner" />
    </div>
    );
  }

  if (fetchError || !employee) {
    return (
      <div className="ch-page">
        <div className="ch-status error">{fetchError ?? 'Empleado no encontrado.'}</div>
        <button className="ch-btn ch-btn-ghost" onClick={() => navigate('/capital-humano')}>
          ← Volver al Directorio
        </button>
      </div>
    );
  }

  const otherEmployees = allEmployees.filter(e => e.no_nomina !== id);

  return (
    <div className="ch-page">
      {/* Header */}
      <div className="ch-page-header">
        <div>
          <button className="ch-back-btn" onClick={() => navigate('/capital-humano')}>
            <CaretLeft size={16} weight="bold" /> Directorio
          </button>
          <h1 style={{ marginTop: '0.625rem' }}>{employee.nombre}</h1>
          <p>No. Nómina: {employee.no_nomina} · {employee.puesto}</p>
        </div>
        <span className={`badge ${employee.is_active ? 'badge-active' : 'badge-inactive'}`}>
          {employee.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="ch-card">
        {/* Tabs */}
        <div className="ch-tabs">
          <button
            id="tab-datos"
            className={`ch-tab${activeTab === 'datos' ? ' active' : ''}`}
            onClick={() => setActiveTab('datos')}
          >
            <IdentificationCard size={18} weight={activeTab === 'datos' ? 'fill' : 'regular'} /> Datos
          </button>
          <button
            id="tab-vacaciones"
            className={`ch-tab${activeTab === 'vacaciones' ? ' active' : ''}`}
            onClick={() => setActiveTab('vacaciones')}
          >
            <Calendar size={18} weight={activeTab === 'vacaciones' ? 'fill' : 'regular'} /> Vacaciones
          </button>
        </div>

        <div className="ch-tab-content">
          {/* ── DATOS TAB ── */}
          {activeTab === 'datos' && (
            <>
              {saveStatus && (
                <div className={`ch-status ${saveStatus.type}`}>{saveStatus.message}</div>
              )}

              <form id="employee-edit-form" onSubmit={handleSave} className="ch-form">
                <div className="ch-field">
                  <label htmlFor="field-nombre">Nombre Completo</label>
                  <input
                    id="field-nombre"
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="ch-field">
                  <label htmlFor="field-puesto">Puesto</label>
                  <input
                    id="field-puesto"
                    type="text"
                    value={puesto}
                    onChange={e => setPuesto(e.target.value)}
                    required
                  />
                </div>

                <div className="ch-field">
                  <label htmlFor="field-fecha-ingreso">Fecha de Ingreso</label>
                  <input
                    id="field-fecha-ingreso"
                    type="date"
                    value={fechaIngreso}
                    onChange={e => setFechaIngreso(e.target.value)}
                  />
                </div>

                <div className="ch-field" style={{ justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                  <div className="ch-checkbox-row">
                    <input
                      type="checkbox"
                      id="field-is-active"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                    />
                    <label htmlFor="field-is-active">Empleado activo</label>
                  </div>
                </div>

                <div className="ch-field">
                  <label htmlFor="field-horario-lv">Horario L-V</label>
                  <input
                    id="field-horario-lv"
                    type="text"
                    value={horarioLv}
                    onChange={e => setHorarioLv(e.target.value)}
                    placeholder="ej. 08:00-17:00"
                  />
                </div>

                <div className="ch-field">
                  <label htmlFor="field-horario-s">Horario Sábado</label>
                  <input
                    id="field-horario-s"
                    type="text"
                    value={horarioS}
                    onChange={e => setHorarioS(e.target.value)}
                    placeholder="ej. 08:00-13:00 (vacío si no aplica)"
                  />
                </div>

                <div className="ch-form-full ch-actions">
                  <button
                    id="btn-save-employee"
                    type="submit"
                    className="ch-btn ch-btn-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <><CircleNotch className="animate-spin" size={18} /> Guardando…</>
                    ) : (
                      <><FloppyDisk weight="fill" size={18} /> Guardar Cambios</>
                    )}
                  </button>

                  <button
                    id="btn-swap-shifts"
                    type="button"
                    className="ch-btn ch-btn-swap"
                    onClick={() => setSwap(s => ({ ...s, open: true, status: null, targetNomina: '' }))}
                  >
                    <ArrowsLeftRight weight="bold" size={18} /> Intercambiar Turno
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── VACACIONES TAB ── */}
          {activeTab === 'vacaciones' && (
            <VacationStatus noNomina={employee.no_nomina} employeeName={employee.nombre} />
          )}
        </div>
      </div>

      {/* ── SWAP MODAL ── */}
      {swap.open && (
        <div className="ch-modal-overlay" onClick={() => setSwap(s => ({ ...s, open: false }))}>
          <div className="ch-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowsLeftRight weight="duotone" size={24} color="var(--accent-primary)" />
              Intercambiar Turno
            </h3>
            <p>
              Selecciona el empleado con quien <strong>{employee.nombre}</strong> intercambiará
              sus horarios (L-V y Sábado).
            </p>

            {swap.status && (
              <div className={`ch-status ${swap.status.type}`} style={{ marginBottom: '1rem' }}>
                {swap.status.message}
              </div>
            )}

            <div className="ch-field" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="swap-target">Empleado Destino</label>
              <select
                id="swap-target"
                value={swap.targetNomina}
                onChange={e => setSwap(s => ({ ...s, targetNomina: e.target.value }))}
              >
                <option value="">— Seleccionar empleado —</option>
                {otherEmployees.map(emp => (
                  <option key={emp.no_nomina} value={emp.no_nomina}>
                    {emp.no_nomina} — {emp.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="ch-actions">
              <button
                id="btn-confirm-swap"
                className="ch-btn ch-btn-primary"
                onClick={handleSwapSubmit}
                disabled={!swap.targetNomina || swap.loading}
              >
                {swap.loading ? (
                  <><CircleNotch className="animate-spin" size={18} /> Procesando…</>
                ) : (
                  <><CheckCircle weight="fill" size={18} /> Confirmar Intercambio</>
                )}
              </button>
              <button
                className="ch-btn ch-btn-ghost"
                onClick={() => setSwap(s => ({ ...s, open: false }))}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetail;
