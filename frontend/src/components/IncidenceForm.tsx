import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { CalendarPlus, CircleNotch, FloppyDisk, CaretDown, Check } from '@phosphor-icons/react';

interface Employee {
  no_nomina: string;
  nombre: string;
  horario_s?: string;
}

interface IncidenceCatalog {
  id: number;
  tipo: string;
  abreviatura: string;
}

interface IncidenceFormProps {
  onIncidenceAdded?: () => void | Promise<void>;
}

const getISOWeekNumber = (dateString: string) => {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const IncidenceForm: React.FC<IncidenceFormProps> = ({ onIncidenceAdded }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [catalogs, setCatalogs] = useState<IncidenceCatalog[]>([]);

  const [fecha, setFecha] = useState(getTodayDateString());
  const [empleado, setEmpleado] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [aplicarATodos, setAplicarATodos] = useState(false);

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchCatalogs();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/payroll/employees/');
      setEmployees(response.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const response = await api.get('/api/payroll/incidence-catalogs/');
      setCatalogs(response.data);
    } catch (err) {
      console.error('Failed to fetch catalogs', err);
    }
  };

  // Determine if the selected catalog is 'Asueto'
  const selectedCatalog = catalogs.find(c => c.id === parseInt(tipoIncidencia));
  const isAsueto = selectedCatalog?.abreviatura === 'ASU';

  // Reset the checkbox when the type changes away from Asueto
  useEffect(() => {
    if (!isAsueto) {
      setAplicarATodos(false);
    }
  }, [isAsueto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setIsLoading(true);

    try {
      // ── BULK ASUETO path ──
      if (isAsueto && aplicarATodos) {
        await api.post('/api/payroll/incidence-records/bulk_asueto/', {
          fecha,
        });
        setStatus({ type: 'success', message: 'Asueto masivo aplicado correctamente a todos los empleados activos.' });
        setFecha(getTodayDateString());
        setTipoIncidencia('');
        setAplicarATodos(false);
        await onIncidenceAdded?.();
        return;
      }

      // ── SINGLE EMPLOYEE path ──
      const qty = parseFloat(cantidad);
      const promises = [];

      const selectedEmployee = employees.find(
        emp => emp.no_nomina === empleado || emp.nombre === empleado
      );
      if (!selectedEmployee) {
        setStatus({ type: 'error', message: 'Empleado no encontrado. Seleccione uno válido.' });
        setIsLoading(false);
        return;
      }
      const empleadoId = selectedEmployee.no_nomina;

      const isNumeric = ['HX', 'HE', 'DA'].includes(selectedCatalog?.abreviatura || '');

      if (qty > 1 && !isNumeric) {
        let remainingQty = qty;
        const [y, m, d] = fecha.split('-').map(Number);
        const currentDate = new Date(y, m - 1, d);
        let iterations = 0;

        while (remainingQty > 0) {
          iterations++;
          if (iterations >= 30) break;

          const dayOfWeek = currentDate.getDay();
          const isSunday = dayOfWeek === 0;
          const isSaturdayRest =
            dayOfWeek === 6 &&
            (!selectedEmployee?.horario_s || selectedEmployee.horario_s === '-');

          if (isSunday || isSaturdayRest) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          const currentQty = remainingQty >= 1 ? 1 : remainingQty;
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;

          promises.push(
            api.post('/api/payroll/incidence-records/', {
              fecha: dateString,
              semana_num: getISOWeekNumber(dateString),
              empleado: empleadoId,
              tipo_incidencia: parseInt(tipoIncidencia, 10),
              cantidad: currentQty,
            })
          );

          currentDate.setDate(currentDate.getDate() + 1);
          remainingQty -= 1;
        }
      } else {
        promises.push(
          api.post('/api/payroll/incidence-records/', {
            fecha,
            semana_num: getISOWeekNumber(fecha),
            empleado: empleadoId,
            tipo_incidencia: parseInt(tipoIncidencia, 10),
            cantidad: qty,
          })
        );
      }

      await Promise.all(promises);

      setStatus({ type: 'success', message: 'Incidencia registrada correctamente.' });
      setFecha(getTodayDateString());
      setEmpleado('');
      setTipoIncidencia('');
      setCantidad('');
      await onIncidenceAdded?.();
    } catch (err: any) {
      let errorMessage = 'Error al registrar incidencia. Verifique los datos.';
      if (err.response?.data) {
        if (Array.isArray(err.response.data.non_field_errors)) {
          errorMessage = err.response.data.non_field_errors[0];
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (typeof err.response.data === 'object') {
          const firstKey = Object.keys(err.response.data)[0];
          if (Array.isArray(err.response.data[firstKey])) {
            errorMessage = `${firstKey}: ${err.response.data[firstKey][0]}`;
          }
        }
      }
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <h3>Registrar Incidencia</h3>
        <p>Ingrese los datos de la nueva incidencia.</p>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>{status.message}</div>
      )}

      <form onSubmit={handleSubmit} className="data-form">
        {/* Date */}
        <div className="form-group">
          <label htmlFor="fecha">Fecha</label>
          <input
            type="date"
            id="fecha"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            required
          />
        </div>

        {/* Incidence Type — custom premium dropdown */}
        <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
          <label htmlFor="tipoIncidencia">Tipo de Incidencia</label>
          <div 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              padding: '0.7rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)', color: tipoIncidencia ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', transition: 'all 0.2s ease',
              boxShadow: dropdownOpen ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : 'none',
              borderColor: dropdownOpen ? 'var(--accent-primary)' : 'var(--border-color)'
            }}
          >
            <span>{selectedCatalog ? selectedCatalog.tipo : 'Seleccionar tipo…'}</span>
            <CaretDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: '10px', marginTop: '6px', boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden', animation: 'slideDown 0.2s ease'
            }}>
              {catalogs.map(cat => (
                <div 
                  key={cat.id}
                  onClick={() => {
                    setTipoIncidencia(String(cat.id));
                    setDropdownOpen(false);
                  }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.875rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: tipoIncidencia === String(cat.id) ? 'var(--accent-light)' : 'transparent',
                    color: tipoIncidencia === String(cat.id) ? 'var(--accent-primary)' : 'var(--text-main)',
                  }}
                  className="premium-dropdown-item"
                >
                  {cat.tipo}
                  {tipoIncidencia === String(cat.id) && <Check size={14} weight="bold" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* "Aplicar a todos" checkbox — only visible when Asueto is selected */}
        {isAsueto && (
          <div className="form-group" id="asueto-bulk-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <input
                type="checkbox"
                id="aplicar-a-todos"
                checked={aplicarATodos}
                onChange={e => setAplicarATodos(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-amber)' }}
              />
              <label
                htmlFor="aplicar-a-todos"
                style={{ fontSize: '0.875rem', color: 'var(--color-amber)', cursor: 'pointer', fontWeight: 600 }}
              >
                Aplicar a todos los empleados activos (Asueto masivo)
              </label>
            </div>
            {aplicarATodos && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 26px' }}>
                Se aplicará la fecha seleccionada a todos los empleados activos que no tengan ya una incidencia en ese día.
              </p>
            )}
          </div>
        )}

        {/* Employee — hidden when bulk asueto is active */}
        {!aplicarATodos && (
          <div className="form-group">
            <label htmlFor="empleado">Empleado</label>
            <input
              list="employee-options"
              id="empleado"
              value={empleado}
              onChange={e => setEmpleado(e.target.value)}
              placeholder="Buscar por No. o Nombre…"
              required={!aplicarATodos}
            />
            <datalist id="employee-options">
              {employees.map(emp => (
                <option key={emp.no_nomina} value={emp.no_nomina}>
                  {emp.nombre}
                </option>
              ))}
            </datalist>
          </div>
        )}

        {/* Quantity — hidden when bulk asueto is active */}
        {!aplicarATodos && (
          <div className="form-group">
            <label htmlFor="cantidad">Cantidad</label>
            <input
              type="number"
              id="cantidad"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0.00"
              step="0.01"
              required={!aplicarATodos}
            />
          </div>
        )}

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? (
            <><CircleNotch className="animate-spin" size={18} /> Guardando…</>
          ) : aplicarATodos ? (
            <><CalendarPlus size={18} weight="fill" /> Aplicar Asueto Masivo</>
          ) : (
            <><FloppyDisk size={18} weight="fill" /> Guardar Incidencia</>
          )}
        </button>
      </form>
    </div>
  );
};

export default IncidenceForm;
