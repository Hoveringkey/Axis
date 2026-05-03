import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PermissionKey } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionKey;
  allowedGroups?: string[];
}

const AccessDenied = () => (
  <div role="alert" style={{ padding: '2rem' }}>
    <h2>Acceso denegado</h2>
    <p>No tienes permiso para acceder a esta sección.</p>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  allowedGroups,
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasGroup } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Cargando sesion...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDenied />;
  }

  if (allowedGroups && allowedGroups.length > 0 && !hasGroup(allowedGroups)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
