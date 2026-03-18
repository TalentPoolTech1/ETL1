import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFocusTrap, useFocusRestore, useId } from '@/hooks/useAccessibility';
export function Modal({ isOpen, onClose, title, children, actions, size = 'md', ariaDescribedBy, }) {
    const focusTrapRef = useFocusTrap(isOpen);
    useFocusRestore();
    const titleId = useId('modal-title');
    const descId = useId('modal-desc');
    if (!isOpen)
        return null;
    const sizeClasses = {
        sm: 'w-80',
        md: 'w-96',
        lg: 'w-2xl',
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", onClick: onClose, "aria-hidden": "true", children: _jsxs("div", { ref: focusTrapRef, className: `bg-white rounded-lg shadow-lg ${sizeClasses[size]} max-h-96 overflow-hidden flex flex-col`, onClick: e => e.stopPropagation(), role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, "aria-describedby": ariaDescribedBy || descId, children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-neutral-200", children: [_jsx("h2", { id: titleId, className: "text-lg font-semibold text-neutral-900", children: title }), _jsx("button", { onClick: onClose, className: "text-neutral-500 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600", "aria-label": "Close dialog", children: "\u2715" })] }), _jsx("div", { id: descId, className: "flex-1 overflow-y-auto px-6 py-4", children: children }), actions && _jsx("div", { className: "border-t border-neutral-200 px-6 py-4 flex gap-2 justify-end", children: actions })] }) }));
}
