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
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
          <input
            type="text"
            placeholder={def.placeholder}
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    case 'number':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
          <input
            type="number"
            placeholder={def.placeholder}
            value={value ?? ''}
            onChange={e => handleChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    case 'select':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
          <select
            value={value ?? ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => handleChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded"
          />
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
        </div>
      );

    case 'date':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
          <input
            type="date"
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    case 'expression':
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
          <textarea
            placeholder={def.placeholder}
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>
      );

    case 'list':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">{def.label}</label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  onClick={() => {
                    const newList = (value || []).filter((_: any, i: number) => i !== idx);
                    handleChange(newList);
                  }}
                  disabled={disabled}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50"
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
              className="px-3 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 disabled:opacity-50"
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
    return <p className="text-sm text-gray-500">No configuration needed for this transformation.</p>;
  }

  return (
    <div className="space-y-6">
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
            <p className="mt-1 text-sm text-red-600">{errors[param.id]}</p>
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
