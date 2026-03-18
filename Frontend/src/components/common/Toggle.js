import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Toggle({ enabled, onChange, label, disabled = false }) {
    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => !disabled && onChange(!enabled), disabled: disabled, className: `
          relative inline-block w-10 h-6 rounded-full transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${enabled ? 'bg-primary-600' : 'bg-neutral-300'}
        `, children: _jsx("div", { className: `
            absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform
            ${enabled ? 'translate-x-4' : 'translate-x-0'}
          ` }) }), label && _jsx("span", { className: "text-sm text-neutral-700", children: label })] }));
}
