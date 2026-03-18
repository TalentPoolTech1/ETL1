import { useSelector } from 'react-redux';
/**
 * useRBAC — Hook for permission-based UI logic.
 *
 * Provides a `hasPermission` function and `permissions` list.
 */
export const useRBAC = () => {
    const { permissions, isAuthenticated } = useSelector((state) => state.auth);
    const hasPermission = (permissionCode) => {
        // If not authenticated, no permissions
        if (!isAuthenticated)
            return false;
        // Check if the required permission code is in the user's permission set
        return permissions.includes(permissionCode);
    };
    const hasAllPermissions = (permissionCodes) => {
        return permissionCodes.every(code => hasPermission(code));
    };
    const hasAnyPermission = (permissionCodes) => {
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
