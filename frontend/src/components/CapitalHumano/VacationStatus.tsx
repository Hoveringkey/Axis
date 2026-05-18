import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { CalendarCheck, ClockCounterClockwise, HourglassMedium, WarningCircle } from '@phosphor-icons/react';
import './CapitalHumano.css';

interface VacationData {
  employee: string;
  antigüedad_años: number;
  periodo: string;
  dias_con_derecho: number;
  dias_disfrutados: number;
  deuda_heredada: number;
  dias_restantes: number;
  fecha_ingreso: string;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="vacation-status-state">
        <div className="vacation-status-spinner" aria-hidden="true" />
        <p>Cargando balance de vacaciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vacation-status-state vacation-status-state--error" role="alert">
        <WarningCircle size={24} weight="duotone" />
        <div>
          <strong>No se pudo cargar vacaciones</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="vacation-status-state">
        <CalendarCheck size={24} weight="duotone" />
        <p>No hay información de vacaciones disponible.</p>
      </div>
    );
  }

  const totalDisfrutados = data.dias_disfrutados + data.deuda_heredada;

  return (
    <section className="vacation-status-panel" aria-label={`Balance de vacaciones de ${employeeName}`}>
      <div className="vacation-status-grid">
        <article className="vacation-status-card vacation-status-card--accent">
          <div className="vacation-status-card__icon">
            <CalendarCheck size={22} weight="duotone" />
          </div>
          <div>
            <span className="vacation-status-label">Días con derecho</span>
            <strong className="vacation-status-value">{data.dias_con_derecho}</strong>
          </div>
        </article>

        <article className="vacation-status-card vacation-status-card--warning">
          <div className="vacation-status-card__icon">
            <ClockCounterClockwise size={22} weight="duotone" />
          </div>
          <div>
            <span className="vacation-status-label">Días disfrutados</span>
            <strong className="vacation-status-value">{totalDisfrutados}</strong>
            {data.deuda_heredada > 0 && (
              <span className="vacation-status-debt">
                Incluye {data.deuda_heredada}d de deuda
              </span>
            )}
          </div>
        </article>

        <article className="vacation-status-card vacation-status-card--success">
          <div className="vacation-status-card__icon">
            <HourglassMedium size={22} weight="duotone" />
          </div>
          <div>
            <span className="vacation-status-label">Días restantes</span>
            <strong className="vacation-status-value">{data.dias_restantes}</strong>
          </div>
        </article>
      </div>

      <div className="vacation-status-meta">
        <div className="vacation-status-meta__item">
          <span>Período</span>
          <strong>{data.periodo}</strong>
        </div>
        <div className="vacation-status-meta__item">
          <span>Antigüedad</span>
          <strong>
            {data.antigüedad_años}{' '}
            {data.antigüedad_años === 1 ? 'año' : 'años'}
          </strong>
        </div>
        <div className="vacation-status-meta__item">
          <span>Fecha de ingreso</span>
          <strong>{data.fecha_ingreso}</strong>
        </div>
      </div>
    </section>
  );
};

export default VacationStatus;
