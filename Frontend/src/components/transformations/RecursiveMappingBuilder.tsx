import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clipboard, ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react';
import { TRANSFORM_REGISTRY as BASE_TRANSFORM_REGISTRY, type ParameterDef as BaseParameterDef } from '../../registry/TransformRegistry';

export type ValueMode = 'value' | 'column';

export interface HybridValue {
  mode: ValueMode;
  value: string;
}

export interface CaseCondition {
  id: string;
  left: HybridValue;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'starts_with' | 'ends_with';
  right: HybridValue;
  then: HybridValue;
}

export type PrimitiveOperation = string;

export interface TransformationNode {
  id: string;
  type: 'transformation';
  operation: PrimitiveOperation;
  params: Record<string, any>;
}

export interface GroupNode {
  id: string;
  type: 'group';
  logic: 'parallel' | 'sequence' | 'case';
  is_expanded: boolean;
  children: MappingNode[];
  else?: HybridValue;
}

export type MappingNode = TransformationNode | GroupNode;

export interface ColumnMappingTree {
  root_group: GroupNode;
}

export type ColumnTypeMap = Record<string, string>;

export type ValidationMap = Record<string, string[]>;

interface RegistryParam {
  id: string;
  type: 'number' | 'string' | 'select' | 'toggle' | 'hybrid' | 'condition_list' | 'expression' | 'list';
  options?: string[];
}

interface RegistryEntry {
  kind: 'primitive' | 'group';
  params: RegistryParam[];
}

const OPERATION_IDS: string[] = [
  'to_number', 'to_date', 'cast',
  'substring', 'trim', 'ltrim', 'rtrim', 'upper', 'lower', 'title_case', 'length', 'concat', 'pad_left', 'pad_right', 'replace',
  'trim_timestamp', 'date_add', 'to_timestamp', 'date_format', 'extract_date_part', 'date_diff',
  'round', 'floor', 'ceil', 'abs', 'mod', 'power',
  'regex_extract', 'replace_regex', 'matches_regex',
  'coalesce', 'null_if', 'case_when',
  'custom_sql',
  'current_job_name', 'current_user', 'current_date', 'current_time',
  'rank', 'dense_rank', 'row_number',
  'math',
];

function mapBaseParam(param: BaseParameterDef): RegistryParam {
  if (param.type === 'number') return { id: param.id, type: 'number' };
  if (param.type === 'select') return { id: param.id, type: 'select', options: (param.options || []).map(option => String(option.value)) };
  if (param.type === 'toggle') return { id: param.id, type: 'toggle' };
  if (param.type === 'expression') return { id: param.id, type: 'expression' };
  if (param.type === 'list') return { id: param.id, type: 'list' };
  return { id: param.id, type: 'string' };
}

const DERIVED_REGISTRY: Record<string, RegistryEntry> = Object.entries(BASE_TRANSFORM_REGISTRY)
  .reduce<Record<string, RegistryEntry>>((acc, [id, primitive]) => {
    if (!OPERATION_IDS.includes(id)) return acc;
    acc[id] = {
      kind: 'primitive',
      params: primitive.parameters.map(mapBaseParam),
    };
    return acc;
  }, {});

const TRANSFORMATION_REGISTRY: Record<string, RegistryEntry> = {
  ...DERIVED_REGISTRY,
  current_job_name: {
    kind: 'primitive',
    params: [],
  },
  current_user: {
    kind: 'primitive',
    params: [],
  },
  current_date: {
    kind: 'primitive',
    params: [],
  },
  current_time: {
    kind: 'primitive',
    params: [],
  },
  rank: {
    kind: 'primitive',
    params: [
      { id: 'orderBy', type: 'expression' },
      { id: 'partitionBy', type: 'expression' },
    ],
  },
  dense_rank: {
    kind: 'primitive',
    params: [
      { id: 'orderBy', type: 'expression' },
      { id: 'partitionBy', type: 'expression' },
    ],
  },
  row_number: {
    kind: 'primitive',
    params: [
      { id: 'orderBy', type: 'expression' },
      { id: 'partitionBy', type: 'expression' },
    ],
  },
  math: {
    kind: 'primitive',
    params: [
      { id: 'operator', type: 'select', options: ['+', '-', '*', '/'] },
      { id: 'operand', type: 'hybrid' },
    ],
  },
};

const LEVEL_COLORS = ['#f97316', '#eab308', '#3b82f6', '#14b8a6', '#ef4444', '#6366f1'];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getLevelColor(level: number): string {
  return LEVEL_COLORS[level % LEVEL_COLORS.length];
}

function defaultHybrid(mode: ValueMode = 'value', value = ''): HybridValue {
  return { mode, value };
}

function createDefaultCondition(): CaseCondition {
  return {
    id: uid('cond'),
    left: defaultHybrid('column'),
    operator: '=',
    right: defaultHybrid('value'),
    then: defaultHybrid('value'),
  };
}

const DATE_REQUIRED_OPERATIONS = new Set<PrimitiveOperation>([
  'date_add',
  'date_diff',
  'date_format',
  'extract_date_part',
  'trim_timestamp',
]);

function normalizeType(rawType: string | undefined): string {
  return String(rawType ?? '').trim().toLowerCase();
}

function isTemporalType(rawType: string | undefined): boolean {
  const normalized = normalizeType(rawType);
  return normalized.includes('date') || normalized.includes('time');
}

function hasDatePreparation(node: MappingNode): boolean {
  if (node.type === 'transformation') {
    if (node.operation === 'to_date' || node.operation === 'to_timestamp') return true;
    if (node.operation === 'cast') {
      const targetType = String(node.params.targetType ?? '').toUpperCase();
      return targetType === 'DATE' || targetType === 'TIMESTAMP';
    }
    return false;
  }

  return node.children.some(child => hasDatePreparation(child));
}

function isLikelyDateFormat(value: string): boolean {
  const normalized = value.toLowerCase();
  return /y|m|d|h|s/.test(normalized) || normalized.includes('-') || normalized.includes('/');
}

export function createDefaultTransformation(operation: PrimitiveOperation = 'upper'): TransformationNode {
  if (operation === 'math') {
    return {
      id: uid('t'),
      type: 'transformation',
      operation,
      params: {
        operator: '+',
        operand: defaultHybrid('value', '0'),
      },
    };
  }

  if (operation === 'case' || operation === 'case_when') {
    return {
      id: uid('t'),
      type: 'transformation',
      operation: operation === 'case' ? 'case_when' : operation,
      params: {
        branches: [{ when: '', then: '' }],
        else: 'NULL',
      },
    };
  }

  if (operation === 'date_diff') {
    return {
      id: uid('t'),
      type: 'transformation',
      operation,
      params: {
        endOperand: defaultHybrid('column'),
        unit: 'DAY',
        sourceFormat: '',
        endFormat: '',
      },
    };
  }

  const registryEntry = TRANSFORMATION_REGISTRY[operation];
  const baseParams = (registryEntry?.params || []).reduce<Record<string, any>>((acc, param) => {
    if (param.type === 'number') acc[param.id] = '';
    else if (param.type === 'select') acc[param.id] = param.options?.[0] ?? '';
    else if (param.type === 'toggle') acc[param.id] = false;
    else if (param.type === 'list') acc[param.id] = [];
    else acc[param.id] = '';
    return acc;
  }, {});

  return {
    id: uid('t'),
    type: 'transformation',
    operation,
    params: baseParams,
  };
}

