import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import api from '../api/axios';
import { CircleNotch, CheckCircle, WarningCircle, Eye } from '@phosphor-icons/react';
import { Button } from './ui';

const BulkDataMapper: React.FC = () => {
  const [rawData, setRawData]         = useState('');
  const [parsedData, setParsedData]   = useState<Record<string, string>[]>([]);
  const [columnDefs, setColumnDefs]   = useState<ColDef[]>([]);
  const [statusMsg, setStatusMsg]     = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleParse = () => {
    if (!rawData.trim()) {
      setParsedData([]);
      setColumnDefs([]);
      return;
    }

    try {
      const rows = rawData.split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) {
        setStatusMsg({ type: 'error', text: 'Proporciona al menos una fila de encabezados y una fila de datos.' });
        return;
      }

      // Detect separator: tab or comma
      const separator = rows[0].includes('\t') ? '\t' : ',';

      const headers = rows[0].split(separator).map(h => h.replace('\r', '').trim().toLowerCase());

      const data: Record<string, string>[] = rows.slice(1).map(row => {
        const values = row.split(separator);
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          let val = values[index] ? values[index].replace('\r', '').trim() : '';
          if (header === 'horario_s' && !val) {
            val = '-';
          }
          obj[header] = val;
        });
        return obj;
      });

      setParsedData(data);

      const cols: ColDef[] = headers.map(header => ({
        field: header,
        headerName: header.toUpperCase(),
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
      }));
      setColumnDefs(cols);
      setStatusMsg(null);
    } catch {
      setStatusMsg({ type: 'error', text: 'No se pudieron leer los datos. Verifica que el formato sea TSV o CSV.' });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await api.post('/api/payroll/employees/bulk-create/', parsedData);
      setStatusMsg({ type: 'success', text: '¡Empleados importados correctamente!' });
      setRawData('');
      setParsedData([]);
      setColumnDefs([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } };
      setStatusMsg({
        type: 'error',
        text: e.response?.data ? JSON.stringify(e.response.data) : 'No se pudieron importar los empleados.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const n = parsedData.length;

  return (
    <div className="bulk-importer">
      <p className="bulk-importer-hint">
        La primera fila debe contener los encabezados exactos del sistema (ej: <code>no_nomina, nombre, puesto, horario_lv, horario_s</code>). Compatible con TSV (Excel) y CSV.
      </p>

      <textarea
        className="bulk-importer-textarea"
        placeholder="no_nomina&#9;nombre&#9;puesto&#9;horario_lv&#9;horario_s"
        value={rawData}
        onChange={e => setRawData(e.target.value)}
      />

      <div className="bulk-importer-controls">
        <Button variant="secondary" onClick={handleParse} disabled={!rawData.trim()}>
          <Eye size={16} weight="duotone" /> Previsualizar
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={isSubmitting || parsedData.length === 0}
        >
          {isSubmitting
            ? <><CircleNotch className="animate-spin" size={16} /> Importando…</>
            : <><CheckCircle weight="fill" size={16} /> Confirmar e importar</>
          }
        </Button>
      </div>

      {statusMsg && (
        <div className={`bulk-importer-status bulk-importer-status--${statusMsg.type}`}>
          {statusMsg.type === 'error'
            ? <WarningCircle size={16} weight="fill" />
            : <CheckCircle size={16} weight="fill" />
          }
          {statusMsg.text}
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="bulk-importer-preview">
          <p className="bulk-importer-preview-title">
            Vista previa — {n} {n !== 1 ? 'registros' : 'registro'}
          </p>
          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              theme="legacy"
              rowData={parsedData}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={20}
              animateRows={true}
              domLayout="autoHeight"
              defaultColDef={{
                filter: true,
                floatingFilter: false,
                menuTabs: ['filterMenuTab'],
                resizable: true,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkDataMapper;
