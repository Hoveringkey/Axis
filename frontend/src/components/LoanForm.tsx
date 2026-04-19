import React, { useState, useEffect } from 'react';
import api from '../api/axios';

interface Employee {
  no_nomina: string;
  nombre: string;
}

const LoanForm: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [empleado, setEmpleado] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [abonoSemanal, setAbonoSemanal] = useState('');
  const [pagosRealizados, setPagosRealizados] = useState('0');

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/payroll/employees/');
      setEmployees(response.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setIsLoading(true);

    try {
      await api.post('/api/payroll/loans/', {
        empleado,
        monto_total: parseFloat(montoTotal),
        abono_semanal: parseFloat(abonoSemanal),
        pagos_realizados: parseInt(pagosRealizados, 10),
      });
      
      setStatus({ type: 'success', message: 'Loan successfully registered!' });
      // Reset form
      setEmpleado('');
      setMontoTotal('');
      setAbonoSemanal('');
      setPagosRealizados('0');
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to register loan. Check your data.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <h3>Register Loan</h3>
        <p>Enter details for a new employee loan.</p>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="data-form">
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

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="montoTotal">Total Amount</label>
            <input
              type="number"
              id="montoTotal"
              value={montoTotal}
              onChange={(e) => setMontoTotal(e.target.value)}
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="abonoSemanal">Weekly Deduction</label>
            <input
              type="number"
              id="abonoSemanal"
              value={abonoSemanal}
              onChange={(e) => setAbonoSemanal(e.target.value)}
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="pagosRealizados">Payments Made</label>
          <input
            type="number"
            id="pagosRealizados"
            value={pagosRealizados}
            onChange={(e) => setPagosRealizados(e.target.value)}
            placeholder="0"
            min="0"
            required
          />
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register Loan'}
        </button>
      </form>
    </div>
  );
};

export default LoanForm;
