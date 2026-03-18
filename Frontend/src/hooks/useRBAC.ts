import { useSelector } from 'react-redux';
import { RootState } from '../store';

/**
 * useRBAC — Hook for permission-based UI logic.
 * 
 * Provides a `hasPermission` function and `permissions` list.
 */
export const useRBAC = () => {
  const { permissions, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const hasPermission = (permissionCode: string): boolean => {
    // If not authenticated, no permissions
    if (!isAuthenticated) return false;
    
    // Check if the required permission code is in the user's permission set
    return permissions.includes(permissionCode);
  };

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    return permissionCodes.every(code => hasPermission(code));
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => hasPermission(code));
  };

  return {
    permissions,
    isAuthenticated,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission
  };
};
