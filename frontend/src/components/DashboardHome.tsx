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
  Legend
} from 'recharts';
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  PageShell,
  StatusBadge
} from './ui';
import './DashboardHome.css';

interface DashboardData {
  period: {
    current: { iso_year: number; week: number; label: string };
    previous: { iso_year: number; week: number; label: string };
  };
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
  graph_overtime: Array<{ iso_year: number; semana: number; label: string; horas: number }>;
  graph_absenteeism: {
    actual: { iso_year: number; week: number; A: number; C: number };
    pasada: { iso_year: number; week: number; A: number; C: number };
  };
  graph_vacation_liability: Array<{ puesto: string; dias_adeudados: number }>;
}

const CHART_COLORS = {
  accent: '#2563eb',
  slate: '#64748b',
  success: '#16a34a',
  warning: '#d97706',
  violet: '#7c3aed',
  danger: '#dc2626',
  grid: '#e2e8f0',
  muted: '#94a3b8',
  text: '#475569',
  surface: 'rgba(255, 255, 255, 0.94)',
};

const CHART_TICK = { fontSize: 12, fill: CHART_COLORS.text };
const CHART_TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: '1px solid rgba(15, 23, 42, 0.10)',
  borderRadius: '14px',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
  color: '#0f172a',
};
const CHART_TOOLTIP_LABEL_STYLE = {
  color: '#0f172a',
  fontWeight: 700,
};
const CHART_LEGEND_STYLE = {
  color: CHART_COLORS.text,
  fontSize: '12px',
  fontWeight: 600,
};
const WEEK_AXIS_LABEL = {
  value: 'Semana',
  position: 'insideBottom' as const,
  offset: -5,
  fontSize: 10,
  fill: CHART_COLORS.muted,
};

