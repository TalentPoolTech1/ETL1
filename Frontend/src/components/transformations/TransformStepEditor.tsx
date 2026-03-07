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

interface TransformStepEditorProps {
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
    <div className="p-4 border border-gray-300 rounded-lg bg-white">
      {/* Header: Enable toggle + Transform selector */}
      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={step.enabled}
            onChange={e => handleEnableChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">Step enabled</span>
        </label>

        <button
          onClick={() => setShowCatalog(!showCatalog)}
          disabled={disabled}
          className="flex-1 px-4 py-2 text-left bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-md hover:border-blue-500 transition"
        >
          <div className="font-medium text-sm">{primitive?.label || 'Select a transformation'}</div>
          {primitive && (
            <div className="text-xs text-gray-600">{primitive.description}</div>
          )}
        </button>

        <button
          onClick={onRemove}
          disabled={disabled}
          className="px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {/* Catalog modal (if open) */}
      {showCatalog && (
        <div className="mb-4 p-4 border border-gray-300 rounded-md bg-gray-50">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded text-sm transition ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-sm transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {Object.values(TRANSFORM_REGISTRY)
              .filter(t => selectedCategory === null || t.category === selectedCategory)
              .map(primitive => (
                <button
                  key={primitive.id}
                  onClick={() => handleTransformChange(primitive.id)}
                  className="text-left p-3 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-500 transition"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{primitive.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{primitive.label}</div>
                      <div className="text-xs text-gray-600 truncate">{primitive.description}</div>
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
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Configuration</h4>
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
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">If this step fails</h4>
            <div className="space-y-3">
              <select
                value={step.onError}
                onChange={e => handleErrorPolicyChange(e.target.value)}
                disabled={!step.enabled || disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              )}
            </div>
          </div>

          {/* Code preview */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Generated Code ({engine})</h4>
            <div className="p-3 bg-gray-900 text-gray-100 rounded-md font-mono text-sm overflow-x-auto whitespace-nowrap">
              {codePreview.sql || 'Select parameters to generate code'}
            </div>

            {codePreview.warnings.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                {codePreview.warnings.map((warn, i) => (
                  <div key={i} className="text-sm text-yellow-800">
                    ⚠️ {warn}
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
        <p className="text-sm text-gray-500 text-center py-4">No transformation steps yet.</p>
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
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-700 flex-shrink-0">
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
