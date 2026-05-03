import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PermissionKey } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionKey;
  allowedGroups?: string[];
}

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
    return <Navigate to="/login" replace />;
  }

  if (allowedGroups && allowedGroups.length > 0 && !hasGroup(allowedGroups)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
