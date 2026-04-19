import React, { useState, useEffect } from 'react';
import api from '../api/axios';

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

const IncidenceForm: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [catalogs, setCatalogs] = useState<IncidenceCatalog[]>([]);
  
  const [fecha, setFecha] = useState(getTodayDateString());
  const [empleado, setEmpleado] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('');
  const [cantidad, setCantidad] = useState('');

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setIsLoading(true);

    try {
      const qty = parseFloat(cantidad);
      const promises = [];

      const selectedEmployee = employees.find(emp => emp.no_nomina === empleado);
      const selectedCatalog = catalogs.find(c => c.id === parseInt(tipoIncidencia));
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
          const isSaturdayRest = dayOfWeek === 6 && (!selectedEmployee?.horario_s || selectedEmployee.horario_s === "-");

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
              empleado,
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
            empleado,
            tipo_incidencia: parseInt(tipoIncidencia, 10),
            cantidad: qty,
          })
        );
      }

      await Promise.all(promises);
      
      setStatus({ type: 'success', message: 'Incidence record successfully created!' });
      // Reset form
      setFecha(getTodayDateString());
      setEmpleado('');
      setTipoIncidencia('');
      setCantidad('');
    } catch (err: any) {
      let errorMessage = 'Failed to create incidence record. Check your data.';
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
      
      setStatus({ 
        type: 'error', 
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <h3>Record Incidence</h3>
        <p>Enter details for the new incidence record.</p>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="data-form">
        <div className="form-group">
          <label htmlFor="fecha">Date</label>
          <input
            type="date"
            id="fecha"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="empleado">Employee</label>
          <input
            list="employee-options"
            id="empleado"
            value={empleado}
            onChange={(e) => setEmpleado(e.target.value)}
            placeholder="Search by ID or Name..."
            required
          />
          <datalist id="employee-options">
            {employees.map((emp) => (
              <option key={emp.no_nomina} value={emp.no_nomina}>
                {emp.nombre}
              </option>
            ))}
          </datalist>
        </div>

        <div className="form-group">
          <label htmlFor="tipoIncidencia">Incidence Type</label>
          <select
            id="tipoIncidencia"
            value={tipoIncidencia}
            onChange={(e) => setTipoIncidencia(e.target.value)}
            required
          >
            <option value="" disabled>Select incidence type</option>
            {catalogs.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.tipo}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="cantidad">Quantity</label>
          <input
            type="number"
            id="cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0.00"
            step="0.01"
            required
          />
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Incidence'}
        </button>
      </form>
    </div>
  );
};

export default IncidenceForm;
