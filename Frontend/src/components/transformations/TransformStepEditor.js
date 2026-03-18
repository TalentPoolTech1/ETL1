import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useState, useCallback } from 'react';
import { TRANSFORM_REGISTRY, getTransform } from '../../registry/TransformRegistry';
import { ParameterPanel } from './ParameterPanel';
import { compileStep } from '../../transformations/codegen';
/**
 * Transform Step Editor
 */
export const TransformStepEditor = ({ step, onChange, onRemove, engine, inputColumnName, disabled, }) => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCatalog, setShowCatalog] = useState(false);
    const [parametersValid, setParametersValid] = useState(true);
    const primitive = getTransform(step.type);
    const categories = Array.from(new Set(Object.values(TRANSFORM_REGISTRY).map(t => t.category)));
    const handleTransformChange = useCallback((newType) => {
        onChange({
            ...step,
            type: newType,
            params: {},
        });
        setShowCatalog(false);
    }, [step, onChange]);
    const handleParametersChange = useCallback((newParams) => {
        onChange({
            ...step,
            params: newParams,
        });
    }, [step, onChange]);
    const handleEnableChange = useCallback((enabled) => {
        onChange({
            ...step,
            enabled,
        });
    }, [step, onChange]);
    const handleErrorPolicyChange = useCallback((policy) => {
        onChange({
            ...step,
            onError: policy,
        });
    }, [step, onChange]);
    const handleDefaultValueChange = useCallback((value) => {
        onChange({
            ...step,
            defaultValue: value,
        });
    }, [step, onChange]);
    // Generate code preview
    const codePreview = primitive
        ? compileStep(step, engine, inputColumnName)
        : { sql: '', warnings: ['Unknown transform'], isValid: false };
    return (_jsxs("div", { className: "p-4 border border-gray-300 rounded-lg bg-white", children: [_jsxs("div", { className: "flex items-center gap-4 mb-4", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: step.enabled, onChange: e => handleEnableChange(e.target.checked), disabled: disabled, className: "w-4 h-4" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Step enabled" })] }), _jsxs("button", { onClick: () => setShowCatalog(!showCatalog), disabled: disabled, className: "flex-1 px-4 py-2 text-left bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-md hover:border-blue-500 transition", children: [_jsx("div", { className: "font-medium text-sm", children: primitive?.label || 'Select a transformation' }), primitive && (_jsx("div", { className: "text-xs text-gray-600", children: primitive.description }))] }), _jsx("button", { onClick: onRemove, disabled: disabled, className: "px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition disabled:opacity-50", children: "Remove" })] }), showCatalog && (_jsxs("div", { className: "mb-4 p-4 border border-gray-300 rounded-md bg-gray-50", children: [_jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx("button", { onClick: () => setSelectedCategory(null), className: `px-3 py-1 rounded text-sm transition ${selectedCategory === null
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: "All" }), categories.map(cat => (_jsx("button", { onClick: () => setSelectedCategory(cat), className: `px-3 py-1 rounded text-sm transition ${selectedCategory === cat
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: cat }, cat)))] }), _jsx("div", { className: "grid grid-cols-2 gap-3 max-h-96 overflow-y-auto", children: Object.values(TRANSFORM_REGISTRY)
                            .filter(t => selectedCategory === null || t.category === selectedCategory)
                            .map(primitive => (_jsx("button", { onClick: () => handleTransformChange(primitive.id), className: "text-left p-3 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-500 transition", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-lg", children: primitive.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-sm", children: primitive.label }), _jsx("div", { className: "text-xs text-gray-600 truncate", children: primitive.description })] })] }) }, primitive.id))) })] })), primitive && !showCatalog && (_jsxs("div", { className: "space-y-6", children: [primitive.parameters.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-sm text-gray-700 mb-3", children: "Configuration" }), _jsx(ParameterPanel, { primitive: primitive, values: step.params, onChange: handleParametersChange, onValidationChange: errors => setParametersValid(Object.keys(errors).length === 0), disabled: !step.enabled || disabled })] })), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h4", { className: "font-semibold text-sm text-gray-700 mb-3", children: "If this step fails" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("select", { value: step.onError, onChange: e => handleErrorPolicyChange(e.target.value), disabled: !step.enabled || disabled, className: "w-full px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "FAIL", children: "Stop the entire pipeline" }), _jsx("option", { value: "RETURN_NULL", children: "Skip to next step (use blank)" }), _jsx("option", { value: "USE_DEFAULT", children: "Use a default value" })] }), step.onError === 'USE_DEFAULT' && (_jsx("input", { type: "text", placeholder: "Default value", value: step.defaultValue || '', onChange: e => handleDefaultValueChange(e.target.value), disabled: !step.enabled || disabled, className: "w-full px-3 py-2 border border-gray-300 rounded-md" }))] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsxs("h4", { className: "font-semibold text-sm text-gray-700 mb-2", children: ["Generated Code (", engine, ")"] }), _jsx("div", { className: "p-3 bg-gray-900 text-gray-100 rounded-md font-mono text-sm overflow-x-auto whitespace-nowrap", children: codePreview.sql || 'Select parameters to generate code' }), codePreview.warnings.length > 0 && (_jsx("div", { className: "mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md", children: codePreview.warnings.map((warn, i) => (_jsxs("div", { className: "text-sm text-yellow-800", children: ["\u26A0\uFE0F ", warn] }, i))) }))] })] }))] }));
};
export const StepList = ({ steps, onChange, engine, inputColumnName, disabled, }) => {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const handleStepChange = useCallback((index, updatedStep) => {
        const newSteps = [...steps];
        newSteps[index] = updatedStep;
        onChange(newSteps);
    }, [steps, onChange]);
    const handleStepRemove = useCallback((index) => {
        const newSteps = steps.filter((_, i) => i !== index);
        onChange(newSteps);
    }, [steps, onChange]);
    const handleDragStart = useCallback((index) => {
        setDraggedIndex(index);
    }, []);
    const handleDragOver = useCallback((e, targetIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex)
            return;
        const newSteps = [...steps];
        const [dragged] = newSteps.splice(draggedIndex, 1);
        newSteps.splice(targetIndex, 0, dragged);
        setDraggedIndex(targetIndex);
        onChange(newSteps);
    }, [draggedIndex, steps, onChange]);
    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);
    return (_jsxs("div", { className: "space-y-3", children: [steps.length === 0 && (_jsx("p", { className: "text-sm text-gray-500 text-center py-4", children: "No transformation steps yet." })), steps.map((step, index) => (_jsx("div", { draggable: true, onDragStart: () => handleDragStart(index), onDragOver: e => handleDragOver(e, index), onDragEnd: handleDragEnd, className: `transition ${draggedIndex === index ? 'opacity-50' : ''}`, children: _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-700 flex-shrink-0", children: index + 1 }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx(TransformStepEditor, { step: step, onChange: updatedStep => handleStepChange(index, updatedStep), onRemove: () => handleStepRemove(index), engine: engine, inputColumnName: inputColumnName, disabled: disabled }) })] }) }, step.stepId)))] }));
};
