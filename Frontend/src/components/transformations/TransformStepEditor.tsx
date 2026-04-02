/**
 * Transform Step Editor Component
 * 
 * Comprehensive UI for editing a single step in a transformation sequence.
 * Integrates:
 * - Transform catalog with filtering by category
 * - Parameter panel for step configuration
 * - Code preview (engine-specific)
 * - Enable/disable toggle
 * - Error handling policy selector
 */

import React, { useState, useCallback } from 'react';
import { TransformStep } from '../../transformations/ir';
import { TRANSFORM_REGISTRY, getTransform, getTransformsInCategory } from '../../registry/TransformRegistry';
import { ParameterPanel } from './ParameterPanel';
import { compileStep } from '../../transformations/codegen';

export interface TransformStepEditorProps {
  step: TransformStep;
  onChange: (step: TransformStep) => void;
  onRemove: () => void;
  engine: 'spark' | 'postgresql' | 'redshift';
  inputColumnName: string;
  disabled?: boolean;
}

/**
 * Transform Step Editor
 */
export const TransformStepEditor: React.FC<TransformStepEditorProps> = ({
  step,
  onChange,
  onRemove,
  engine,
  inputColumnName,
  disabled,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [parametersValid, setParametersValid] = useState(true);

  const primitive = getTransform(step.type);
  const categories = Array.from(new Set(Object.values(TRANSFORM_REGISTRY).map(t => t.category)));

  const handleTransformChange = useCallback(
    (newType: string) => {
      onChange({
        ...step,
        type: newType,
        params: {},
      });
      setShowCatalog(false);
    },
    [step, onChange]
  );

  const handleParametersChange = useCallback(
    (newParams: Record<string, any>) => {
      onChange({
        ...step,
        params: newParams,
      });
    },
    [step, onChange]
  );

  const handleEnableChange = useCallback(
    (enabled: boolean) => {
      onChange({
        ...step,
        enabled,
      });
    },
    [step, onChange]
  );

  const handleErrorPolicyChange = useCallback(
    (policy: any) => {
      onChange({
        ...step,
        onError: policy,
      });
    },
    [step, onChange]
  );

  const handleDefaultValueChange = useCallback(
    (value: any) => {
      onChange({
        ...step,
        defaultValue: value,
      });
    },
    [step, onChange]
  );

  // Generate code preview
  const codePreview = primitive
    ? compileStep(step, engine, inputColumnName)
    : { sql: '', warnings: ['Unknown transform'], isValid: false };

  return (
    <div className="rounded-xl border border-slate-700 bg-[#15182c] p-4 shadow-[0_8px_24px_rgba(2,6,23,0.24)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          <input
            type="checkbox"
            checked={step.enabled}
            onChange={e => handleEnableChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-500 bg-[#0f1222] text-blue-500"
          />
          <span>{step.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {/* Header: Transform selector */}
      <div className="mb-4">
        <button
          onClick={() => setShowCatalog(!showCatalog)}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-600 bg-[#101426] px-4 py-3 text-left transition hover:border-blue-500 hover:bg-[#141934]"
        >
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
            Transformation
          </div>
          <div className="font-semibold text-[13px] text-slate-100">{primitive?.label || 'Select a transformation'}</div>
          {primitive && (
            <div className="mt-1 text-[11px] text-slate-400">{primitive.description}</div>
          )}
        </button>
      </div>

      {/* Catalog modal (if open) */}
      {showCatalog && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-[#101426] p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-600 bg-[#171b31] text-slate-300 hover:border-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-600 bg-[#171b31] text-slate-300 hover:border-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
            {Object.values(TRANSFORM_REGISTRY)
              .filter(t => selectedCategory === null || t.category === selectedCategory)
              .map(primitive => (
                <button
                  key={primitive.id}
                  onClick={() => handleTransformChange(primitive.id)}
                  className="rounded-lg border border-slate-700 bg-[#171b31] p-3 text-left transition hover:border-blue-500 hover:bg-[#1a2141]"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{primitive.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[12px] text-slate-100">{primitive.label}</div>
                      <div className="text-[11px] text-slate-400">{primitive.description}</div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Parameters panel */}
      {primitive && !showCatalog && (
        <div className="space-y-6">
          {primitive.parameters.length > 0 && (
            <div>
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Configuration</h4>
              <ParameterPanel
                primitive={primitive}
                values={step.params}
                onChange={handleParametersChange}
                onValidationChange={errors => setParametersValid(Object.keys(errors).length === 0)}
                disabled={!step.enabled || disabled}
              />
            </div>
          )}

          {/* Error handling */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">If This Step Fails</h4>
            <div className="space-y-3">
              <select
                value={step.onError}
                onChange={e => handleErrorPolicyChange(e.target.value)}
                disabled={!step.enabled || disabled}
                className="h-10 w-full rounded-md border border-slate-600 bg-[#1e2035] px-3 text-[12px] text-slate-100 focus:outline-none focus:border-blue-400"
              >
                <option value="FAIL">Stop the entire pipeline</option>
                <option value="RETURN_NULL">Skip to next step (use blank)</option>
                <option value="USE_DEFAULT">Use a default value</option>
              </select>

              {step.onError === 'USE_DEFAULT' && (
                <input
                  type="text"
                  placeholder="Default value"
                  value={step.defaultValue || ''}
                  onChange={e => handleDefaultValueChange(e.target.value)}
                  disabled={!step.enabled || disabled}
                  className="h-10 w-full rounded-md border border-slate-600 bg-[#1e2035] px-3 text-[12px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              )}
            </div>
          </div>

          {/* Code preview */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Generated Code ({engine})</h4>
            <div className="overflow-x-auto rounded-md border border-slate-800 bg-[#070910] p-3 font-mono text-[11px] text-slate-100 whitespace-nowrap">
              {codePreview.sql || 'Select parameters to generate code'}
            </div>

            {codePreview.warnings.length > 0 && (
              <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                {codePreview.warnings.map((warn, i) => (
                  <div key={i} className="text-[11px] text-amber-300">
                    {warn}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Step List with reordering
 */
interface StepListProps {
  steps: TransformStep[];
  onChange: (steps: TransformStep[]) => void;
  engine: 'spark' | 'postgresql' | 'redshift';
  inputColumnName: string;
  disabled?: boolean;
}

export const StepList: React.FC<StepListProps> = ({
  steps,
  onChange,
  engine,
  inputColumnName,
  disabled,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleStepChange = useCallback(
    (index: number, updatedStep: TransformStep) => {
      const newSteps = [...steps];
      newSteps[index] = updatedStep;
      onChange(newSteps);
    },
    [steps, onChange]
  );

  const handleStepRemove = useCallback(
    (index: number) => {
      const newSteps = steps.filter((_, i) => i !== index);
      onChange(newSteps);
    },
    [steps, onChange]
  );

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newSteps = [...steps];
    const [dragged] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, dragged);
    setDraggedIndex(targetIndex);
    onChange(newSteps);
  }, [draggedIndex, steps, onChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-700 bg-[#111320] py-4 text-center text-[12px] text-slate-400">
          No transformation steps yet.
        </p>
      )}

      {steps.map((step, index) => (
        <div
          key={step.stepId}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={e => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`transition ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-600 bg-[#101426] text-[12px] font-semibold text-slate-200">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <TransformStepEditor
                step={step}
                onChange={updatedStep => handleStepChange(index, updatedStep)}
                onRemove={() => handleStepRemove(index)}
                engine={engine}
                inputColumnName={inputColumnName}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
