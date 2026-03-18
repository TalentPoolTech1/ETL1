import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Reusable Parameter Panel Component
 *
 * Generic component that renders UI controls for any transform primitive
 * based on its ParameterDef metadata. Handles validation, type conversion, etc.
 */
import { useState, useCallback } from 'react';
/**
 * Single parameter input component
 */
function ParameterInput({ def, value, onChange, onError, disabled, }) {
    const handleChange = (newValue) => {
        onChange(newValue);
        // Validate
        if (def.validation) {
            const result = def.validation(newValue);
            onError(result.valid ? null : result.error || 'Invalid value');
        }
        else {
            onError(null);
        }
    };
    switch (def.type) {
        case 'text':
            return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsx("input", { type: "text", placeholder: def.placeholder, value: value || '', onChange: e => handleChange(e.target.value), disabled: disabled, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }));
        case 'number':
            return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsx("input", { type: "number", placeholder: def.placeholder, value: value ?? '', onChange: e => handleChange(e.target.value ? Number(e.target.value) : null), disabled: disabled, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }));
        case 'select':
            return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsxs("select", { value: value ?? '', onChange: e => handleChange(e.target.value), disabled: disabled, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "-- Select --" }), def.options?.map(opt => (_jsx("option", { value: opt.value, children: opt.label }, opt.value)))] })] }));
        case 'toggle':
            return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(value), onChange: e => handleChange(e.target.checked), disabled: disabled, className: "w-4 h-4 rounded" }), _jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label })] }));
        case 'date':
            return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsx("input", { type: "date", value: value || '', onChange: e => handleChange(e.target.value), disabled: disabled, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }));
        case 'expression':
            return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsx("textarea", { placeholder: def.placeholder, value: value || '', onChange: e => handleChange(e.target.value), disabled: disabled, rows: 3, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" })] }));
        case 'list':
            return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: def.label }), def.description && _jsx("p", { className: "text-xs text-gray-500", children: def.description }), _jsxs("div", { className: "space-y-2", children: [(value || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: item, onChange: e => {
                                            const newList = [...(value || [])];
                                            newList[idx] = e.target.value;
                                            handleChange(newList);
                                        }, disabled: disabled, className: "flex-1 px-3 py-2 border border-gray-300 rounded-md" }), _jsx("button", { onClick: () => {
                                            const newList = (value || []).filter((_, i) => i !== idx);
                                            handleChange(newList);
                                        }, disabled: disabled, className: "px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50", children: "Remove" })] }, idx))), _jsx("button", { onClick: () => {
                                    handleChange([...(value || []), '']);
                                }, disabled: disabled, className: "px-3 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 disabled:opacity-50", children: "+ Add Item" })] })] }));
        default:
            return null;
    }
}
/**
 * Reusable Parameter Panel
 */
export const ParameterPanel = ({ primitive, values, onChange, onValidationChange, disabled, }) => {
    const [errors, setErrors] = useState({});
    const handleParameterChange = useCallback((paramId, newValue) => {
        const updated = { ...values, [paramId]: newValue };
        onChange(updated);
    }, [values, onChange]);
    const handleParameterError = useCallback((paramId, error) => {
        const newErrors = { ...errors };
        if (error) {
            newErrors[paramId] = error;
        }
        else {
            delete newErrors[paramId];
        }
        setErrors(newErrors);
        onValidationChange?.(newErrors);
    }, [errors, onValidationChange]);
    if (primitive.parameters.length === 0) {
        return _jsx("p", { className: "text-sm text-gray-500", children: "No configuration needed for this transformation." });
    }
    return (_jsx("div", { className: "space-y-6", children: primitive.parameters.map(param => (_jsxs("div", { children: [_jsx(ParameterInput, { def: param, value: values[param.id] ?? param.default, onChange: val => handleParameterChange(param.id, val), onError: err => handleParameterError(param.id, err), disabled: disabled }), errors[param.id] && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors[param.id] }))] }, param.id))) }));
};
/**
 * Hook: Use parameter panel state
 */
export function useParameterPanel(initialValues = {}) {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const handleChange = useCallback((newValues) => {
        setValues(newValues);
    }, []);
    const handleValidationChange = useCallback((newErrors) => {
        setErrors(newErrors);
    }, []);
    const reset = useCallback(() => {
        setValues(initialValues);
        setErrors({});
    }, [initialValues]);
    const isValid = Object.keys(errors).length === 0;
    return {
        values,
        errors,
        handleChange,
        handleValidationChange,
        reset,
        isValid,
    };
}
