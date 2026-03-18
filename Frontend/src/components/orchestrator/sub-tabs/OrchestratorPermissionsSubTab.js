import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
const INITIAL_GRANTS = [
    { id: '1', principal: 'alice@acme.com', principalType: 'user', role: 'Owner', inherited: false },
    { id: '2', principal: 'data-engineers', principalType: 'group', role: 'Editor', inherited: true },
    { id: '3', principal: 'bi-readers', principalType: 'group', role: 'Viewer', inherited: true },
    { id: '4', principal: 'etl-service-account', principalType: 'service-account', role: 'Editor', inherited: false, expiry: '2026-06-01' },
];
const ROLE_STYLE = {
    Owner: 'bg-warning-100 text-warning-800',
    Editor: 'bg-primary-100 text-primary-800',
    Viewer: 'bg-neutral-100 text-neutral-600',
};
const PRINCIPAL_ICON = {
    'user': '👤',
    'group': '👥',
    'service-account': '⚙️',
};
export function OrchestratorPermissionsSubTab() {
    const [grants, setGrants] = useState(INITIAL_GRANTS);
    const [inheritFromProject, setInherit] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newPrincipal, setNewPrincipal] = useState('');
    const [newRole, setNewRole] = useState('Viewer');
    const addGrant = () => {
        if (!newPrincipal.trim())
            return;
        setGrants(prev => [...prev, {
                id: Date.now().toString(),
                principal: newPrincipal.trim(),
                principalType: 'user',
                role: newRole,
                inherited: false,
            }]);
        setNewPrincipal('');
        setShowAdd(false);
    };
    const removeGrant = (id) => setGrants(prev => prev.filter(g => g.id !== id));
    const changeRole = (id, role) => setGrants(prev => prev.map(g => g.id === id ? { ...g, role } : g));
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-neutral-800", children: "Inherit permissions from project" }), _jsx("div", { className: "text-xs text-neutral-500 mt-0.5", children: inheritFromProject
                                    ? 'This orchestrator inherits project-level grants. Breaking inheritance creates an independent access list.'
                                    : 'Inheritance is broken. This orchestrator has a standalone access list.' })] }), _jsx("button", { onClick: () => setInherit(v => !v), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inheritFromProject ? 'bg-primary-600' : 'bg-neutral-300'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inheritFromProject ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-700", children: "Access grants" }), _jsx(Button, { size: "sm", onClick: () => setShowAdd(v => !v), children: "+ Add grant" })] }), showAdd && (_jsxs("div", { className: "flex items-center gap-2 mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg", children: [_jsx(Input, { placeholder: "user@domain.com or group name", value: newPrincipal, onChange: e => setNewPrincipal(e.target.value), className: "flex-1", onKeyDown: e => e.key === 'Enter' && addGrant() }), _jsxs("select", { value: newRole, onChange: e => setNewRole(e.target.value), className: "px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white", children: [_jsx("option", { children: "Viewer" }), _jsx("option", { children: "Editor" }), _jsx("option", { children: "Owner" })] }), _jsx(Button, { size: "sm", onClick: addGrant, children: "Add" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setShowAdd(false), children: "Cancel" })] })), _jsx("div", { className: "border border-neutral-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-neutral-50", children: _jsx("tr", { children: ['Principal', 'Type', 'Role', 'Source', 'Expires', ''].map(h => (_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-neutral-500", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-neutral-100", children: grants.map(g => (_jsxs("tr", { className: "hover:bg-neutral-50", children: [_jsxs("td", { className: "px-4 py-2", children: [_jsx("span", { className: "mr-1.5", children: PRINCIPAL_ICON[g.principalType] }), _jsx("span", { className: "text-neutral-800", children: g.principal })] }), _jsx("td", { className: "px-4 py-2 text-neutral-500 capitalize", children: g.principalType.replace('-', ' ') }), _jsx("td", { className: "px-4 py-2", children: g.inherited ? (_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[g.role]}`, children: g.role })) : (_jsxs("select", { value: g.role, onChange: e => changeRole(g.id, e.target.value), className: `px-2 py-0.5 rounded-full text-xs font-medium border-0 outline-none cursor-pointer ${ROLE_STYLE[g.role]}`, children: [_jsx("option", { children: "Viewer" }), _jsx("option", { children: "Editor" }), _jsx("option", { children: "Owner" })] })) }), _jsx("td", { className: "px-4 py-2 text-neutral-500", children: g.inherited ? 'Project' : 'Direct' }), _jsx("td", { className: "px-4 py-2 text-neutral-500", children: g.expiry ?? '—' }), _jsx("td", { className: "px-4 py-2 text-right", children: !g.inherited && (_jsx("button", { onClick: () => removeGrant(g.id), className: "text-neutral-400 hover:text-danger-600 text-xs transition-colors", children: "Remove" })) })] }, g.id))) })] }) })] })] }));
}
