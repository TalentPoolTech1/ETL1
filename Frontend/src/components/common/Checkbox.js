import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Checkbox({ checked, onChange, label, disabled = false, id }) {
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { id: id, type: "checkbox", checked: checked, onChange: e => onChange(e.target.checked), disabled: disabled, className: "w-4 h-4 border border-neutral-300 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" }), label && (_jsx("label", { htmlFor: id, className: "text-sm text-neutral-700 cursor-pointer", children: label }))] }));
}
