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

import React, { useState, useCallback } from 'react';
import {
  createSequence,
  createStep,
  createVersionSnapshot,
  serializeSequence,
  validateSequence,
  compileSequence,
  StepList,
  TRANSFORM_REGISTRY,
  TransformSequence,
  TransformStep,
} from '../../transformations';

interface MultiTransformEditorProps {
  columnId: string;
  columnName: string;
  pipelineId: string;
  datasetId: string;
  defaultEngine: 'spark' | 'postgresql' | 'redshift';
  initialSequence?: TransformSequence;
  onSave?: (sequence: TransformSequence) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Multi-Transform Editor Component
 */
export const MultiTransformEditor: React.FC<MultiTransformEditorProps> = ({
  columnId,
  columnName,
  pipelineId,
  datasetId,
  defaultEngine,
  initialSequence,
  onSave,
  onCancel,
}) => {
  // State
  const [sequence, setSequence] = useState<TransformSequence>(() =>
    initialSequence ?? createSequence(columnId, columnName, pipelineId, datasetId, defaultEngine)
  );

  const [currentEngine, setCurrentEngine] = useState<'spark' | 'postgresql' | 'redshift'>(defaultEngine);
  const [sequenceName, setSequenceName] = useState(sequence.name);
  const [sequenceDescription, setSequenceDescription] = useState(sequence.description || '');
  const [changeNote, setChangeNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string[]> | null>(null);

  // Handle steps change
  const handleStepsChange = useCallback((newSteps: TransformStep[]) => {
    setSequence(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date(),
    }));
  }, []);

  // Handle sequence name/description change
  const handleNameChange = useCallback((name: string) => {
    setSequenceName(name);
    setSequence(prev => ({
      ...prev,
      name,
    }));
  }, []);

  const handleDescriptionChange = useCallback((desc: string) => {
    setSequenceDescription(desc);
    setSequence(prev => ({
      ...prev,
      description: desc,
    }));
  }, []);

  // Handle engine change
  const handleEngineChange = useCallback((engine: 'spark' | 'postgresql' | 'redshift') => {
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
    } else {
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
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [sequence, changeNote, handleValidate, onSave]);

  // Generate code preview
  const codeResult = compileSequence(sequence);
  const enabledStepCount = sequence.steps.filter(s => s.enabled).length;

  return (
    <div className="flex flex-col h-full gap-4 p-6 bg-white">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              value={sequenceName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Transformation name"
              className="w-full text-2xl font-bold border-0 border-b-2 border-gray-300 focus:outline-none focus:border-blue-500 pb-2"
            />
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <textarea
          value={sequenceDescription}
          onChange={e => handleDescriptionChange(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Engine</label>
          <select
            value={currentEngine}
            onChange={e => handleEngineChange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="spark">Spark SQL</option>
            <option value="postgresql">PostgreSQL</option>
            <option value="redshift">Amazon Redshift</option>
          </select>
        </div>

        <div className="flex-1" />

        <div className="text-sm text-gray-600">
          <span className="font-medium">{enabledStepCount}</span> of <span className="font-medium">{sequence.steps.length}</span> steps enabled
        </div>

        <button
          onClick={handleAddStep}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          + Add Step
        </button>

        {sequence.versions && sequence.versions.length > 0 && (
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
          >
            🕐 {sequence.versions.length} Version{sequence.versions.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-semibold text-gray-700 mb-4">Transformation Steps</h3>
        <StepList
          steps={sequence.steps}
          onChange={handleStepsChange}
          engine={currentEngine}
          inputColumnName={columnName}
        />

        {sequence.steps.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No transformation steps yet. Click "Add Step" to begin.</p>
            <button
              onClick={handleAddStep}
              className="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
            >
              Add First Step
            </button>
          </div>
        )}
      </div>

      {/* Code Preview */}
      <div className="border-t pt-4">
        <h4 className="font-semibold text-gray-700 mb-2">Generated {currentEngine} Code</h4>
        <div className="p-4 bg-gray-900 text-gray-100 rounded-md font-mono text-sm overflow-x-auto max-h-32">
          {codeResult.sql || 'No transformation applied'}
        </div>

        {codeResult.warnings.length > 0 && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md space-y-1">
            {codeResult.warnings.map((warn, i) => (
              <div key={i} className="text-sm text-yellow-800">
                ⚠️ {warn}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors && validationErrors.size > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="font-semibold text-red-900 mb-2">Validation Errors</h4>
          {Array.from(validationErrors.entries()).map(([stepId, errors]) => (
            <div key={stepId} className="text-sm text-red-800 mb-2">
              <div className="font-medium">Step {stepId}:</div>
              <ul className="list-disc list-inside">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Save Section */}
      <div className="border-t pt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Change Note (optional)</label>
          <input
            type="text"
            value={changeNote}
            onChange={e => setChangeNote(e.target.value)}
            placeholder="e.g., 'Fixed phone number extraction'"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {saveError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleValidate}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
          >
            Validate
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Transformation'}
          </button>
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && sequence.versions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Version History</h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sequence.versions.map((version, idx) => (
                <div key={version.versionId} className="p-3 border border-gray-300 rounded-md hover:bg-blue-50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">v{version.versionNumber}</div>
                      <div className="text-sm text-gray-600">{version.createdAt.toLocaleString()}</div>
                      {version.changeNote && (
                        <div className="text-sm text-gray-700 mt-1">"{version.changeNote}"</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        // Implement revert logic
                        console.log('Revert to version', version.versionId);
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowVersions(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTransformEditor;
