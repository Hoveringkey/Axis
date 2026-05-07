import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PermissionKey } from './AuthContext';
import { Button, ErrorState, LoadingState } from '../components/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionKey;
  allowedGroups?: string[];
}

const AccessDenied = () => (
  <ErrorState
    fullScreen
    title="Acceso no autorizado"
    message="Tu rol actual no tiene permiso para ver esta sección."
    action={<Button onClick={() => window.location.assign('/')}>Volver al dashboard</Button>}
  />
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  allowedGroups,
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasGroup } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState fullScreen message="Validando sesión..." />;
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
