import React from 'react';
import { useRBAC } from '../../hooks/useRBAC';

interface HasPermissionProps {
  /** The permission code required (e.g., 'PIPELINE_CREATE') */
  permission?: string;
  /** A list of permissions where ALL are required */
  all?: string[];
  /** A list of permissions where ANY one is required */
  any?: string[];
  /** Optional fallback UI to show if permission is denied */
  fallback?: React.ReactNode;
  /** The content to show if permission is granted */
  children: React.ReactNode;
}

/**
 * HasPermission — Conditional rendering wrapper based on RBAC.
 * 
 * Usage:
 * <HasPermission permission="PIPELINE_DELETE" fallback={<p>Locked</p>}>
 *   <Button>Delete</Button>
 * </HasPermission>
 */
export const HasPermission: React.FC<HasPermissionProps> = ({
  permission,
  all,
  any,
  fallback = null,
  children
}) => {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = useRBAC();

  let isAuthorized = false;

  if (permission) {
    isAuthorized = hasPermission(permission);
  } else if (all) {
    isAuthorized = hasAllPermissions(all);
  } else if (any) {
    isAuthorized = hasAnyPermission(any);
  }

  return isAuthorized ? <>{children}</> : <>{fallback}</>;
};
