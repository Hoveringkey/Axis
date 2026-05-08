import React from 'react';
import BulkDataMapper from '../BulkDataMapper';
import { FileArrowDown, ClipboardText, Table, CheckCircle } from '@phosphor-icons/react';
import { GlassCard, PageShell } from '../ui';
import '../modules.css';
import '../Dashboard.css';
import './CapitalHumano.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const ImportView: React.FC = () => {
  return (
    <PageShell maxWidth="1180px">
      <div className="employee-import-page">
        <GlassCard variant="strong" padding="lg" className="employee-import-header">
          <div className="employee-import-title-group">
            <div className="employee-import-icon">
              <FileArrowDown size={30} weight="duotone" />
            </div>
            <div>
              <p className="employee-import-eyebrow">Capital Humano</p>
              <h1>Importar Empleados</h1>
              <p>Pega datos desde Excel o CSV para crear empleados en lote.</p>
            </div>
          </div>
        </GlassCard>

        <div className="employee-import-guidance">
          <GlassCard className="employee-import-step" padding="md">
            <ClipboardText size={22} weight="duotone" />
            <div>
              <span>1. Pega datos</span>
              <p>Usa encabezados como no_nomina, nombre, puesto, horario_lv y horario_s.</p>
            </div>
          </GlassCard>
          <GlassCard className="employee-import-step" padding="md">
            <Table size={22} weight="duotone" />
            <div>
              <span>2. Previsualiza</span>
              <p>Revisa la tabla generada antes de enviar el alta masiva.</p>
            </div>
          </GlassCard>
          <GlassCard className="employee-import-step" padding="md">
            <CheckCircle size={22} weight="duotone" />
            <div>
              <span>3. Confirma</span>
              <p>Importa solo cuando las columnas y registros se vean correctos.</p>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="employee-import-workspace" padding="lg">
          <BulkDataMapper />
        </GlassCard>
      </div>
    </PageShell>
  );
};

export default ImportView;