const DashboardHome: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
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
        const dashRes = await api.get('/api/payroll/dashboard/');
        setData(dashRes.data);
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
      <PageShell>
        <LoadingState message="Cargando dashboard operativo..." />
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <ErrorState
          title="No se pudo cargar el dashboard."
          message="Intenta recargar la página para consultar la información operativa."
        />
      </PageShell>
    );
  }

  const incidenceDiff = data.scalars.incidencias_semana_actual - data.scalars.incidencias_semana_pasada;
  const currentPeriodLabel = data.period.current.label;
  const previousPeriodLabel = data.period.previous.label;

  // Prepare data for Absenteeism Chart
  const absenteeismData = [
    { name: 'Turno A', Actual: data.graph_absenteeism.actual.A, Pasada: data.graph_absenteeism.pasada.A },
    { name: 'Turno C', Actual: data.graph_absenteeism.actual.C, Pasada: data.graph_absenteeism.pasada.C },
  ];

  const hasOvertimeData = data.graph_overtime.length > 0;
  const hasVacationLiabilityData = data.graph_vacation_liability.length > 0;
  const hasAnniversaries = data.radar_lft.proximos_aniversarios.length > 0;
  const sortedVacationLiability = [...data.graph_vacation_liability].sort(
    (a, b) => b.dias_adeudados - a.dias_adeudados
  );
  const topVacationLiability = sortedVacationLiability.slice(0, 8);
  const remainingVacationLiability = sortedVacationLiability.slice(8);
  const vacationLiabilityRows = remainingVacationLiability.length > 0
    ? [
        ...topVacationLiability,
        {
          puesto: 'Otros',
          dias_adeudados: remainingVacationLiability.reduce(
            (sum, item) => sum + item.dias_adeudados,
            0
          ),
        },
      ]
    : topVacationLiability;
  const vacationLiabilityTotal = vacationLiabilityRows.reduce(
    (sum, item) => sum + item.dias_adeudados,
    0
  );

  return (
    <PageShell>
      <div className="dash-home-v2">
        <GlassCard variant="strong" padding="lg" className="dash-hero">
          <div className="dash-hero__content">
            <p className="dash-eyebrow">{today}</p>
            <h1>Dashboard Operativo</h1>
            <p className="dash-period">
              Periodo actual <span>{currentPeriodLabel}</span>
            </p>
          </div>
          <StatusBadge variant="success" className="dash-status-badge">
            <span className="dash-status-dot" aria-hidden="true" />
            Sistema activo
          </StatusBadge>
        </GlassCard>

        <section className="kpi-grid-v2" aria-label="Indicadores principales">
          <GlassCard variant="interactive" className="kpi-card-v2 primary">
            <div className="kpi-card-icon-v2">
              <Users size={24} weight="duotone" />
            </div>
            <div className="kpi-card-content">
              <span className="kpi-label">Empleados activos</span>
              <span className="kpi-value">{data.scalars.active_employees_count}</span>
              <span className="kpi-trend neutral">Total en nómina</span>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" className="kpi-card-v2 info">
            <div className="kpi-card-icon-v2">
              <Briefcase size={24} weight="duotone" />
            </div>
            <div className="kpi-card-content">
              <span className="kpi-label">Distribución de turnos</span>
              <div className="kpi-split">
                <div className="split-item">
                  <span className="split-label">Turno A</span>
                  <span className="split-value">{data.scalars.turno_a_count}</span>
                </div>
                <div className="split-divider" />
                <div className="split-item">
                  <span className="split-label">Turno C</span>
                  <span className="split-value">{data.scalars.turno_c_count}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" className="kpi-card-v2 warning">
            <div className="kpi-card-icon-v2">
              <Warning size={24} weight="duotone" />
            </div>
            <div className="kpi-card-content">
              <span className="kpi-label">Incidencias semanales</span>
              <span className="kpi-value">{data.scalars.incidencias_semana_actual}</span>
              <span className={`kpi-trend ${incidenceDiff > 0 ? 'up' : 'down'}`}>
                {incidenceDiff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(incidenceDiff)} vs semana pasada
              </span>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" className="kpi-card-v2 success">
            <div className="kpi-card-icon-v2">
              <Calendar size={24} weight="duotone" />
            </div>
            <div className="kpi-card-content">
              <span className="kpi-label">Aniversarios LFT</span>
              <span className="kpi-value">{data.radar_lft.proximos_aniversarios.length}</span>
              <span className="kpi-trend neutral">Próximos 15 días</span>
            </div>
          </GlassCard>
        </section>

        <section className="charts-grid-v2" aria-label="Gráficas operativas">
          <GlassCard className="chart-container-v2 span-2">
            <div className="chart-header">
              <div>
                <h3>Tendencia de horas extra</h3>
                <p>Últimas 4 semanas</p>
              </div>
            </div>
            <div className="chart-body">
              {hasOvertimeData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.graph_overtime} margin={{ top: 8, right: 18, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                    <XAxis
                      dataKey="label"
                      tick={CHART_TICK}
                      axisLine={false}
                      tickLine={false}
                      label={WEEK_AXIS_LABEL}
                    />
                    <YAxis
                      tick={CHART_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Line
                      type="monotone"
                      dataKey="horas"
                      stroke={CHART_COLORS.accent}
                      strokeWidth={3}
                      dot={{ r: 4, fill: CHART_COLORS.accent, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Sin horas extra registradas"
                  message="No hay datos disponibles para las últimas semanas."
                />
              )}
            </div>
          </GlassCard>

          <GlassCard className="chart-container-v2">
            <div className="chart-header">
              <div>
                <h3>Ausentismo por turno</h3>
                <p>Comparativa {currentPeriodLabel} vs {previousPeriodLabel}</p>
              </div>
            </div>
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={absenteeismData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={34} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Legend iconType="circle" wrapperStyle={CHART_LEGEND_STYLE} />
                  <Bar dataKey="Actual" fill={CHART_COLORS.accent} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Pasada" fill={CHART_COLORS.slate} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="chart-container-v2">
            <div className="chart-header">
              <div>
                <h3>Pasivo vacacional</h3>
                <p>Días adeudados por puesto</p>
              </div>
            </div>
            <div className="chart-body">
              {hasVacationLiabilityData ? (
                <div className="vacation-liability-list">
                  {vacationLiabilityRows.map((item) => {
                    const percent = vacationLiabilityTotal > 0
                      ? (item.dias_adeudados / vacationLiabilityTotal) * 100
                      : 0;

                    return (
                      <div className="vacation-liability-row" key={item.puesto}>
                        <div className="vacation-liability-meta">
                          <span className="vacation-liability-role" title={item.puesto}>
                            {item.puesto}
                          </span>
                          <span className="vacation-liability-days">
                            {item.dias_adeudados} días
                          </span>
                        </div>
                        <div
                          className="vacation-liability-bar"
                          aria-label={`${item.puesto}: ${item.dias_adeudados} días, ${Math.round(percent)}% del total`}
                        >
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <span className="vacation-liability-percent">
                          {Math.round(percent)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Sin pasivo vacacional"
                  message="No hay pasivo vacacional pendiente."
                />
              )}
            </div>
          </GlassCard>

          <GlassCard className="chart-container-v2 anniversary-list">
            <div className="chart-header">
              <div className="header-with-icon">
                <span className="anniv-header-icon">
                  <AirplaneTilt size={20} weight="fill" />
                </span>
                <div>
                  <h3>Próximos aniversarios</h3>
                  <p>Siguientes 15 días</p>
                </div>
              </div>
            </div>
            <div className="anniversary-body">
              {hasAnniversaries ? (
                <div className="anniversary-scroll">
                  {data.radar_lft.proximos_aniversarios.map((anniv, idx) => (
                    <div className="anniversary-item" key={`${anniv.name}-${idx}`}>
                      <div className="anniv-info">
                        <span className="anniv-name">{anniv.name}</span>
                        <span className="anniv-date">{anniv.exact_date}</span>
                      </div>
                      <span className="anniv-badge">
                        {anniv.years_reached} años
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sin aniversarios próximos"
                  message="No hay aniversarios LFT en los siguientes 15 días."
                />
              )}
            </div>
          </GlassCard>
        </section>
      </div>
    </PageShell>
  );
};

export default DashboardHome;
