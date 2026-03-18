import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Multi-Transform Editor Demo Component
 *
 * Complete working example showing how to integrate all transformation
 * components into a single, cohesive UI.
 *
 * This demonstrates:
 * - Creating a transformation sequence
 * - Adding and editing steps
 * - Real-time code generation
 * - Version management
 * - Persistence integration
 */
import { useState, useCallback } from 'react';
import { createSequence, createStep, createVersionSnapshot, validateSequence, compileSequence, StepList, TRANSFORM_REGISTRY, } from '../../transformations';
/**
 * Multi-Transform Editor Component
 */
export const MultiTransformEditor = ({ columnId, columnName, pipelineId, datasetId, defaultEngine, initialSequence, onSave, onCancel, }) => {
    // State
    const [sequence, setSequence] = useState(() => initialSequence ?? createSequence(columnId, columnName, pipelineId, datasetId, defaultEngine));
    const [currentEngine, setCurrentEngine] = useState(defaultEngine);
    const [sequenceName, setSequenceName] = useState(sequence.name);
    const [sequenceDescription, setSequenceDescription] = useState(sequence.description || '');
    const [changeNote, setChangeNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [showVersions, setShowVersions] = useState(false);
    const [validationErrors, setValidationErrors] = useState(null);
    // Handle steps change
    const handleStepsChange = useCallback((newSteps) => {
        setSequence(prev => ({
            ...prev,
            steps: newSteps,
            updatedAt: new Date(),
        }));
    }, []);
    // Handle sequence name/description change
    const handleNameChange = useCallback((name) => {
        setSequenceName(name);
        setSequence(prev => ({
            ...prev,
            name,
        }));
    }, []);
    const handleDescriptionChange = useCallback((desc) => {
        setSequenceDescription(desc);
        setSequence(prev => ({
            ...prev,
            description: desc,
        }));
    }, []);
    // Handle engine change
    const handleEngineChange = useCallback((engine) => {
        setCurrentEngine(engine);
        setSequence(prev => ({
            ...prev,
            targetEngine: engine,
        }));
    }, []);
    // Handle add step
    const handleAddStep = useCallback(() => {
        const newStep = createStep('trim', {});
        setSequence(prev => ({
            ...prev,
            steps: [...prev.steps, newStep],
        }));
    }, []);
    // Validate
    const handleValidate = useCallback(() => {
        const result = validateSequence(sequence, TRANSFORM_REGISTRY);
        if (!result.valid) {
            setValidationErrors(result.errors);
        }
        else {
            setValidationErrors(null);
        }
        return result.valid;
    }, [sequence]);
    // Save
    const handleSave = useCallback(async () => {
        if (!handleValidate()) {
            setSaveError('Please fix validation errors before saving');
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            // Create version snapshot
            const version = createVersionSnapshot(sequence, changeNote);
            const updated = {
                ...sequence,
                versions: [...(sequence.versions || []), version],
                currentVersionId: version.versionId,
                updatedAt: new Date(),
            };
            // Call save callback
            if (onSave) {
                await onSave(updated);
            }
            // Clear form
            setChangeNote('');
            setValidationErrors(null);
        }
        catch (err) {
            setSaveError(err.message || 'Failed to save');
        }
        finally {
            setIsSaving(false);
        }
    }, [sequence, changeNote, handleValidate, onSave]);
    // Generate code preview
    const codeResult = compileSequence(sequence);
    const enabledStepCount = sequence.steps.filter(s => s.enabled).length;
    return (_jsxs("div", { className: "flex flex-col h-full gap-4 p-6 bg-white", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-4 mb-4", children: [_jsx("div", { className: "flex-1", children: _jsx("input", { type: "text", value: sequenceName, onChange: e => handleNameChange(e.target.value), placeholder: "Transformation name", className: "w-full text-2xl font-bold border-0 border-b-2 border-gray-300 focus:outline-none focus:border-blue-500 pb-2" }) }), _jsx("button", { onClick: onCancel, className: "px-4 py-2 text-gray-600 hover:text-gray-900", children: "\u2715" })] }), _jsx("textarea", { value: sequenceDescription, onChange: e => handleDescriptionChange(e.target.value), placeholder: "Description (optional)", rows: 2, className: "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600" })] }), _jsxs("div", { className: "flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Target Engine" }), _jsxs("select", { value: currentEngine, onChange: e => handleEngineChange(e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "spark", children: "Spark SQL" }), _jsx("option", { value: "postgresql", children: "PostgreSQL" }), _jsx("option", { value: "redshift", children: "Amazon Redshift" })] })] }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-medium", children: enabledStepCount }), " of ", _jsx("span", { className: "font-medium", children: sequence.steps.length }), " steps enabled"] }), _jsx("button", { onClick: handleAddStep, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition", children: "+ Add Step" }), sequence.versions && sequence.versions.length > 0 && (_jsxs("button", { onClick: () => setShowVersions(!showVersions), className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition", children: ["\uD83D\uDD50 ", sequence.versions.length, " Version", sequence.versions.length !== 1 ? 's' : ''] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [_jsx("h3", { className: "font-semibold text-gray-700 mb-4", children: "Transformation Steps" }), _jsx(StepList, { steps: sequence.steps, onChange: handleStepsChange, engine: currentEngine, inputColumnName: columnName }), sequence.steps.length === 0 && (_jsxs("div", { className: "text-center py-8 text-gray-500", children: [_jsx("p", { className: "mb-4", children: "No transformation steps yet. Click \"Add Step\" to begin." }), _jsx("button", { onClick: handleAddStep, className: "px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200", children: "Add First Step" })] }))] }), _jsxs("div", { className: "border-t pt-4", children: [_jsxs("h4", { className: "font-semibold text-gray-700 mb-2", children: ["Generated ", currentEngine, " Code"] }), _jsx("div", { className: "p-4 bg-gray-900 text-gray-100 rounded-md font-mono text-sm overflow-x-auto max-h-32", children: codeResult.sql || 'No transformation applied' }), codeResult.warnings.length > 0 && (_jsx("div", { className: "mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md space-y-1", children: codeResult.warnings.map((warn, i) => (_jsxs("div", { className: "text-sm text-yellow-800", children: ["\u26A0\uFE0F ", warn] }, i))) }))] }), validationErrors && validationErrors.size > 0 && (_jsxs("div", { className: "p-4 bg-red-50 border border-red-200 rounded-md", children: [_jsx("h4", { className: "font-semibold text-red-900 mb-2", children: "Validation Errors" }), Array.from(validationErrors.entries()).map(([stepId, errors]) => (_jsxs("div", { className: "text-sm text-red-800 mb-2", children: [_jsxs("div", { className: "font-medium", children: ["Step ", stepId, ":"] }), _jsx("ul", { className: "list-disc list-inside", children: errors.map((err, i) => (_jsx("li", { children: err }, i))) })] }, stepId)))] })), _jsxs("div", { className: "border-t pt-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Change Note (optional)" }), _jsx("input", { type: "text", value: changeNote, onChange: e => setChangeNote(e.target.value), placeholder: "e.g., 'Fixed phone number extraction'", className: "w-full px-3 py-2 border border-gray-300 rounded-md text-sm" })] }), saveError && (_jsx("div", { className: "p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800", children: saveError })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition", children: "Cancel" }), _jsx("button", { onClick: handleValidate, className: "px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition", children: "Validate" }), _jsx("button", { onClick: handleSave, disabled: isSaving, className: "flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50", children: isSaving ? 'Saving...' : 'Save Transformation' })] })] }), showVersions && sequence.versions && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Version History" }), _jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: sequence.versions.map((version, idx) => (_jsx("div", { className: "p-3 border border-gray-300 rounded-md hover:bg-blue-50 transition", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsxs("div", { className: "font-medium", children: ["v", version.versionNumber] }), _jsx("div", { className: "text-sm text-gray-600", children: version.createdAt.toLocaleString() }), version.changeNote && (_jsxs("div", { className: "text-sm text-gray-700 mt-1", children: ["\"", version.changeNote, "\""] }))] }), _jsx("button", { onClick: () => {
                                                // Implement revert logic
                                                console.log('Revert to version', version.versionId);
                                            }, className: "px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200", children: "Restore" })] }) }, version.versionId))) }), _jsx("button", { onClick: () => setShowVersions(false), className: "mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Close" })] }) }))] }));
};
export default MultiTransformEditor;
