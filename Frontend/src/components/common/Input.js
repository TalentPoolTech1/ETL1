import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cx } from '@/utils/cx';
export function Input({ type = 'text', placeholder, value, onChange, disabled, className, label, error, helperText, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [label && _jsx("label", { className: "text-sm font-medium text-neutral-700", children: label }), _jsx("input", { type: type, placeholder: placeholder, value: value, onChange: onChange, disabled: disabled, className: cx('px-3 py-2 border rounded-md text-sm font-family-base', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-600', {
                    'border-neutral-300 bg-white hover:border-neutral-400': !error && !disabled,
                    'border-danger-600 bg-danger-50': error,
                    'border-neutral-200 bg-neutral-50 text-neutral-500 cursor-not-allowed': disabled,
                }, className) }), error && _jsx("span", { className: "text-xs text-danger-600", children: error }), helperText && !error && _jsx("span", { className: "text-xs text-neutral-500", children: helperText })] }));
}
