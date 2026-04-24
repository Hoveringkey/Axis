import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import './CapitalHumano.css';

interface VacationData {
  employee: string;
  antigüedad_años: number;
  periodo: string;
  dias_con_derecho: number;
  dias_disfrutados: number;
  dias_restantes: number;
}

interface Props {
  noNomina: string;
  employeeName: string;
}

const VacationStatus: React.FC<Props> = ({ noNomina, employeeName }) => {
  const [data, setData] = useState<VacationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/payroll/employees/${noNomina}/vacation_status/`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'No se pudo obtener el balance de vacaciones.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [noNomina]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <div className="kpi-spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="ch-status error">{error}</div>;
  }

  if (!data) return null;

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', marginTop: 0 }}>
        Balance de vacaciones LFT 2023 · {employeeName}
      </p>

      {/* 3-stat grid */}
      <div className="vac-grid">
        <div className="vac-stat">
          <div className="vac-stat-value blue">{data.dias_con_derecho}</div>
          <div className="vac-stat-label">Días con Derecho</div>
        </div>
        <div className="vac-stat">
          <div className="vac-stat-value amber">{data.dias_disfrutados}</div>
          <div className="vac-stat-label">Días Disfrutados</div>
        </div>
        <div className="vac-stat">
          <div className="vac-stat-value emerald">{data.dias_restantes}</div>
          <div className="vac-stat-label">Días Restantes</div>
        </div>
      </div>

      {/* Meta info */}
      <div className="vac-meta">
        <div className="vac-meta-item">
          <span className="vac-meta-label">Antigüedad</span>
          <span className="vac-meta-value">
            {data.antigüedad_años}{' '}
            {data.antigüedad_años === 1 ? 'año' : 'años'}
          </span>
        </div>
        <div className="vac-meta-item">
          <span className="vac-meta-label">Período (Año {data.antigüedad_años + 1})</span>
          <span className="vac-meta-value">{data.periodo}</span>
        </div>
      </div>
    </div>
  );
};

export default VacationStatus;
