/**
 * Reusable Parameter Panel Component
 * 
 * Generic component that renders UI controls for any transform primitive
 * based on its ParameterDef metadata. Handles validation, type conversion, etc.
 */

import React, { useState, useCallback } from 'react';
import { ParameterDef, TransformPrimitive } from '../../registry/TransformRegistry';

export interface ParameterPanelProps {
  primitive: TransformPrimitive;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onValidationChange?: (errors: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Single parameter input component
 */
function ParameterInput({
  def,
  value,
  onChange,
  onError,
  disabled,
}: {
  def: ParameterDef;
  value: any;
  onChange: (val: any) => void;
  onError: (err: string | null) => void;
  disabled?: boolean;
}) {
  const handleChange = (newValue: any) => {
    onChange(newValue);

    // Validate
    if (def.validation) {
      const result = def.validation(newValue);
      onError(result.valid ? null : result.error || 'Invalid value');
    } else {
      onError(null);
    }
  };

  switch (def.type) {
    case 'text':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <input
            type="text"
            placeholder={def.placeholder}
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="h-10 px-3 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                       placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          />
        </div>
      );

    case 'number':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <input
            type="number"
            placeholder={def.placeholder}
            value={value ?? ''}
            onChange={e => handleChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            className="h-10 px-3 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                       placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          />
        </div>
      );

    case 'select':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <select
            value={value ?? ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="h-10 px-3 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                       focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          >
            <option value="">-- Select --</option>
            {def.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-[#111320] px-3 py-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => handleChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded"
          />
          <label className="text-[12px] font-medium text-slate-200">{def.label}</label>
        </div>
      );

    case 'date':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <input
            type="date"
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="h-10 px-3 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                       focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          />
        </div>
      );

    case 'expression':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <textarea
            placeholder={def.placeholder}
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="px-3 py-2 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                       font-mono placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          />
        </div>
      );

    case 'list':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold text-slate-200">{def.label}</label>
          {def.description && <p className="text-[11px] text-slate-400">{def.description}</p>}
          <div className="space-y-2">
            {(value || []).map((item: any, idx: number) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={e => {
                    const newList = [...(value || [])];
                    newList[idx] = e.target.value;
                    handleChange(newList);
                  }}
                  disabled={disabled}
                  className="flex-1 h-10 px-3 rounded-md bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px]
                             placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
                />
                <button
                  onClick={() => {
                    const newList = (value || []).filter((_: any, i: number) => i !== idx);
                    handleChange(newList);
                  }}
                  disabled={disabled}
                  className="px-3 py-2 rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                handleChange([...(value || []), '']);
              }}
              disabled={disabled}
              className="px-3 py-2 rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
            >
              + Add Item
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Reusable Parameter Panel
 */
export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  primitive,
  values,
  onChange,
  onValidationChange,
  disabled,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleParameterChange = useCallback(
    (paramId: string, newValue: any) => {
      const updated = { ...values, [paramId]: newValue };
      onChange(updated);
    },
    [values, onChange]
  );

  const handleParameterError = useCallback(
    (paramId: string, error: string | null) => {
      const newErrors = { ...errors };
      if (error) {
        newErrors[paramId] = error;
      } else {
        delete newErrors[paramId];
      }
      setErrors(newErrors);
      onValidationChange?.(newErrors);
    },
    [errors, onValidationChange]
  );

  if (primitive.parameters.length === 0) {
    return <p className="text-[12px] text-slate-400">No extra configuration is needed for this transformation.</p>;
  }

  return (
    <div className="space-y-4">
      {primitive.parameters.map(param => (
        <div key={param.id}>
          <ParameterInput
            def={param}
            value={values[param.id] ?? param.default}
            onChange={val => handleParameterChange(param.id, val)}
            onError={err => handleParameterError(param.id, err)}
            disabled={disabled}
          />
          {errors[param.id] && (
            <p className="mt-1 text-[11px] text-red-300">{errors[param.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Hook: Use parameter panel state
 */
export function useParameterPanel(initialValues: Record<string, any> = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((newValues: Record<string, any>) => {
    setValues(newValues);
  }, []);

  const handleValidationChange = useCallback((newErrors: Record<string, string>) => {
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
