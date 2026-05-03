import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';

// Auth
import Login from './components/Login';

// Layout
import Navbar from './components/Navbar';

// Dashboard
import DashboardHome from './components/DashboardHome';

// Capital Humano
import EmployeeDirectory from './components/CapitalHumano/EmployeeDirectory';
import EmployeeDetail from './components/CapitalHumano/EmployeeDetail';
import ImportView from './components/CapitalHumano/ImportView';

// Operaciones
import IncidencesView from './components/Operaciones/IncidencesView';
import LoansView from './components/Operaciones/LoansView';

// Nómina
import PayrollView from './components/Nomina/PayrollView';
import ExtraHoursView from './components/Nomina/ExtraHoursView';
import HistoryView from './components/Nomina/HistoryView';

// ── Layout shell: Navbar + page content ────────────────────
const AppLayout: React.FC = () => (
  <>
    <Navbar />
    <Outlet />
  </>
);

// ── Root ───────────────────────────────────────────────────
const App: React.FC = () => (
  <Router>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — all share the Navbar via AppLayout */}
      <Route
        element={
          <ProtectedRoute requiredPermission="can_access_payroll">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route index element={<DashboardHome />} />

        {/* Capital Humano */}
        <Route path="capital-humano" element={<EmployeeDirectory />} />
        <Route path="capital-humano/importar" element={<ImportView />} />
        <Route path="capital-humano/:id" element={<EmployeeDetail />} />

        {/* Operaciones */}
        <Route path="operaciones/incidencias" element={<IncidencesView />} />
        <Route path="operaciones/prestamos" element={<LoansView />} />

        {/* Nómina */}
        <Route path="nomina/calcular" element={<PayrollView />} />
        <Route path="nomina/horas-extra" element={<ExtraHoursView />} />
        <Route path="nomina/historia" element={<HistoryView />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
);

export default App;
