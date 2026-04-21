import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import './DashboardHome.css';

interface KpiState {
  value: number | null;
  loading: boolean;
  error: boolean;
}

const initialKpi = (): KpiState => ({ value: null, loading: true, error: false });

const DashboardHome: React.FC = () => {
  const navigate = useNavigate();

  const [activeEmployees, setActiveEmployees] = useState<KpiState>(initialKpi());
  const [totalExtraHours, setTotalExtraHours] = useState<KpiState>(initialKpi());
  const [outstandingLoans, setOutstandingLoans] = useState<KpiState>(initialKpi());

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    // Active employees
    api.get('/api/payroll/employees/')
      .then(res => {
        const active = res.data.filter((e: any) => e.is_active === true);
        setActiveEmployees({ value: active.length, loading: false, error: false });
      })
      .catch(() => setActiveEmployees({ value: null, loading: false, error: true }));

    // Extra hours total
    api.get('/api/payroll/extra-hour-banks/')
      .then(res => {
        const total = res.data.reduce(
          (sum: number, record: any) => sum + parseFloat(record.horas_deuda || '0'),
          0
        );
        setTotalExtraHours({ value: Math.round(total * 100) / 100, loading: false, error: false });
      })
      .catch(() => setTotalExtraHours({ value: null, loading: false, error: true }));

    // Outstanding loans
    api.get('/api/payroll/loans/')
      .then(res => {
        setOutstandingLoans({ value: res.data.length, loading: false, error: false });
      })
      .catch(() => setOutstandingLoans({ value: null, loading: false, error: true }));
  }, []);

  const renderKpiValue = (kpi: KpiState, suffix = '') => {
    if (kpi.loading) {
      return (
        <div className="kpi-card-value loading">
          <div className="kpi-spinner" />
        </div>
      );
    }
    if (kpi.error || kpi.value === null) {
      return <div className="kpi-error">Error al cargar</div>;
    }
    return (
      <div className="kpi-card-value">
        {kpi.value.toLocaleString('es-MX')}
        {suffix}
      </div>
    );
  };

  return (
    <div className="dash-home">
      {/* Header */}
      <div className="dash-header">
        <div className="dash-header-greeting">{getGreeting()} — {today}</div>
        <h1>Panel de Control</h1>
        <p className="dash-header-sub">Resumen general del sistema de nómina</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {/* Active Employees */}
        <div className="kpi-card blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/capital-humano')}>
          <div className="kpi-card-top">
            <span className="kpi-card-label">Empleados Activos</span>
            <div className="kpi-card-icon">👥</div>
          </div>
          {renderKpiValue(activeEmployees)}
          <div className="kpi-card-sub">Clic para ver directorio</div>
        </div>

        {/* Extra Hours Bank */}
        <div className="kpi-card violet" style={{ cursor: 'pointer' }} onClick={() => navigate('/nomina/horas-extra')}>
          <div className="kpi-card-top">
            <span className="kpi-card-label">Banco de Horas Extra</span>
            <div className="kpi-card-icon">⏱️</div>
          </div>
          {renderKpiValue(totalExtraHours, ' hrs')}
          <div className="kpi-card-sub">Total acumulado en deuda</div>
        </div>

        {/* Outstanding Loans */}
        <div className="kpi-card emerald" style={{ cursor: 'pointer' }} onClick={() => navigate('/operaciones/prestamos')}>
          <div className="kpi-card-top">
            <span className="kpi-card-label">Préstamos Vigentes</span>
            <div className="kpi-card-icon">💳</div>
          </div>
          {renderKpiValue(outstandingLoans)}
          <div className="kpi-card-sub">Registros activos en el sistema</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="qa-section">
        <div className="qa-section-title">Acciones Rápidas</div>
        <div className="qa-grid">
          <button
            id="qa-calcular-nomina"
            className="qa-btn qa-btn-primary"
            onClick={() => navigate('/nomina/calcular')}
          >
            🧮 Calcular Nómina
          </button>
          <button
            id="qa-agregar-incidencia"
            className="qa-btn qa-btn-secondary"
            onClick={() => navigate('/operaciones/incidencias')}
          >
            📋 Agregar Incidencia
          </button>
          <button
            id="qa-registrar-prestamo"
            className="qa-btn qa-btn-secondary"
            onClick={() => navigate('/operaciones/prestamos')}
          >
            💳 Registrar Préstamo
          </button>
          <button
            id="qa-directorio"
            className="qa-btn qa-btn-secondary"
            onClick={() => navigate('/capital-humano')}
          >
            👥 Ver Directorio
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
