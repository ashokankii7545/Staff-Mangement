import React from 'react';
import { useRoles, usePermissions } from './hooks';

export const RoleGuard = ({ 
  children, 
  allowedRoles, 
  requiredPermissions,
  fallback = null 
}) => {
  const { hasAnyRole } = useRoles();
  const { canAll } = usePermissions();

  let isAllowed = true;

  if (allowedRoles && allowedRoles.length > 0) {
    isAllowed = isAllowed && hasAnyRole(allowedRoles);
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    isAllowed = isAllowed && canAll(requiredPermissions);
  }

  if (!isAllowed) {
    return fallback;
  }

  return <>{children}</>;
};

export default RoleGuard;