export function createDefaultGroup(logic: GroupNode['logic'] = 'parallel', expanded = true): GroupNode {
  return {
    id: uid('g'),
    type: 'group',
    logic,
    is_expanded: expanded,
    children: [],
    else: defaultHybrid('value', '0'),
  };
}

export function createDefaultMappingTree(): ColumnMappingTree {
  return {
    root_group: {
      ...createDefaultGroup('parallel', true),
      id: 'root_group',
    },
  };
}

function cloneNode<T>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

function visitNode(node: MappingNode, updater: (node: MappingNode) => MappingNode): MappingNode {
  const updated = updater(node);
  if (updated.type === 'group') {
    return {
      ...updated,
      children: updated.children.map(child => visitNode(child, updater)),
    };
  }
  return updated;
}

function replaceNode(root: GroupNode, nodeId: string, updater: (node: MappingNode) => MappingNode): GroupNode {
  return visitNode(root, node => (node.id === nodeId ? updater(node) : node)) as GroupNode;
}

function mutateGroupChildren(root: GroupNode, groupId: string, mutate: (children: MappingNode[]) => MappingNode[]): GroupNode {
  return replaceNode(root, groupId, node => {
    if (node.type !== 'group') return node;
    return {
      ...node,
      children: mutate(node.children),
    };
  });
}

function removeNode(root: GroupNode, targetId: string): GroupNode {
  const trim = (group: GroupNode): GroupNode => ({
    ...group,
    children: group.children
      .filter(child => child.id !== targetId)
      .map(child => (child.type === 'group' ? trim(child) : child)),
  });
  return trim(root);
}

function countNested(node: MappingNode): { steps: number; nestedGroups: number } {
  if (node.type === 'transformation') {
    return { steps: 1, nestedGroups: 0 };
  }
  return node.children.reduce(
    (acc, child) => {
      const nested = countNested(child);
      return {
        steps: acc.steps + nested.steps,
        nestedGroups: acc.nestedGroups + nested.nestedGroups + (child.type === 'group' ? 1 : 0),
      };
    },
    { steps: 0, nestedGroups: 0 }
  );
}

function applyExpandAll(root: GroupNode, expanded: boolean): GroupNode {
  return visitNode(root, node => {
    if (node.type === 'group') {
      return { ...node, is_expanded: expanded };
    }
    return node;
  }) as GroupNode;
}

function moveChild(children: MappingNode[], index: number, direction: 'up' | 'down'): MappingNode[] {
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= children.length || nextIndex < 0 || nextIndex >= children.length) {
    return children;
  }
  const updated = [...children];
  const [item] = updated.splice(index, 1);
  updated.splice(nextIndex, 0, item);
  return updated;
}

function hybridToSql(h: HybridValue): string {
  if (!h) return 'NULL';
  if (h.mode === 'column') return h.value || 'NULL';
  const asNumber = Number(h.value);
  if (!Number.isNaN(asNumber) && h.value !== '') return String(asNumber);
  return `'${String(h.value ?? '').replace(/'/g, "''")}'`;
}

function conditionToSql(condition: CaseCondition): string {
  const left = hybridToSql(condition.left);
  const right = hybridToSql(condition.right);
  if (condition.operator === 'contains') return `${left} LIKE '%' || ${right} || '%'`;
  if (condition.operator === 'starts_with') return `${left} LIKE ${right} || '%'`;
  if (condition.operator === 'ends_with') return `${left} LIKE '%' || ${right}`;
  return `${left} ${condition.operator} ${right}`;
}

function applyPrimitiveSql(inputExpr: string, node: TransformationNode): string {
  if (node.operation === 'math') {
    const op = node.params.operator || '+';
    const operand = hybridToSql(node.params.operand || defaultHybrid('value', '0'));
    return `(${inputExpr} ${op} ${operand})`;
  }

  if (node.operation === 'case') {
    const conditions: CaseCondition[] = Array.isArray(node.params.conditions) ? node.params.conditions : [];
    const parts = conditions.map(condition => `WHEN ${conditionToSql(condition)} THEN ${hybridToSql(condition.then)}`);
    const elseExpr = hybridToSql(node.params.else || defaultHybrid('value', '0'));
    return `CASE ${parts.join(' ')} ELSE ${elseExpr} END`;
  }

  if (node.operation === 'rank' || node.operation === 'dense_rank' || node.operation === 'row_number') {
    const fn = node.operation === 'dense_rank' ? 'DENSE_RANK' : node.operation === 'row_number' ? 'ROW_NUMBER' : 'RANK';
    const orderBy = String(node.params.orderBy || inputExpr);
    const partitionBy = String(node.params.partitionBy || '').trim();
    const partitionClause = partitionBy ? `PARTITION BY ${partitionBy} ` : '';
    return `${fn}() OVER (${partitionClause}ORDER BY ${orderBy})`;
  }

  if (node.operation === 'current_job_name') {
    return `'${String(node.params.jobName ?? '__JOB_NAME__').replace(/'/g, "''")}'`;
  }

  if (node.operation === 'current_user') {
    return 'CURRENT_USER()';
  }

  if (node.operation === 'current_date') {
    return 'CURRENT_DATE()';
  }

  if (node.operation === 'current_time') {
    return 'CURRENT_TIMESTAMP()';
  }

  if (node.operation === 'date_diff') {
    const unit = String(node.params.unit || 'DAY').toUpperCase();
    const sourceFormat = String(node.params.sourceFormat ?? '').trim();
    const endFormat = String(node.params.endFormat ?? '').trim();
    const endOperand: HybridValue = node.params.endOperand || defaultHybrid('column');

    const rawEndExpr = endOperand.mode === 'column'
      ? String(endOperand.value || 'NULL')
      : `'${String(endOperand.value ?? '').replace(/'/g, "''")}'`;

    const leftExpr = sourceFormat ? `TO_DATE(${inputExpr}, '${sourceFormat.replace(/'/g, "''")}')` : inputExpr;
    const rightExpr = endFormat ? `TO_DATE(${rawEndExpr}, '${endFormat.replace(/'/g, "''")}')` : rawEndExpr;

    if (unit === 'MONTH') return `MONTHS_BETWEEN(${rightExpr}, ${leftExpr})`;
    if (unit === 'YEAR') return `FLOOR(MONTHS_BETWEEN(${rightExpr}, ${leftExpr}) / 12)`;
    return `DATEDIFF(${rightExpr}, ${leftExpr})`;
  }

  const primitive = BASE_TRANSFORM_REGISTRY[node.operation];
  if (primitive?.codeGenTemplate?.spark) {
    try {
      return primitive.codeGenTemplate.spark(node.params || {}, inputExpr);
    } catch {
      return inputExpr;
    }
  }

  return inputExpr;
}

