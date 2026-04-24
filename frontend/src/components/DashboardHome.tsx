import { useEffect, useState } from 'react';
import api from '../api/axios';
import { 
  Users, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  Warning, 
  Briefcase,
  AirplaneTilt
} from '@phosphor-icons/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import './DashboardHome.css';

interface DashboardData {
  scalars: {
    active_employees_count: number;
    turno_a_count: number;
    turno_c_count: number;
    incidencias_semana_actual: number;
    incidencias_semana_pasada: number;
  };
  radar_lft: {
    proximos_aniversarios: Array<{
      name: string;
      years_reached: number;
      exact_date: string;
    }>;
  };
  graph_overtime: Array<{ semana: number; horas: number }>;
  graph_absenteeism: {
    actual: { A: number; C: number };
    pasada: { A: number; C: number };
  };
  graph_vacation_liability: Array<{ puesto: string; dias_adeudados: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const DashboardHome: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, weekRes] = await Promise.all([
          api.get('/api/payroll/dashboard/'),
          api.get('/api/payroll/current-week/')
        ]);
        setData(dashRes.data);
        setCurrentWeek(weekRes.data.current_week);
      } catch (err) {
        console.error("Error fetching dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner"></div>
        <p>Cargando Dashboard...</p>
      </div>
    );
  }

  if (!data) return <div className="dash-error">Error al cargar datos.</div>;

  const incidenceDiff = data.scalars.incidencias_semana_actual - data.scalars.incidencias_semana_pasada;

  // Prepare data for Absenteeism Chart
  const absenteeismData = [
    { name: 'Turno A', Actual: data.graph_absenteeism.actual.A, Pasada: data.graph_absenteeism.pasada.A },
    { name: 'Turno C', Actual: data.graph_absenteeism.actual.C, Pasada: data.graph_absenteeism.pasada.C },
  ];

  return (
    <div className="dash-home-v2">
      {/* Header */}
      <div className="dash-header-v2">
        <div className="header-left">
          <p className="header-date">{today} • <span className="header-week">Semana {currentWeek}</span></p>
          <h1>Dashboard Operativo</h1>
        </div>
        <div className="header-right">
          <div className="status-badge">
            <div className="status-dot"></div>
            Sistema Activo
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid-v2">
        <div className="kpi-card-v2 primary">
          <div className="kpi-card-icon-v2">
            <Users size={24} weight="duotone" />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-label">Empleados Activos</span>
            <span className="kpi-value">{data.scalars.active_employees_count}</span>
            <span className="kpi-trend">Total en nómina</span>
          </div>
        </div>

        <div className="kpi-card-v2 info">
          <div className="kpi-card-icon-v2">
            <Briefcase size={24} weight="duotone" />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-label">Distribución de Turnos</span>
            <div className="kpi-split">
              <div className="split-item">
                <span className="split-label">Turno A</span>
                <span className="split-value">{data.scalars.turno_a_count}</span>
              </div>
              <div className="split-divider"></div>
              <div className="split-item">
                <span className="split-label">Turno C</span>
                <span className="split-value">{data.scalars.turno_c_count}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card-v2 warning">
          <div className="kpi-card-icon-v2">
            <Warning size={24} weight="duotone" />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-label">Incidencias Semanales</span>
            <span className="kpi-value">{data.scalars.incidencias_semana_actual}</span>
            <span className={`kpi-trend ${incidenceDiff > 0 ? 'up' : 'down'}`}>
              {incidenceDiff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(incidenceDiff)} vs semana pasada
            </span>
          </div>
        </div>

        <div className="kpi-card-v2 success">
          <div className="kpi-card-icon-v2">
            <Calendar size={24} weight="duotone" />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-label">Aniversarios LFT</span>
            <span className="kpi-value">{data.radar_lft.proximos_aniversarios.length}</span>
            <span className="kpi-trend">Próximos 15 días</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid-v2">
        {/* Graph 1: Overtime */}
        <div className="chart-container-v2 span-2">
          <div className="chart-header">
            <h3>Tendencia de Horas Extra</h3>
            <p>Últimas 4 semanas</p>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.graph_overtime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="semana" 
                  tick={{ fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Semana', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="horas" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#6366f1' }}
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Absenteeism */}
        <div className="chart-container-v2">
          <div className="chart-header">
            <h3>Ausentismo por Turno</h3>
            <p>Comparativa S{currentWeek} vs S{currentWeek ? currentWeek - 1 : ''}</p>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={absenteeismData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pasada" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Vacation Liability */}
        <div className="chart-container-v2">
          <div className="chart-header">
            <h3>Pasivo Vacacional</h3>
            <p>Días adeudados por puesto</p>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.graph_vacation_liability}
                  dataKey="dias_adeudados"
                  nameKey="puesto"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {data.graph_vacation_liability.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Block 3: Upcoming Anniversaries */}
        <div className="chart-container-v2 anniversary-list">
          <div className="chart-header">
            <div className="header-with-icon">
              <AirplaneTilt size={20} weight="fill" color="#f59e0b" />
              <h3>Próximos Aniversarios</h3>
            </div>
            <p>Siguientes 15 días</p>
          </div>
          <div className="anniversary-body">
            {data.radar_lft.proximos_aniversarios.length > 0 ? (
              <div className="anniversary-scroll">
                {data.radar_lft.proximos_aniversarios.map((anniv, idx) => (
                  <div className="anniversary-item" key={idx}>
                    <div className="anniv-info">
                      <span className="anniv-name">{anniv.name}</span>
                      <span className="anniv-date">{anniv.exact_date}</span>
                    </div>
                    <div className="anniv-badge">
                      {anniv.years_reached} años
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="anniv-empty">No hay aniversarios próximos</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
