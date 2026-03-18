import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Alert({ variant = 'info', title, children, onClose }) {
    const variantClasses = {
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-900',
            icon: 'ℹ️',
        },
        success: {
            bg: 'bg-success-50',
            border: 'border-success-200',
            text: 'text-success-900',
            icon: '✓',
        },
        warning: {
            bg: 'bg-warning-50',
            border: 'border-warning-200',
            text: 'text-warning-900',
            icon: '⚠️',
        },
        danger: {
            bg: 'bg-danger-50',
            border: 'border-danger-200',
            text: 'text-danger-900',
            icon: '✕',
        },
    };
    const themed = variantClasses[variant];
    return (_jsx("div", { className: `${themed.bg} border ${themed.border} rounded-md p-4 ${themed.text}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "text-lg flex-shrink-0", children: themed.icon }), _jsxs("div", { className: "flex-1", children: [title && _jsx("p", { className: "font-semibold text-sm mb-1", children: title }), _jsx("p", { className: "text-sm", children: children })] }), onClose && (_jsx("button", { onClick: onClose, className: "text-lg hover:opacity-70", children: "\u2715" }))] }) }));
}
