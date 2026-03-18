import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useRBAC } from '../../hooks/useRBAC';
/**
 * HasPermission — Conditional rendering wrapper based on RBAC.
 *
 * Usage:
 * <HasPermission permission="PIPELINE_DELETE" fallback={<p>Locked</p>}>
 *   <Button>Delete</Button>
 * </HasPermission>
 */
export const HasPermission = ({ permission, all, any, fallback = null, children }) => {
    const { hasPermission, hasAllPermissions, hasAnyPermission } = useRBAC();
    let isAuthorized = false;
    if (permission) {
        isAuthorized = hasPermission(permission);
    }
    else if (all) {
        isAuthorized = hasAllPermissions(all);
    }
    else if (any) {
        isAuthorized = hasAnyPermission(any);
    }
    return isAuthorized ? _jsx(_Fragment, { children: children }) : _jsx(_Fragment, { children: fallback });
};
