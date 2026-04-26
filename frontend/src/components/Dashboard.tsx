import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import api from '../api/axios';
import IncidenceForm from './IncidenceForm';
import LoanForm from './LoanForm';
import BulkDataMapper from './BulkDataMapper';
import PayrollReport from './PayrollReport';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './Dashboard.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'incidence' | 'loan' | 'calculate' | 'import'>('directory');

  // Directory State
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchEmployees();
    }
  }, [activeTab]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/payroll/employees/');
      setEmployees(response.data);
      setError(null);
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        handleLogout();
      } else {
        setError('Failed to fetch employees. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  const directoryColumnDefs: ColDef[] = [
    { field: 'no_nomina', headerName: 'No. Nomina', sortable: true, filter: true },
    { field: 'nombre', headerName: 'Nombre', sortable: true, filter: true, flex: 1 },
    { field: 'puesto', headerName: 'Puesto', sortable: true, filter: true },
    { field: 'horario_lv', headerName: 'Horario L-V', sortable: true, filter: true },
    { field: 'horario_s', headerName: 'Horario S', sortable: true, filter: true },
  ];

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-brand">Payroll System</div>
        <div className="navbar-tabs">
          <button
            className={`tab-button ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            Directory
          </button>
          <button
            className={`tab-button ${activeTab === 'incidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidence')}
          >
            Record Incidence
          </button>
          <button
            className={`tab-button ${activeTab === 'loan' ? 'active' : ''}`}
            onClick={() => setActiveTab('loan')}
          >
            Register Loan
          </button>
          <button
            className={`tab-button ${activeTab === 'calculate' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculate')}
          >
            Calculate Payroll
          </button>
          <button
            className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Employees
          </button>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </nav>

      <main className="dashboard-content">
        <div style={{ display: activeTab === 'directory' ? 'block' : 'none' }}>
          <div className="tab-pane fade-in">
            <h2>Employee Directory</h2>
            {error && <div className="dashboard-error">{error}</div>}

            <div className="ag-theme-alpine-dark" style={{ height: '600px', width: '100%' }}>
              <AgGridReact
                rowData={employees}
                columnDefs={directoryColumnDefs}
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
        </div>

        <div style={{ display: activeTab === 'incidence' ? 'block' : 'none' }}>
          <div className="tab-pane fade-in form-wrapper">
            <IncidenceForm />
          </div>
        </div>

        <div style={{ display: activeTab === 'loan' ? 'block' : 'none' }}>
          <div className="tab-pane fade-in form-wrapper">
            <LoanForm />
          </div>
        </div>

        <div style={{ display: activeTab === 'calculate' ? 'block' : 'none' }}>
          <PayrollReport />
        </div>

        <div style={{ display: activeTab === 'import' ? 'block' : 'none' }}>
          <BulkDataMapper />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
