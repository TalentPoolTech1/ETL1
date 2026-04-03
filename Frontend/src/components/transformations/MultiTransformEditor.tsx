/**
 * Multi-Transform Editor — compact popup for column-level transformation mapping.
 *
 * This replaces the old form-heavy sequence editor with a denser modal that
 * starts from the business task the user is actually doing:
 * source column -> transformation operator -> input/value -> output column.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  createSequence,
  createStep,
  createVersionSnapshot,
  TRANSFORM_REGISTRY,
  TransformSequence,
  TransformStep,
} from '../../transformations';
import type { ParameterDef, TransformPrimitive } from '../../registry/TransformRegistry';
import { ParameterPanel } from './ParameterPanel';
import {
  CaseCondition,
  ColumnMappingTree,
  PrimitiveOperation,
  RecursiveMappingBuilder,
  compileMappingTreeExpression,
  createDefaultMappingTree,
  createDefaultTransformation,
  validateMappingTree,
} from './RecursiveMappingBuilder';

interface MultiTransformEditorProps {
  columnId: string;
  columnName: string;
  pipelineId: string;
  datasetId: string;
  defaultEngine: 'spark' | 'postgresql' | 'redshift';
  initialSequence?: TransformSequence;
  availableColumns?: string[];
  onSave?: (sequence: TransformSequence) => Promise<void>;
  onCancel?: () => void;
}

const CONTROL_CLASSNAME = 'h-10 w-full rounded-lg border border-slate-600 bg-[#1e2035] px-3 text-[12px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30';
const MINI_CONTROL_CLASSNAME = 'h-9 w-full rounded-md border border-slate-600 bg-[#1e2035] px-2.5 text-[12px] text-slate-100 focus:outline-none focus:border-blue-400';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildDefaultParams(primitive: TransformPrimitive): Record<string, any> {
  return primitive.parameters.reduce<Record<string, any>>((acc, param) => {
    if (param.default !== undefined) acc[param.id] = cloneValue(param.default);
    return acc;
  }, {});
}

function safeHybrid(value: any, mode: 'value' | 'column' = 'value') {
  return {
    mode,
    value: String(value ?? ''),
  };
}

function legacyStepToNode(step: TransformStep) {
  const mapTypeToOperation: Record<string, PrimitiveOperation> = {
    upper: 'upper',
    substring: 'substr',
    regex_extract: 'regex',
    case_when: 'case',
  };

  const operation = mapTypeToOperation[step.type] || 'upper';
  const node = createDefaultTransformation(operation);

  if (operation === 'substr') {
    node.params.start = Number(step.params.startPos ?? step.params.start ?? 1);
    node.params.length = Number(step.params.length ?? 1);
  }

  if (operation === 'regex') {
    node.params.pattern = String(step.params.pattern ?? '');
    node.params.group = Number(step.params.group ?? 1);
  }

  if (operation === 'case') {
    const branches = Array.isArray(step.params.branches) ? step.params.branches : [];
    const mappedConditions: CaseCondition[] = branches.map((branch: any, idx: number) => ({
      id: `legacy_cond_${idx}`,
      left: safeHybrid(String(branch.when ?? ''), 'value'),
      operator: '=',
      right: safeHybrid('true', 'value'),
      then: safeHybrid(String(branch.then ?? ''), 'value'),
    }));

    node.params.conditions = mappedConditions.length > 0 ? mappedConditions : node.params.conditions;
    node.params.else = safeHybrid(String(step.params.else ?? '0'), 'value');
  }

  return node;
}

function deriveInitialTree(initialSequence?: TransformSequence): ColumnMappingTree {
  const existingTree = (initialSequence as any)?.mappingTree as ColumnMappingTree | undefined;
  if (existingTree?.root_group) return existingTree;

  const tree = createDefaultMappingTree();
  const legacySteps = initialSequence?.steps || [];
  if (legacySteps.length > 0) {
    tree.root_group.children = legacySteps.filter(step => step.enabled !== false).map(legacyStepToNode);
  }
  return tree;
}

function deriveSequenceName(sourceColumn: string, outputColumn: string): string {
  const source = sourceColumn.trim();
  const output = outputColumn.trim();
  if (!output) return source ? `Transform ${source}` : 'Column transformation';
  return source && source !== output ? `${source} -> ${output}` : `Transform ${output}`;
}

function isInlineParam(def: ParameterDef | undefined): boolean {
  if (!def) return false;
  return def.type === 'text' || def.type === 'number' || def.type === 'select' || def.type === 'toggle' || def.type === 'date';
}

function isComplexPrimitive(primitive: TransformPrimitive | null): boolean {
  if (!primitive) return true;
  if (primitive.id === 'case_when') return true;
  if (primitive.parameters.length > 1) return true;
  return primitive.parameters.some(param => param.type === 'expression' || param.type === 'list');
}

function sortPrimitives(primitives: TransformPrimitive[]): TransformPrimitive[] {
  return [...primitives].sort((left, right) => left.label.localeCompare(right.label));
}

function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (value === undefined || value === null || value === '') return 'blank';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function summarizeStep(step: TransformStep, primitive: TransformPrimitive | null): string {
  if (!primitive) return 'Select a transformation';
  if (primitive.id === 'case_when') {
    const branches = Array.isArray(step.params.branches) ? step.params.branches : [];
    const elseValue = step.params.else ?? 'NULL';
    return `${branches.length} branch${branches.length === 1 ? '' : 'es'}; else ${summarizeValue(elseValue)}`;
  }
  if (primitive.parameters.length === 0) return 'No input needed';
  if (primitive.parameters.length === 1) {
    const param = primitive.parameters[0];
    return `${param.label}: ${summarizeValue(step.params[param.id] ?? param.default)}`;
  }
  return primitive.parameters
    .map(param => `${param.label}: ${summarizeValue(step.params[param.id] ?? param.default)}`)
    .join(' | ');
}

function renderInlineParamInput(
  param: ParameterDef,
  value: any,
  onChange: (next: any) => void,
  disabled?: boolean,
) {
  if (param.type === 'text') {
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={param.placeholder}
        className={MINI_CONTROL_CLASSNAME}
      />
    );
  }

  if (param.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder={param.placeholder}
        className={MINI_CONTROL_CLASSNAME}
      />
    );
  }

  if (param.type === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={MINI_CONTROL_CLASSNAME}
      />
    );
  }

  if (param.type === 'toggle') {
    return (
      <label className="flex h-9 items-center gap-2 rounded-md border border-slate-600 bg-[#1e2035] px-3 text-[12px] text-slate-200">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded"
        />
        <span>{param.label}</span>
      </label>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={MINI_CONTROL_CLASSNAME}
    >
      <option value="">Select</option>
      {param.options?.map(option => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CaseWhenEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  disabled?: boolean;
}) {
  const branches = Array.isArray(value.branches) && value.branches.length > 0
    ? value.branches
    : [{ when: '', then: '' }];

  const updateBranch = (index: number, key: 'when' | 'then', nextValue: string) => {
    const nextBranches = branches.map((branch, branchIndex) =>
      branchIndex === index ? { ...branch, [key]: nextValue } : branch
    );
    onChange({ ...value, branches: nextBranches });
  };

  const addBranch = () => {
    onChange({ ...value, branches: [...branches, { when: '', then: '' }] });
  };

  const removeBranch = (index: number) => {
    const nextBranches = branches.length > 1 ? branches.filter((_, branchIndex) => branchIndex !== index) : [{ when: '', then: '' }];
    onChange({ ...value, branches: nextBranches });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full table-fixed">
          <thead className="bg-[#101426] text-left text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Then</th>
              <th className="w-16 px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch, index) => (
              <tr key={index} className="border-t border-slate-700 bg-[#111320]">
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={branch.when ?? ''}
                    onChange={e => updateBranch(index, 'when', e.target.value)}
                    disabled={disabled}
                    placeholder="amount > 1000"
                    className={MINI_CONTROL_CLASSNAME}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={branch.then ?? ''}
                    onChange={e => updateBranch(index, 'then', e.target.value)}
                    disabled={disabled}
                    placeholder="'HIGH_VALUE'"
                    className={MINI_CONTROL_CLASSNAME}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => removeBranch(index)}
                    disabled={disabled}
                    className="h-9 w-full rounded-md border border-red-500/30 bg-red-500/10 text-[12px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addBranch}
          disabled={disabled}
          className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[12px] font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-40"
        >
          Add Branch
        </button>
        <div className="flex-1">
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Else
          </label>
          <input
            type="text"
            value={value.else ?? 'NULL'}
            onChange={e => onChange({ ...value, else: e.target.value })}
            disabled={disabled}
            placeholder="NULL"
            className={MINI_CONTROL_CLASSNAME}
          />
        </div>
      </div>
    </div>
  );
}

function ExpandedStepPanel({
  step,
  primitive,
  disabled,
  onStepChange,
}: {
  step: TransformStep;
  primitive: TransformPrimitive | null;
  disabled?: boolean;
  onStepChange: (next: TransformStep) => void;
}) {
  if (!primitive) {
    return null;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_260px]">
      <div className="rounded-lg border border-slate-700 bg-[#111320] p-3">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-blue-300">
          Advanced Inputs
        </div>
        {primitive.id === 'case_when' ? (
          <CaseWhenEditor
            value={step.params}
            onChange={params => onStepChange({ ...step, params })}
            disabled={disabled || !step.enabled}
          />
        ) : (
          <ParameterPanel
            primitive={primitive}
            values={step.params}
            onChange={params => onStepChange({ ...step, params })}
            disabled={disabled || !step.enabled}
          />
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-[#111320] p-3">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-blue-300">
          Row Settings
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">On Error</label>
            <select
              value={step.onError}
              onChange={e => onStepChange({ ...step, onError: e.target.value as TransformStep['onError'] })}
              disabled={disabled || !step.enabled}
              className={CONTROL_CLASSNAME}
            >
              <option value="FAIL">Fail the pipeline</option>
              <option value="RETURN_NULL">Return null for this row</option>
              <option value="USE_DEFAULT">Use default value</option>
            </select>
          </div>

          {step.onError === 'USE_DEFAULT' && (
            <div>
              <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Default Value</label>
              <input
                type="text"
                value={step.defaultValue ?? ''}
                onChange={e => onStepChange({ ...step, defaultValue: e.target.value })}
                disabled={disabled || !step.enabled}
                className={CONTROL_CLASSNAME}
                placeholder="Fallback value"
              />
            </div>
          )}

          <div className="rounded-md border border-slate-700 bg-[#0d1020] px-3 py-2 text-[12px] text-slate-400">
            {primitive.description}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MultiTransformEditor: React.FC<MultiTransformEditorProps> = ({
  columnId,
  columnName,
  pipelineId,
  datasetId,
  defaultEngine,
  initialSequence,
  availableColumns = [],
  onSave,
  onCancel,
}) => {
  const [sequence, setSequence] = useState<TransformSequence>(() => {
    const initial = initialSequence ?? createSequence(columnId, columnName, pipelineId, datasetId, defaultEngine);
    const seededSource = initial.sourceColumn?.trim() || availableColumns[0] || initial.columnName;
    return {
      ...initial,
      enabled: initial.enabled !== false,
      sourceColumn: seededSource,
      targetEngine: defaultEngine,
      name: deriveSequenceName(seededSource, initial.columnName),
    };
  });
  const [mappingTree, setMappingTree] = useState<ColumnMappingTree>(() => deriveInitialTree(initialSequence));
  const [treeValidationErrors, setTreeValidationErrors] = useState<Record<string, string[]>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sourceColumnName = sequence.sourceColumn?.trim() || '';
  const outputColumnName = sequence.columnName.trim();
  const outputListId = `${columnId.replace(/[^a-zA-Z0-9_-]/g, '_')}-output-columns`;

  const updateSequence = useCallback((updater: (prev: TransformSequence) => TransformSequence) => {
    setSequence(prev => {
      const next = updater(prev);
      const source = next.sourceColumn?.trim() || '';
      const output = next.columnName?.trim() || '';
      return {
        ...next,
        name: deriveSequenceName(source, output),
        targetEngine: defaultEngine,
        updatedAt: new Date(),
      };
    });
  }, [defaultEngine]);

  const generatedExpression = useMemo(
    () => compileMappingTreeExpression(sourceColumnName || outputColumnName, mappingTree),
    [mappingTree, outputColumnName, sourceColumnName],
  );

  const handleValidate = useCallback((): TransformSequence | null => {
    const normalizedSequence: TransformSequence = {
      ...sequence,
      enabled: sequence.enabled !== false,
      sourceColumn: sourceColumnName,
      columnName: outputColumnName,
      targetEngine: defaultEngine,
      name: deriveSequenceName(sourceColumnName, outputColumnName),
    };

    if (!sourceColumnName) {
      setSaveError('Choose a source column before saving this mapping.');
      return null;
    }

    if (!outputColumnName) {
      setSaveError('Output column is required.');
      return null;
    }

    if (mappingTree.root_group.children.length === 0) {
      setSaveError('Add at least one transformation or subgroup.');
      return null;
    }

    const result = validateMappingTree(mappingTree);
    if (Object.keys(result).length > 0) {
      setTreeValidationErrors(result);
      setSaveError('Please fix the step validation errors before saving.');
      return null;
    }

    setTreeValidationErrors({});
    setSaveError(null);
    return normalizedSequence;
  }, [mappingTree, outputColumnName, sequence, sourceColumnName]);

  const handleSave = useCallback(async () => {
    const normalizedSequence = handleValidate();
    if (!normalizedSequence) return;

    setIsSaving(true);
    try {
      const baseWithTree: TransformSequence = {
        ...normalizedSequence,
        steps: [
          createStep('custom_sql', { expression: generatedExpression }, { enabled: normalizedSequence.enabled !== false }),
        ],
        ...( { mappingTree } as any),
      };

      const version = createVersionSnapshot(baseWithTree, '');
      const updated: TransformSequence = {
        ...baseWithTree,
        versions: [...(normalizedSequence.versions || []), version],
        currentVersionId: version.versionId,
        updatedAt: new Date(),
      };
      if (onSave) await onSave(updated);
      setSaveError(null);
      setTreeValidationErrors({});
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to save this column mapping.');
    } finally {
      setIsSaving(false);
    }
  }, [generatedExpression, handleValidate, mappingTree, onSave]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0f1a] text-slate-100" onClick={event => event.stopPropagation()}>
      <div className="shrink-0 border-b border-slate-700/80 bg-[#0e1022] px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-blue-300">Transform Column</div>
            <div className="mt-1 truncate text-[17px] font-semibold text-white">
              {deriveSequenceName(sourceColumnName, outputColumnName)}
            </div>
            <p className="mt-1 text-[12px] text-slate-400">
              Configure one source-to-output mapping, then stack transformations in a compact grid.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close transformation popup"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-700 bg-[#111320] px-4 py-3">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-blue-300">Mapping Row</div>
            <div className="grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Active</label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-600 bg-[#1e2035] px-3 text-[12px] text-slate-200">
                  <input
                    type="checkbox"
                    checked={sequence.enabled !== false}
                    onChange={e => updateSequence(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <span>{sequence.enabled === false ? 'Disabled' : 'Enabled'}</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Source Column</label>
                {availableColumns.length > 0 ? (
                  <select
                    value={sourceColumnName}
                    onChange={e => updateSequence(prev => ({ ...prev, sourceColumn: e.target.value }))}
                    className={CONTROL_CLASSNAME}
                  >
                    <option value="">Select source column</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={sourceColumnName}
                    onChange={e => updateSequence(prev => ({ ...prev, sourceColumn: e.target.value }))}
                    placeholder="source_column"
                    className={CONTROL_CLASSNAME}
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Output Column</label>
                <input
                  type="text"
                  list={outputListId}
                  value={outputColumnName}
                  onChange={e => updateSequence(prev => ({ ...prev, columnName: e.target.value }))}
                  placeholder="output_column"
                  className={CONTROL_CLASSNAME}
                />
                <datalist id={outputListId}>
                  {availableColumns.map(column => (
                    <option key={column} value={column} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          <RecursiveMappingBuilder
            value={mappingTree}
            availableColumns={availableColumns}
            onChange={setMappingTree}
            validationErrors={treeValidationErrors}
          />

          <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#111320]">
            <button
              type="button"
              onClick={() => setShowPreview(prev => !prev)}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-[12px] font-semibold text-slate-200 transition hover:bg-[#151a2d]"
            >
              <span>Expression Preview</span>
              <span className="text-slate-300">{showPreview ? 'Hide' : 'Show'}</span>
            </button>
            {showPreview && (
              <div className="border-t border-slate-700 px-4 py-3">
                <div className="overflow-x-auto rounded-md border border-slate-800 bg-[#070910] px-3 py-2 font-mono text-[12px] text-slate-100">
                  {sequence.enabled === false ? 'Mapping disabled' : generatedExpression || 'No active transformations selected'}
                </div>
              </div>
            )}
          </section>

          {saveError && (
            <section className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
              {saveError}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-700/80 bg-[#0e1022] px-5 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 bg-[#37445d] px-3 py-2 text-[12px] font-semibold text-slate-100 transition hover:bg-[#44536f]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiTransformEditor;
