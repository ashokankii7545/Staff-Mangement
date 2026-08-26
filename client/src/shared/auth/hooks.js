import { useAuth } from './AuthContext';
import { useMemo, useCallback } from 'react';

// Common RBAC Permissions Mapping
const ROLE_PERMISSIONS = {
  ADMIN: ['MANAGE_STAFF', 'MANAGE_HOLIDAYS', 'MANAGE_OFFICES', 'APPROVE_LEAVE', 'VIEW_ALL_HISTORY', 'VIEW_DASHBOARD'],
  STAFF: ['VIEW_DASHBOARD', 'MARK_ATTENDANCE', 'VIEW_OWN_HISTORY', 'APPLY_LEAVE'],
};

export const useRoles = () => {
  const { user } = useAuth();
  
  const hasRole = (role) => {
    if (!user) return false;
    return user.role === role;
  };

  const hasAnyRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return { hasRole, hasAnyRole, currentRole: user?.role };
};

export const usePermissions = () => {
  const { user: _user } = useAuth();
  const { currentRole } = useRoles();

  const permissions = useMemo(() => {
    if (!currentRole) return [];
    return ROLE_PERMISSIONS[currentRole] || [];
  }, [currentRole]);

  const can = (permission) => permissions.includes(permission);
  
  const canAll = (requiredPermissions) => 
    requiredPermissions.every((p) => permissions.includes(p));
    
  const canAny = (requiredPermissions) => 
    requiredPermissions.some((p) => permissions.includes(p));

  return { can, canAll, canAny, permissions };
};

/**
 * Per-user page access. Model: EVERY page is open by default; an admin may
 * withdraw specific pages per account (user.restrictedPages = ['/approvals']).
 * Dashboard ('/') is always accessible so nobody is locked out of home.
 */
export const usePageAccess = () => {
  const { user } = useAuth();

  const restrictedSet = useMemo(
    () => new Set(Array.isArray(user?.restrictedPages) ? user.restrictedPages : []),
    [user?.id, user?.restrictedPages]
  );

  const canAccessPage = useCallback(
    (pageKey) => !pageKey || pageKey === '/' || !restrictedSet.has(pageKey),
    [restrictedSet]
  );

  const restrictedPages = useMemo(() => [...restrictedSet], [restrictedSet]);

  return { canAccessPage, restrictedPages };
};
