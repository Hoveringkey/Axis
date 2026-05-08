import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { CreditCard, CircleNotch } from '@phosphor-icons/react';
import { GlassCard, Button } from './ui';
import './Operaciones/Operaciones.css';

interface Employee {
  no_nomina: string;
  nombre: string;
}

interface LoanFormProps {
  onLoanAdded?: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ onLoanAdded }) => {
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
      const selectedEmployee = employees.find(emp => emp.no_nomina === empleado || emp.nombre === empleado);
      if (!selectedEmployee) {
        setStatus({ type: 'error', message: 'Empleado no encontrado. Seleccione uno válido.' });
        setIsLoading(false);
        return;
      }
      const empleadoId = selectedEmployee.no_nomina;

      await api.post('/api/payroll/loans/', {
        empleado: empleadoId,
        monto_total: parseFloat(montoTotal),
        abono_semanal: parseFloat(abonoSemanal),
        pagos_realizados: parseInt(pagosRealizados, 10),
      });

      setStatus({ type: 'success', message: 'Préstamo registrado correctamente.' });
      setEmpleado('');
      setMontoTotal('');
      setAbonoSemanal('');
      setPagosRealizados('0');
      if (onLoanAdded) {
        onLoanAdded();
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Error al registrar préstamo. Verifique los datos.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassCard padding="lg" style={{ maxWidth: '520px', width: '100%' }}>
      <div className="form-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} weight="duotone" color="var(--accent-primary)" />
          Registrar Préstamo
        </h3>
        <p>Ingrese los datos del nuevo préstamo.</p>
      </div>

      {status && (
        <div className={`op-status-banner op-status-banner--${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="data-form">
        <div className="form-group">
          <label htmlFor="empleado">Empleado</label>
          <input
            list="employee-options-loan"
            id="empleado"
            value={empleado}
            onChange={(e) => setEmpleado(e.target.value)}
            placeholder="Buscar por No. o Nombre…"
            required
          />
          <datalist id="employee-options-loan">
            {employees.map((emp) => (
              <option key={emp.no_nomina} value={emp.no_nomina}>
                {emp.nombre}
              </option>
            ))}
          </datalist>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="montoTotal">Monto Total</label>
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
            <label htmlFor="abonoSemanal">Descuento Semanal</label>
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
          <label htmlFor="pagosRealizados">Pagos Realizados</label>
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

        <Button type="submit" variant="primary" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? (
            <><CircleNotch className="animate-spin" size={18} /> Registrando…</>
          ) : (
            <><CreditCard weight="fill" size={18} /> Registrar Préstamo</>
          )}
        </Button>
      </form>
    </GlassCard>
  );
};

export default LoanForm;