function applyGroupSql(inputExpr: string, group: GroupNode): string {
  if (group.children.length === 0) return inputExpr;
  return group.children.reduce((expr, child) => {
    if (child.type === 'transformation') {
      return applyPrimitiveSql(expr, child);
    }
    return applyGroupSql(expr, child);
  }, inputExpr);
}

export function compileMappingTreeExpression(sourceColumn: string, tree: ColumnMappingTree): string {
  const baseExpr = sourceColumn || 'NULL';
  return applyGroupSql(baseExpr, tree.root_group);
}

function validateHybridValue(value: HybridValue | undefined, label: string, errors: string[]) {
  if (!value || !value.value) {
    errors.push(`${label} is required.`);
  }
}

function validateNode(
  node: MappingNode,
  map: ValidationMap,
  context: {
    sourceColumn?: string;
    sourceColumnType?: string;
    columnTypeMap?: ColumnTypeMap;
    hasDateConversion?: boolean;
  },
): void {
  const errors: string[] = [];

  if (node.type === 'transformation') {
    const rules = TRANSFORMATION_REGISTRY[node.operation];
    if (!rules) {
      errors.push(`Unsupported transformation: ${node.operation}`);
    } else {
      rules.params.forEach(param => {
        const value = node.params[param.id];
        if (param.type === 'number' && (value === '' || value === null || value === undefined || Number.isNaN(Number(value)))) {
          errors.push(`${param.id} must be a number.`);
        }
        if (param.type === 'string' && !String(value ?? '').trim()) {
          errors.push(`${param.id} is required.`);
        }
        if (param.type === 'select' && !String(value ?? '').trim()) {
          errors.push(`${param.id} is required.`);
        }
        if (param.type === 'hybrid') {
          validateHybridValue(value as HybridValue, param.id, errors);
        }
        if (param.type === 'expression' && !String(value ?? '').trim()) {
          errors.push(`${param.id} is required.`);
        }
        if (param.type === 'list' && !Array.isArray(value)) {
          errors.push(`${param.id} must be a list.`);
        }
        if (param.type === 'condition_list') {
          const conditions: CaseCondition[] = Array.isArray(value) ? value : [];
          if (conditions.length === 0) {
            errors.push('At least one condition is required.');
          }
          conditions.forEach((condition, idx) => {
            validateHybridValue(condition.left, `Condition ${idx + 1} left`, errors);
            validateHybridValue(condition.right, `Condition ${idx + 1} right`, errors);
            validateHybridValue(condition.then, `Condition ${idx + 1} then`, errors);
          });
        }
      });

      if (DATE_REQUIRED_OPERATIONS.has(node.operation)) {
        const sourceIsTemporal = isTemporalType(context.sourceColumnType);
        if (!sourceIsTemporal && !context.hasDateConversion) {
          errors.push('Date operation requires a date/timestamp source, or add to_date/to_timestamp before this step.');
        }
      }

      if (node.operation === 'date_diff') {
        const sourceIsTemporal = isTemporalType(context.sourceColumnType);
        const sourceFormat = String(node.params.sourceFormat ?? '').trim();
        if (!sourceIsTemporal && !context.hasDateConversion) {
          if (!sourceFormat) {
            errors.push('sourceFormat is required when source column is not date/timestamp.');
          } else if (!isLikelyDateFormat(sourceFormat)) {
            errors.push('sourceFormat must look like a date format (example: yyyy-MM-dd).');
          }
        }

        const endOperand = (node.params.endOperand || defaultHybrid('column')) as HybridValue;
        if (!String(endOperand.value ?? '').trim()) {
          errors.push('endOperand is required for date_diff.');
        } else if (endOperand.mode === 'column') {
          const endType = context.columnTypeMap?.[endOperand.value];
          if (!isTemporalType(endType)) {
            const endFormat = String(node.params.endFormat ?? '').trim();
            if (!endFormat) {
              errors.push('endFormat is required when end column is not date/timestamp.');
            } else if (!isLikelyDateFormat(endFormat)) {
              errors.push('endFormat must look like a date format (example: yyyy-MM-dd).');
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    map[node.id] = errors;
  }

  if (node.type === 'group') {
    node.children.forEach(child => validateNode(child, map, context));
  }
}

export function validateMappingTree(
  tree: ColumnMappingTree,
  options?: {
    sourceColumn?: string;
    sourceColumnType?: string;
    columnTypeMap?: ColumnTypeMap;
  },
): ValidationMap {
  const errors: ValidationMap = {};
  validateNode(tree.root_group, errors, {
    sourceColumn: options?.sourceColumn,
    sourceColumnType: options?.sourceColumnType,
    columnTypeMap: options?.columnTypeMap,
    hasDateConversion: hasDatePreparation(tree.root_group),
  });
  return errors;
}

function HybridInput({
  label,
  value,
  availableColumns,
  onChange,
}: {
  label: string;
  value: HybridValue;
  availableColumns: string[];
  onChange: (value: HybridValue) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="grid gap-2 md:grid-cols-[110px_minmax(0,1fr)]">
        <select
          value={value.mode}
          onChange={e => onChange({ ...value, mode: e.target.value as ValueMode, value: '' })}
          className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
        >
          <option value="value">Value</option>
          <option value="column">Column</option>
        </select>

        {value.mode === 'column' ? (
          <select
            value={value.value}
            onChange={e => onChange({ ...value, value: e.target.value })}
            className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
          >
            <option value="">Select column</option>
            {availableColumns.map(column => (
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
        ) : (
          <input
            value={value.value}
            onChange={e => onChange({ ...value, value: e.target.value })}
            placeholder="Enter value"
            className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
          />
        )}
      </div>
    </div>
  );
}

function ConditionListEditor({
  conditions,
  availableColumns,
  onChange,
}: {
  conditions: CaseCondition[];
  availableColumns: string[];
  onChange: (conditions: CaseCondition[]) => void;
}) {
  const safeConditions = conditions.length > 0 ? conditions : [createDefaultCondition()];

  return (
    <div className="overflow-hidden rounded border border-slate-700">
      {safeConditions.map((condition, index) => (
        <div key={condition.id} className={`${index > 0 ? 'border-t border-slate-700' : ''} ${index % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} p-2`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Condition {index + 1}</div>
            <button
              type="button"
              onClick={() => onChange(safeConditions.filter(item => item.id !== condition.id))}
              className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-300"
            >
              Delete
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <HybridInput
              label="When Left"
              value={condition.left}
              availableColumns={availableColumns}
              onChange={next => onChange(safeConditions.map(item => item.id === condition.id ? { ...item, left: next } : item))}
            />
            <HybridInput
              label="When Right"
              value={condition.right}
              availableColumns={availableColumns}
              onChange={next => onChange(safeConditions.map(item => item.id === condition.id ? { ...item, right: next } : item))}
            />
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-[130px_minmax(0,1fr)]">
            <select
              value={condition.operator}
              onChange={e => onChange(safeConditions.map(item => item.id === condition.id ? { ...item, operator: e.target.value as CaseCondition['operator'] } : item))}
              className="h-8 rounded-md border border-slate-600 bg-[#1f2238] px-2 text-[11px] text-slate-100"
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="contains">contains</option>
              <option value="starts_with">starts with</option>
              <option value="ends_with">ends with</option>
            </select>
            <HybridInput
              label="Then"
              value={condition.then}
              availableColumns={availableColumns}
              onChange={next => onChange(safeConditions.map(item => item.id === condition.id ? { ...item, then: next } : item))}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...safeConditions, createDefaultCondition()])}
        className="m-2 rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300"
      >
        Add Condition
      </button>
    </div>
  );
}

function TransformationParams({
  node,
  availableColumns,
  sourceColumn,
  columnTypeMap,
  dateOpsAllowed,
  onChange,
}: {
  node: TransformationNode;
  availableColumns: string[];
  sourceColumn?: string;
  columnTypeMap?: ColumnTypeMap;
  dateOpsAllowed?: boolean;
  onChange: (node: TransformationNode) => void;
}) {
  const entry = TRANSFORMATION_REGISTRY[node.operation];
  if (!entry || entry.params.length === 0) {
    return <div className="text-[11px] text-slate-400">No parameters required.</div>;
  }

  if (node.operation === 'case_when') {
    const branches = Array.isArray(node.params.branches) && node.params.branches.length > 0
      ? node.params.branches
      : [{ when: '', then: '' }];
    return (
      <div className="space-y-2">
        {branches.map((branch: any, idx: number) => (
          <div key={idx} className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_52px]">
            <input
              value={branch.when ?? ''}
              onChange={e => {
                const next = branches.map((row: any, rowIdx: number) => rowIdx === idx ? { ...row, when: e.target.value } : row);
                onChange({ ...node, params: { ...node.params, branches: next } });
              }}
              placeholder="WHEN condition"
              className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            />
            <input
              value={branch.then ?? ''}
              onChange={e => {
                const next = branches.map((row: any, rowIdx: number) => rowIdx === idx ? { ...row, then: e.target.value } : row);
                onChange({ ...node, params: { ...node.params, branches: next } });
              }}
              placeholder="THEN value"
              className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                const next = branches.length === 1 ? [{ when: '', then: '' }] : branches.filter((_: any, rowIdx: number) => rowIdx !== idx);
                onChange({ ...node, params: { ...node.params, branches: next } });
              }}
              className="h-7 rounded border border-red-500/30 bg-red-500/10 px-2 text-[10px] text-red-300"
            >
              Del
            </button>
          </div>
        ))}
        <div className="grid gap-1.5 md:grid-cols-[120px_minmax(0,1fr)]">
          <button
            type="button"
            onClick={() => onChange({ ...node, params: { ...node.params, branches: [...branches, { when: '', then: '' }] } })}
            className="h-7 rounded border border-blue-500/30 bg-blue-500/10 px-2 text-[10px] text-blue-300"
          >
            + Branch
          </button>
          <input
            value={node.params.else ?? 'NULL'}
            onChange={e => onChange({ ...node, params: { ...node.params, else: e.target.value } })}
            placeholder="ELSE value"
            className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
          />
        </div>
      </div>
    );
  }

  if (node.operation === 'date_diff') {
    const endOperand: HybridValue = node.params.endOperand || defaultHybrid('column');
    const sourceType = sourceColumn ? columnTypeMap?.[sourceColumn] : undefined;
    const sourceIsTemporal = isTemporalType(sourceType);

    return (
      <div className="space-y-2">
        {!dateOpsAllowed && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
            Source is not date/timestamp. Add to_date/to_timestamp first, or provide sourceFormat.
          </div>
        )}

        <div className="grid gap-1.5 md:grid-cols-[120px_minmax(0,1fr)]">
          <select
            value={endOperand.mode}
            onChange={e => onChange({ ...node, params: { ...node.params, endOperand: { mode: e.target.value as ValueMode, value: '' } } })}
            className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
          >
            <option value="column">End column</option>
            <option value="value">End value</option>
          </select>
          {endOperand.mode === 'column' ? (
            <select
              value={endOperand.value}
              onChange={e => onChange({ ...node, params: { ...node.params, endOperand: { ...endOperand, value: e.target.value } } })}
              className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            >
              <option value="">Select end column</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          ) : (
            <input
              value={endOperand.value}
              onChange={e => onChange({ ...node, params: { ...node.params, endOperand: { ...endOperand, value: e.target.value } } })}
              placeholder="2026-03-29"
              className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            />
          )}
        </div>

        <div className="grid gap-1.5 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Unit</div>
            <select
              value={String(node.params.unit ?? 'DAY')}
              onChange={e => onChange({ ...node, params: { ...node.params, unit: e.target.value } })}
              className="h-7 w-full rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            >
              <option value="DAY">DAY</option>
              <option value="MONTH">MONTH</option>
              <option value="YEAR">YEAR</option>
            </select>
          </div>

          {!sourceIsTemporal && (
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">sourceFormat</div>
              <input
                value={String(node.params.sourceFormat ?? '')}
                onChange={e => onChange({ ...node, params: { ...node.params, sourceFormat: e.target.value } })}
                placeholder="yyyy-MM-dd"
                className="h-7 w-full rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
              />
            </div>
          )}
        </div>

        {endOperand.mode === 'column' && endOperand.value && !isTemporalType(columnTypeMap?.[endOperand.value]) && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">endFormat</div>
            <input
              value={String(node.params.endFormat ?? '')}
              onChange={e => onChange({ ...node, params: { ...node.params, endFormat: e.target.value } })}
              placeholder="yyyy-MM-dd"
              className="h-7 w-full rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entry.params.map(param => {
        const value = node.params[param.id];

        if (param.type === 'number') {
          return (
            <div key={param.id}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.id}</div>
              <input
                type="number"
                value={value ?? ''}
                onChange={e => onChange({ ...node, params: { ...node.params, [param.id]: e.target.value === '' ? '' : Number(e.target.value) } })}
                className="h-8 w-full rounded-md border border-slate-600 bg-[#1f2238] px-2 text-[11px] text-slate-100"
              />
            </div>
          );
        }

        if (param.type === 'string') {
          return (
            <div key={param.id}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.id}</div>
              <input
                value={value ?? ''}
                onChange={e => onChange({ ...node, params: { ...node.params, [param.id]: e.target.value } })}
                className="h-8 w-full rounded-md border border-slate-600 bg-[#1f2238] px-2 text-[11px] text-slate-100"
              />
            </div>
          );
        }

        if (param.type === 'select') {
          return (
            <div key={param.id}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.id}</div>
              <select
                value={value ?? ''}
                onChange={e => onChange({ ...node, params: { ...node.params, [param.id]: e.target.value } })}
                className="h-8 w-full rounded-md border border-slate-600 bg-[#1f2238] px-2 text-[11px] text-slate-100"
              >
                <option value="">Select</option>
                {(param.options || []).map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        }

        if (param.type === 'toggle') {
          return (
            <label key={param.id} className="flex h-7 items-center gap-2 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={e => onChange({ ...node, params: { ...node.params, [param.id]: e.target.checked } })}
                className="h-3.5 w-3.5"
              />
              <span>{param.id}</span>
            </label>
          );
        }

        if (param.type === 'expression') {
          return (
            <div key={param.id}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.id}</div>
              <input
                value={value ?? ''}
                onChange={e => onChange({ ...node, params: { ...node.params, [param.id]: e.target.value } })}
                className="h-7 w-full rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
              />
            </div>
          );
        }

        if (param.type === 'list') {
          const listValue: string[] = Array.isArray(value) ? value : [];
          return (
            <div key={param.id} className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.id}</div>
              {listValue.map((item, idx) => (
                <div key={`${param.id}_${idx}`} className="grid grid-cols-[minmax(0,1fr)_52px] gap-1.5">
                  <input
                    value={item}
                    onChange={e => {
                      const next = [...listValue];
                      next[idx] = e.target.value;
                      onChange({ ...node, params: { ...node.params, [param.id]: next } });
                    }}
                    className="h-7 rounded border border-slate-600 bg-[#1f2238] px-2 text-[10px] text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = listValue.filter((_, rowIdx) => rowIdx !== idx);
                      onChange({ ...node, params: { ...node.params, [param.id]: next } });
                    }}
                    className="h-7 rounded border border-red-500/30 bg-red-500/10 px-2 text-[10px] text-red-300"
                  >
                    Del
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange({ ...node, params: { ...node.params, [param.id]: [...listValue, ''] } })}
                className="h-7 rounded border border-blue-500/30 bg-blue-500/10 px-2 text-[10px] text-blue-300"
              >
                + Item
              </button>
            </div>
          );
        }

        if (param.type === 'hybrid') {
          return (
            <HybridInput
              key={param.id}
              label={param.id}
              value={value || defaultHybrid('value')}
              availableColumns={availableColumns}
              onChange={next => onChange({ ...node, params: { ...node.params, [param.id]: next } })}
            />
          );
        }

        if (param.type === 'condition_list') {
          return (
            <ConditionListEditor
              key={param.id}
              conditions={Array.isArray(value) ? value : []}
              availableColumns={availableColumns}
              onChange={next => onChange({ ...node, params: { ...node.params, [param.id]: next } })}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function OperationBadge({ operation }: { operation: PrimitiveOperation }) {
  const label = operation.toUpperCase();
  return <span className="rounded bg-[#101426] px-2 py-0.5 text-[10px] font-semibold text-slate-300">{label}</span>;
}

const AVAILABLE_OPERATIONS = Object.keys(TRANSFORMATION_REGISTRY)
  .filter(operation => operation !== 'case')
  .sort((left, right) => left.localeCompare(right));

type OutputKind = 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'unknown';

const NUMERIC_OPS = new Set<PrimitiveOperation>(['to_number', 'round', 'floor', 'ceil', 'abs', 'mod', 'power', 'length', 'extract_date_part', 'date_diff', 'rank', 'dense_rank', 'row_number']);
const TEMPORAL_OPS = new Set<PrimitiveOperation>(['to_date', 'trim_timestamp', 'date_add', 'current_date']);
const DATETIME_OPS = new Set<PrimitiveOperation>(['to_timestamp', 'current_time']);
const BOOLEAN_OPS = new Set<PrimitiveOperation>(['matches_regex']);
const REQUIRE_TEMPORAL_INPUT = new Set<PrimitiveOperation>(['date_add', 'date_diff', 'date_format', 'extract_date_part', 'trim_timestamp']);
const REQUIRE_NUMERIC_INPUT = new Set<PrimitiveOperation>(['round', 'floor', 'ceil', 'abs', 'mod', 'power']);

function flattenTransformations(node: MappingNode): TransformationNode[] {
  if (node.type === 'transformation') return [node];
  return node.children.flatMap(child => flattenTransformations(child));
}

function normalizeToFlatTree(tree: ColumnMappingTree): ColumnMappingTree {
  return {
    root_group: {
      ...tree.root_group,
      logic: 'parallel',
      is_expanded: true,
      children: flattenTransformations(tree.root_group),
    },
  };
}

function operationCategory(operation: string): string {
  if (operation.startsWith('current_')) return 'system';
  const primitive = BASE_TRANSFORM_REGISTRY[operation];
  return primitive?.category || 'other';
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    convert: 'Convert',
    text: 'Text',
    datetime: 'Date/Time',
    numeric: 'Numeric',
    regex: 'Regex',
    aggregation: 'Null/Aggregation',
    conditional: 'Conditional',
    custom: 'Custom',
    system: 'Context',
    other: 'Other',
  };
  return map[category] || category;
}

function sourceKindFromType(rawType?: string): OutputKind {
  const t = normalizeType(rawType);
  if (!t) return 'unknown';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('date') && !t.includes('time')) return 'date';
  if (t.includes('time')) return 'datetime';
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return 'number';
  return 'string';
}

function outputKindForOperation(operation: PrimitiveOperation, node: TransformationNode, prev: OutputKind): OutputKind {
  if (NUMERIC_OPS.has(operation)) return 'number';
  if (TEMPORAL_OPS.has(operation)) return 'date';
  if (DATETIME_OPS.has(operation)) return 'datetime';
  if (BOOLEAN_OPS.has(operation)) return 'boolean';
  if (operation === 'cast') {
    const target = String(node.params.targetType ?? '').toUpperCase();
    if (target === 'DATE') return 'date';
    if (target === 'TIMESTAMP') return 'datetime';
    if (target === 'INTEGER' || target === 'DECIMAL') return 'number';
    if (target === 'BOOLEAN') return 'boolean';
    return 'string';
  }
  if (operation === 'custom_sql' || operation === 'coalesce' || operation === 'null_if' || operation === 'case_when' || operation === 'math') {
    return 'unknown';
  }
  if (operation === 'date_format') return 'string';
  return prev === 'unknown' ? 'string' : prev;
}

function isOperationAllowed(prev: OutputKind, operation: PrimitiveOperation): boolean {
  if (REQUIRE_TEMPORAL_INPUT.has(operation)) return prev === 'date' || prev === 'datetime' || prev === 'unknown';
  if (REQUIRE_NUMERIC_INPUT.has(operation)) return prev === 'number' || prev === 'unknown';
  return true;
}

function GroupSummary({ group }: { group: GroupNode }) {
  const { steps, nestedGroups } = countNested(group);
  return (
    <div className="text-[11px] text-slate-400">
      {group.logic.toUpperCase()} ({steps} steps, {nestedGroups} nested)
    </div>
  );
}

interface NodeEditorProps {
  node: MappingNode;
  level: number;
  index: number;
  siblingCount: number;
  availableColumns: string[];
  sourceColumn?: string;
  columnTypeMap?: ColumnTypeMap;
  dateOpsAllowed?: boolean;
  validationErrors: ValidationMap;
  onNodeChange: (nodeId: string, updater: (node: MappingNode) => MappingNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddChildTransformation: (groupId: string) => void;
  onAddSubGroup: (groupId: string) => void;
  onReorder: (groupId: string, index: number, direction: 'up' | 'down') => void;
  onCopyNode: (node: MappingNode) => void;
  onPasteNode: (groupId: string) => void;
  canPaste: boolean;
}

function NodeEditor(props: NodeEditorProps) {
  const {
    node,
    level,
    index,
    siblingCount,
    availableColumns,
    sourceColumn,
    columnTypeMap,
    dateOpsAllowed,
    validationErrors,
    onNodeChange,
    onDeleteNode,
    onAddChildTransformation,
    onAddSubGroup,
    onReorder,
    onCopyNode,
    onPasteNode,
    canPaste,
  } = props;

  const borderColor = getLevelColor(level);
  const errors = validationErrors[node.id] || [];

  if (node.type === 'transformation') {
    return (
      <div className="space-y-2">
        <div
          className={`rounded-md border p-2 ${errors.length > 0 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-[#111320]'}`}
          style={{ borderLeftColor: borderColor, borderLeftWidth: 4 }}
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <OperationBadge operation={node.operation} />
            <select
              value={node.operation}
              onChange={e => onNodeChange(node.id, () => createDefaultTransformation(e.target.value as PrimitiveOperation))}
              className="h-6 rounded border border-slate-600 bg-[#1f2238] px-1.5 text-[10px] text-slate-100"
            >
              {AVAILABLE_OPERATIONS.map(operation => (
                <option
                  key={operation}
                  value={operation}
                  disabled={!dateOpsAllowed && DATE_REQUIRED_OPERATIONS.has(operation)}
                >
                  {operation}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onCopyNode(node)}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300"
              title="Copy"
            >
              <Copy className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteNode(node.id)}
              className="flex h-6 w-6 items-center justify-center rounded border border-red-500/40 bg-red-500/10 text-red-300"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => onReorder('__parent__', index, 'up')}
              disabled={index === 0}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-40"
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => onReorder('__parent__', index, 'down')}
              disabled={index === siblingCount - 1}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-40"
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {!dateOpsAllowed && DATE_REQUIRED_OPERATIONS.has(node.operation) && (
            <div className="mb-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              Date operation selected on non-date source. Convert source to date/timestamp first.
            </div>
          )}

          <TransformationParams
            node={node}
            availableColumns={availableColumns}
            sourceColumn={sourceColumn}
            columnTypeMap={columnTypeMap}
            dateOpsAllowed={dateOpsAllowed}
            onChange={next => onNodeChange(node.id, () => next)}
          />

          {errors.length > 0 && (
            <div className="mt-2 text-[11px] text-red-300">{errors[0]}</div>
          )}
        </div>
      </div>
    );
  }

  const summary = countNested(node);

  return (
    <div className="space-y-2">
      <div
        className={`rounded-md border p-2 ${errors.length > 0 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-[#111320]'}`}
        style={{ borderLeftColor: borderColor, borderLeftWidth: 4 }}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNodeChange(node.id, current => ({ ...(current as GroupNode), is_expanded: !(current as GroupNode).is_expanded }))}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300"
            title={node.is_expanded ? 'Collapse group' : 'Expand group'}
          >
            {node.is_expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-90" />}
          </button>

          <select
            value={node.logic}
            onChange={e => onNodeChange(node.id, current => ({ ...(current as GroupNode), logic: e.target.value as GroupNode['logic'] }))}
            className="h-6 rounded border border-slate-600 bg-[#1f2238] px-1.5 text-[10px] text-slate-100"
          >
            <option value="parallel">Parallel Group</option>
            <option value="sequence">Sequence Group</option>
            <option value="case">Case Group</option>
          </select>

          <span className="rounded bg-[#101426] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {summary.steps} steps
          </span>

          <button
            type="button"
            onClick={() => onAddChildTransformation(node.id)}
            className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300"
            title="Add transformation"
          >
            <Plus className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onAddSubGroup(node.id)}
            className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300"
            title="Add subgroup"
          >
            <Clipboard className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onCopyNode(node)}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300"
            title="Copy group"
          >
            <Copy className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onPasteNode(node.id)}
            disabled={!canPaste}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-40"
            title="Paste group"
          >
            <ClipboardPaste className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="flex h-6 w-6 items-center justify-center rounded border border-red-500/40 bg-red-500/10 text-red-300"
            title="Delete group"
          >
            <Trash2 className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onReorder('__parent__', index, 'up')}
            disabled={index === 0}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-40"
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onReorder('__parent__', index, 'down')}
            disabled={index === siblingCount - 1}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-40"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {!node.is_expanded && (
          <GroupSummary group={node} />
        )}

        {node.is_expanded && (
          <div className="space-y-2">
            {node.logic === 'case' && (
              <HybridInput
                label="Else"
                value={node.else || defaultHybrid('value', '0')}
                availableColumns={availableColumns}
                onChange={next => onNodeChange(node.id, current => ({ ...(current as GroupNode), else: next }))}
              />
            )}

            {node.children.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-700 bg-[#101323] px-3 py-3 text-[11px] text-slate-500">
                Empty group. Add a transformation or subgroup.
              </div>
            ) : (
              <div className="space-y-2 border-l border-slate-700 pl-3">
                {node.children.map((child, childIndex) => (
                  <NodeEditor
                    key={child.id}
                    node={child}
                    level={level + 1}
                    index={childIndex}
                    siblingCount={node.children.length}
                    availableColumns={availableColumns}
                    validationErrors={validationErrors}
                    onNodeChange={(nodeId, updater) => {
                      onNodeChange(node.id, current => {
                        const group = current as GroupNode;
                        return {
                          ...group,
                          children: group.children.map(entry => entry.id === nodeId ? updater(entry) : entry),
                        };
                      });
                    }}
                    onDeleteNode={nodeId => {
                      onNodeChange(node.id, current => {
                        const group = current as GroupNode;
                        return {
                          ...group,
                          children: group.children.filter(entry => entry.id !== nodeId),
                        };
                      });
                    }}
                    onAddChildTransformation={groupId => {
                      onNodeChange(node.id, current => {
                        const group = current as GroupNode;
                        if (group.id !== groupId) return group;
                        return { ...group, children: [...group.children, createDefaultTransformation('upper')] };
                      });
                    }}
                    onAddSubGroup={groupId => {
                      onNodeChange(node.id, current => {
                        const group = current as GroupNode;
                        if (group.id !== groupId) return group;
                        return { ...group, children: [...group.children, createDefaultGroup('parallel', true)] };
                      });
                    }}
                    onReorder={(groupId, childIdx, direction) => {
                      onNodeChange(node.id, current => {
                        const group = current as GroupNode;
                        if (group.id !== groupId && groupId !== '__parent__') return group;
                        return {
                          ...group,
                          children: moveChild(group.children, childIdx, direction),
                        };
                      });
                    }}
                    onCopyNode={onCopyNode}
                    onPasteNode={groupId => {
                      onNodeChange(node.id, current => {
                        if (current.type !== 'group' || current.id !== groupId) return current;
                        return current;
                      });
                      onPasteNode(groupId);
                    }}
                    canPaste={canPaste}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-2 text-[11px] text-red-300">{errors[0]}</div>
        )}
      </div>
    </div>
  );
}

export interface RecursiveMappingBuilderProps {
  value: ColumnMappingTree;
  availableColumns: string[];
  onChange: (next: ColumnMappingTree) => void;
  validationErrors?: ValidationMap;
  sourceColumn?: string;
  columnTypeMap?: ColumnTypeMap;
}

export function RecursiveMappingBuilder({
  value,
  availableColumns,
  onChange,
  validationErrors = {},
  sourceColumn,
  columnTypeMap,
}: RecursiveMappingBuilderProps) {
  const [copiedRow, setCopiedRow] = useState<TransformationNode | null>(null);
  const [expandedCaseRowIds, setExpandedCaseRowIds] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  useEffect(() => {
    if (value.root_group.children.some(child => child.type === 'group')) {
      onChange(normalizeToFlatTree(value));
    }
  }, [value, onChange]);

  const normalizedTree = useMemo(() => normalizeToFlatTree(value), [value]);
  const rows = useMemo(() => normalizedTree.root_group.children.filter((child): child is TransformationNode => child.type === 'transformation'), [normalizedTree]);
  const sourceColumnType = sourceColumn ? columnTypeMap?.[sourceColumn] : undefined;
  const baseKind = sourceKindFromType(sourceColumnType);

  useEffect(() => {
    if (rows.length === 0) {
      setActiveRowId(null);
      return;
    }
    if (!activeRowId || !rows.some(row => row.id === activeRowId)) {
      setActiveRowId(rows[0].id);
    }
  }, [activeRowId, rows]);

  const groupedOperations = useMemo(() => {
    return AVAILABLE_OPERATIONS.reduce<Record<string, string[]>>((acc, operation) => {
      const category = operationCategory(operation);
      if (!acc[category]) acc[category] = [];
      acc[category].push(operation);
      return acc;
    }, {});
  }, []);

  const outputKindsByRow = useMemo(() => {
    const kinds: OutputKind[] = [];
    let current = baseKind;
    rows.forEach(row => {
      current = outputKindForOperation(row.operation, row, current);
      kinds.push(current);
    });
    return kinds;
  }, [baseKind, rows]);

  const setRows = (nextRows: TransformationNode[]) => {
    onChange({
      ...normalizedTree,
      root_group: {
        ...normalizedTree.root_group,
        logic: 'parallel',
        is_expanded: true,
        children: nextRows,
      },
    });
  };

  const addRow = (insertAt?: number, indent = 0) => {
    const next = createDefaultTransformation('upper');
    next.params.__indent = indent;
    if (insertAt === undefined) {
      setActiveRowId(next.id);
      setRows([...rows, next]);
      return;
    }
    const updated = [...rows];
    updated.splice(insertAt, 0, next);
    setActiveRowId(next.id);
    setRows(updated);
  };

  const updateRow = (rowId: string, updater: (row: TransformationNode) => TransformationNode) => {
    setRows(rows.map(row => (row.id === rowId ? updater(row) : row)));
  };

  const deleteRow = (rowId: string) => {
    setRows(rows.filter(row => row.id !== rowId));
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const next = moveChild(rows, index, direction).filter((entry): entry is TransformationNode => entry.type === 'transformation');
    setRows(next);
  };

  const renderInlineParam = (row: TransformationNode, param: RegistryParam) => {
    const value = row.params[param.id];
    const setParam = (nextValue: any) => updateRow(row.id, current => ({ ...current, params: { ...current.params, [param.id]: nextValue } }));

    if (param.type === 'number') {
      return <input value={value ?? ''} type="number" onChange={e => setParam(e.target.value === '' ? '' : Number(e.target.value))} className="h-6 w-[90px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100" />;
    }

    if (param.type === 'select') {
      return (
        <select value={value ?? ''} onChange={e => setParam(e.target.value)} className="h-6 min-w-[110px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100">
          <option value="">Select</option>
          {(param.options || []).map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }

    if (param.type === 'toggle') {
      return (
        <label className="flex h-6 items-center gap-1 rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-200">
          <input type="checkbox" checked={Boolean(value)} onChange={e => setParam(e.target.checked)} className="h-3 w-3" />
          <span>{param.id}</span>
        </label>
      );
    }

    if (param.type === 'hybrid') {
      const hybrid = value || defaultHybrid('value');
      return (
        <div className="flex items-center gap-1">
          <select
            value={hybrid.mode}
            onChange={e => setParam({ mode: e.target.value as ValueMode, value: '' })}
            className="h-6 w-[72px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
          >
            <option value="value">Val</option>
            <option value="column">Col</option>
          </select>
          {hybrid.mode === 'column' ? (
            <select
              value={hybrid.value}
              onChange={e => setParam({ ...hybrid, value: e.target.value })}
              className="h-6 min-w-[120px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
            >
              <option value="">Column</option>
              {availableColumns.map(column => <option key={column} value={column}>{column}</option>)}
            </select>
          ) : (
            <input
              value={hybrid.value}
              onChange={e => setParam({ ...hybrid, value: e.target.value })}
              className="h-6 w-[120px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
              placeholder="value"
            />
          )}
        </div>
      );
    }

    if (param.type === 'list') {
      const current = Array.isArray(value) ? value.join(',') : '';
      return (
        <input
          value={current}
          onChange={e => setParam(e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
          className="h-6 w-[140px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
          placeholder="a,b,c"
        />
      );
    }

    if (param.type === 'expression') {
      return <input value={value ?? ''} onChange={e => setParam(e.target.value)} className="h-6 w-[150px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100" placeholder={param.id} />;
    }

    return <input value={value ?? ''} onChange={e => setParam(e.target.value)} className="h-6 w-[120px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100" placeholder={param.id} />;
  };

  const activeRowIndex = rows.findIndex(row => row.id === activeRowId);

  return (
    <section>
      <div className="flex items-center justify-between border-b border-slate-800 px-1 py-1.5">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300">Transform</div>
          <div className="text-[10px] text-slate-400">Zebra rows. Click a line to edit. Add inserts below the active line.</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{activeRowIndex >= 0 ? `Editing line ${activeRowIndex + 1}` : 'No active line'}</span>
          <button
            type="button"
            onClick={() => addRow(activeRowIndex >= 0 ? activeRowIndex + 1 : undefined, activeRowIndex >= 0 ? Number(rows[activeRowIndex]?.params.__indent ?? 0) : 0)}
            className="flex h-4 w-4 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300"
            title="Add transformation below active line"
          >
            <Plus className="h-2 w-2" />
          </button>
        </div>
      </div>

      <div className="max-h-[460px] overflow-auto">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-slate-500">No transformations yet. Click + to add a row.</div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[34px]" />
              <col className="w-[220px]" />
              <col />
              <col className="w-[172px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#101426] text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">Transformation</th>
                <th className="px-2 py-1">Properties</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const prevKind = index === 0 ? baseKind : outputKindsByRow[index - 1];
                const rowErrors = validationErrors[row.id] || [];
                const indent = Math.max(0, Number(row.params.__indent ?? 0));
                const registryEntry = TRANSFORMATION_REGISTRY[row.operation];
                const isCase = row.operation === 'case_when';
                const showCase = expandedCaseRowIds.has(row.id);
                const isActive = row.id === activeRowId;

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => setActiveRowId(row.id)}
                      className={`${index % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} border-t border-slate-700 ${isActive ? 'shadow-[inset_2px_0_0_0_#3b82f6]' : ''} cursor-pointer`}
                    >
                      <td className="px-2 py-0.5 align-middle text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-700'}`} />
                          <span>L{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 align-middle">
                        <div className="flex items-center gap-1" style={{ marginLeft: `${indent * 14}px` }}>
                          <select
                            value={row.operation}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              setActiveRowId(row.id);
                              updateRow(row.id, current => createDefaultTransformation(e.target.value as PrimitiveOperation));
                            }}
                            className="h-6 w-full rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                          >
                            {Object.entries(groupedOperations).map(([category, operations]) => (
                              <optgroup key={category} label={categoryLabel(category)}>
                                {operations.map(operation => (
                                  <option key={operation} value={operation} disabled={!isOperationAllowed(prevKind, operation)}>
                                    {operation}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 align-middle">
                        {isCase ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveRowId(row.id);
                              setExpandedCaseRowIds(prev => {
                              const next = new Set(prev);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                              });
                            }}
                            className="h-6 rounded border border-slate-600 bg-[#1e2035] px-2 text-[10px] text-slate-200"
                          >
                            {showCase ? 'Hide CASE' : 'Edit CASE'}
                          </button>
                        ) : row.operation === 'date_diff' ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <select
                              value={row.params.endOperand?.mode || 'column'}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                setActiveRowId(row.id);
                                updateRow(row.id, current => ({ ...current, params: { ...current.params, endOperand: { mode: e.target.value as ValueMode, value: '' } } }));
                              }}
                              className="h-6 w-[84px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                            >
                              <option value="column">End col</option>
                              <option value="value">End val</option>
                            </select>
                            {(row.params.endOperand?.mode || 'column') === 'column' ? (
                              <select
                                value={row.params.endOperand?.value || ''}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  setActiveRowId(row.id);
                                  updateRow(row.id, current => ({ ...current, params: { ...current.params, endOperand: { ...(current.params.endOperand || defaultHybrid('column')), value: e.target.value } } }));
                                }}
                                className="h-6 min-w-[110px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                              >
                                <option value="">Column</option>
                                {availableColumns.map(column => <option key={column} value={column}>{column}</option>)}
                              </select>
                            ) : (
                              <input
                                value={row.params.endOperand?.value || ''}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  setActiveRowId(row.id);
                                  updateRow(row.id, current => ({ ...current, params: { ...current.params, endOperand: { ...(current.params.endOperand || defaultHybrid('value')), value: e.target.value } } }));
                                }}
                                className="h-6 w-[110px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                                placeholder="2026-03-29"
                              />
                            )}
                            <select
                              value={String(row.params.unit ?? 'DAY')}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                setActiveRowId(row.id);
                                updateRow(row.id, current => ({ ...current, params: { ...current.params, unit: e.target.value } }));
                              }}
                              className="h-6 w-[76px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                            >
                              <option value="DAY">DAY</option>
                              <option value="MONTH">MONTH</option>
                              <option value="YEAR">YEAR</option>
                            </select>
                            <input
                              value={String(row.params.sourceFormat ?? '')}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                setActiveRowId(row.id);
                                updateRow(row.id, current => ({ ...current, params: { ...current.params, sourceFormat: e.target.value } }));
                              }}
                              className="h-6 w-[98px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                              placeholder="src fmt"
                            />
                            <input
                              value={String(row.params.endFormat ?? '')}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                setActiveRowId(row.id);
                                updateRow(row.id, current => ({ ...current, params: { ...current.params, endFormat: e.target.value } }));
                              }}
                              className="h-6 w-[98px] rounded border border-slate-600 bg-[#1e2035] px-1.5 text-[10px] text-slate-100"
                              placeholder="end fmt"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1" onClick={e => e.stopPropagation()}>
                            {(registryEntry?.params || []).map(param => (
                              <div key={`${row.id}_${param.id}`} className="flex items-center gap-1">
                                <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{param.id}</span>
                                {renderInlineParam(row, param)}
                              </div>
                            ))}
                            {(registryEntry?.params || []).length === 0 && <span className="text-[10px] text-slate-500">No parameters</span>}
                          </div>
                        )}
                        {rowErrors.length > 0 && <div className="mt-1 text-[10px] text-red-300">{rowErrors[0]}</div>}
                      </td>
                      <td className="px-2 py-0.5 align-middle">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={e => { e.stopPropagation(); setActiveRowId(row.id); addRow(index + 1, indent + 1); }} className="flex h-4 w-4 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300" title={`Add line below L${index + 1}`}><Plus className="h-2 w-2" /></button>
                          <button type="button" onClick={e => { e.stopPropagation(); setActiveRowId(row.id); setCopiedRow(cloneNode(row)); }} className="flex h-4 w-4 items-center justify-center rounded border border-slate-600 text-slate-300" title="Copy line"><Copy className="h-2 w-2" /></button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (!copiedRow) return;
                              const pasted = cloneNode(copiedRow);
                              pasted.id = uid('t');
                              const updated = [...rows];
                              updated.splice(index + 1, 0, pasted);
                              setActiveRowId(pasted.id);
                              setRows(updated);
                            }}
                            disabled={!copiedRow}
                            className="flex h-4 w-4 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-35"
                            title={`Paste below L${index + 1}`}
                          >
                            <ClipboardPaste className="h-2 w-2" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); setActiveRowId(row.id); moveRow(index, 'up'); }} disabled={index === 0} className="flex h-4 w-4 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-35" title="Move up"><ChevronUp className="h-2 w-2" /></button>
                          <button type="button" onClick={e => { e.stopPropagation(); setActiveRowId(row.id); moveRow(index, 'down'); }} disabled={index === rows.length - 1} className="flex h-4 w-4 items-center justify-center rounded border border-slate-600 text-slate-300 disabled:opacity-35" title="Move down"><ChevronDown className="h-2 w-2" /></button>
                          <button type="button" onClick={e => { e.stopPropagation(); deleteRow(row.id); }} className="flex h-4 w-4 items-center justify-center rounded border border-red-500/40 bg-red-500/10 text-red-300" title="Delete"><Trash2 className="h-2 w-2" /></button>
                        </div>
                      </td>
                    </tr>
                    {isCase && showCase && (
                      <tr className="border-t border-slate-700 bg-[#0f1427]">
                        <td className="px-2 py-1 align-top text-[10px] text-slate-500"> </td>
                        <td colSpan={3} className="px-2 py-1 align-top">
                          <TransformationParams
                            node={row}
                            availableColumns={availableColumns}
                            sourceColumn={sourceColumn}
                            columnTypeMap={columnTypeMap}
                            dateOpsAllowed={true}
                            onChange={next => updateRow(row.id, () => next)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
