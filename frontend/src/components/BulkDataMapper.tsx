import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import api from '../api/axios';
import { CircleNotch, CheckCircle } from '@phosphor-icons/react';

const BulkDataMapper: React.FC = () => {
  const [rawData, setRawData] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
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
        setStatusMsg({ type: 'error', text: 'Please provide at least a header row and one data row.' });
        return;
      }

      // Detect separator: tab or comma
      const separator = rows[0].includes('\t') ? '\t' : ',';

      const headers = rows[0].split(separator).map(h => h.replace('\r', '').trim().toLowerCase());

      const data = rows.slice(1).map(row => {
        const values = row.split(separator);
        const obj: any = {};
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

      // Generate column definitions for preview
      const cols: ColDef[] = headers.map(header => ({
        field: header,
        headerName: header.toUpperCase(),
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1
      }));
      setColumnDefs(cols);
      setStatusMsg(null);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to parse data. Please ensure it is TSV or CSV format.' });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await api.post('/api/payroll/employees/bulk-create/', parsedData);
      setStatusMsg({ type: 'success', text: 'Successfully imported employees!' });
      setRawData('');
      setParsedData([]);
      setColumnDefs([]);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.response?.data ? JSON.stringify(err.response.data) : 'Failed to import employees.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tab-pane fade-in">
      <h2>Bulk Import Employees</h2>
      <p>Paste data from Excel or CSV. The first row must contain column headers matching the system (e.g., no_nomina, nombre, puesto, horario_lv, horario_s).</p>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <textarea
          style={{ width: '100%', height: '150px', padding: '0.5rem', fontFamily: 'monospace' }}
          placeholder="no_nomina&#9;nombre&#9;puesto..."
          value={rawData}
          onChange={(e) => setRawData(e.target.value)}
        />
      </div>

      <div className="calc-controls" style={{ marginBottom: '1rem' }}>
        <button className="submit-button" onClick={handleParse} style={{ marginRight: '1rem' }}>
          Preview Data
        </button>
        <button
          className="submit-button"
          onClick={handleImport}
          disabled={isSubmitting || parsedData.length === 0}
        >
          {isSubmitting ? (
            <><CircleNotch className="animate-spin" size={18} /> Importing...</>
          ) : (
            <><CheckCircle weight="fill" size={18} /> Confirm & Import</>
          )}
        </button>
      </div>

      {statusMsg && (
        <div className={`dashboard-error ${statusMsg.type === 'success' ? 'success' : ''}`}
          style={statusMsg.type === 'success' ? { backgroundColor: 'var(--color-emerald)', color: 'var(--color-white)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' } : {}}>
          {statusMsg.text}
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2">Data Preview ({parsedData.length} records)</h3>
          <div className="ag-theme-alpine-dark" style={{ height: '400px', width: '100%' }}>
            <AgGridReact
              rowData={parsedData}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={20}
              animateRows={true}
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
