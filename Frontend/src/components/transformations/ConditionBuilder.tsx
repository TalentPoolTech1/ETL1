/**
 * Plain-language condition builder used by filter / branching editors.
 *
 * The original version was styled like a generic light form, which clashed with
 * the dark enterprise designer sidebar. This version keeps the same condition
 * model while matching the designer system and guarding against empty groups.
 */

import React, { useCallback, useMemo } from 'react';

export type ComparisonOperator = 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts_with' | 'is_null' | 'is_not_null';

export type LogicalOperator = 'AND' | 'OR';

export interface ConditionClause {
  id: string;
  field: string;
  operator: ComparisonOperator;
  value?: any;
}

export interface ConditionGroup {
  id: string;
  clauses: ConditionClause[];
  logicalOp: LogicalOperator; // How to combine clauses in this group
}

export interface ComplexCondition {
  groups: ConditionGroup[];
  groupLogicalOp: LogicalOperator; // How to combine groups
}

interface ConditionBuilderProps {
  value: ComplexCondition | null;
  onChange: (condition: ComplexCondition) => void;
  fields: Array<{ name: string; type: string }>; // Available columns in the dataset
  disabled?: boolean;
}

const OPERATORS: Record<ComparisonOperator, { label: string; requiresValue: boolean }> = {
  equals: { label: 'equals', requiresValue: true },
  not_equals: { label: 'does not equal', requiresValue: true },
  gt: { label: 'is greater than', requiresValue: true },
  gte: { label: 'is greater than or equal to', requiresValue: true },
  lt: { label: 'is less than', requiresValue: true },
  lte: { label: 'is less than or equal to', requiresValue: true },
  contains: { label: 'contains', requiresValue: true },
  starts_with: { label: 'starts with', requiresValue: true },
  is_null: { label: 'is blank', requiresValue: false },
  is_not_null: { label: 'is not blank', requiresValue: false },
};

const CONTROL_CLASSNAME = 'w-full h-10 px-3 rounded-lg bg-[#1e2035] border border-slate-600 text-slate-100 text-[12px] font-medium placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 disabled:opacity-40 disabled:cursor-not-allowed';
const MINI_SELECT_CLASSNAME = 'h-8 px-3 rounded-md bg-[#161a2f] border border-slate-600 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-blue-400';
const ACTION_BUTTON_CLASSNAME = 'inline-flex items-center justify-center h-9 px-3 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

function cloneCondition(condition: ComplexCondition): ComplexCondition {
  return JSON.parse(JSON.stringify(condition)) as ComplexCondition;
}

function describeClause(clause: ConditionClause): string {
  const operator = OPERATORS[clause.operator]?.label ?? clause.operator;
  const suffix = OPERATORS[clause.operator]?.requiresValue ? ` ${String(clause.value ?? '').trim() || '...'}` : '';
  return `${clause.field || 'Select field'} ${operator}${suffix}`;
}

function escapeSqlString(value: unknown): string {
  return String(value ?? '').replace(/'/g, "''");
}

function sqlLiteral(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return "''";
  if (/^[-+]?\d+(\.\d+)?$/.test(raw)) return raw;
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase();
  return `'${escapeSqlString(raw)}'`;
}

/**
 * Single condition clause editor
 */
function ConditionClauseEditor({
  clause,
  fields,
  onChange,
  onRemove,
  disabled,
  canRemove,
}: {
  clause: ConditionClause;
  fields: Array<{ name: string; type: string }>;
  onChange: (clause: ConditionClause) => void;
  onRemove: () => void;
  disabled?: boolean;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#13182d] p-3">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Column
          </label>
          <select
            value={clause.field}
            onChange={e => onChange({ ...clause, field: e.target.value })}
            disabled={disabled}
            className={CONTROL_CLASSNAME}
          >
            <option value="">Select upstream column...</option>
            {fields.map(f => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Operator
          </label>
          <select
            value={clause.operator}
            onChange={e => onChange({ ...clause, operator: e.target.value as ComparisonOperator })}
            disabled={disabled}
            className={CONTROL_CLASSNAME}
          >
            {Object.entries(OPERATORS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {OPERATORS[clause.operator].requiresValue && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Compare To
            </label>
            <input
              type="text"
              placeholder="Enter value"
              value={clause.value ?? ''}
              onChange={e => onChange({ ...clause, value: e.target.value })}
              disabled={disabled}
              className={CONTROL_CLASSNAME}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">{describeClause(clause)}</div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          className={`${ACTION_BUTTON_CLASSNAME} min-w-[6rem] border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/**
 * Main Condition Builder Component
 */
export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  value,
  onChange,
  fields,
  disabled,
}) => {
  const condition = useMemo<ComplexCondition>(() => value || {
    groups: [
      {
        id: 'g1',
        clauses: [{ id: 'c1', field: '', operator: 'equals' }],
        logicalOp: 'AND',
      },
    ],
    groupLogicalOp: 'AND',
  }, [value]);

  const handleClauseChange = useCallback(
    (groupIdx: number, clauseIdx: number, newClause: ConditionClause) => {
      const newCondition = cloneCondition(condition);
      newCondition.groups[groupIdx].clauses[clauseIdx] = newClause;
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleClauseRemove = useCallback(
    (groupIdx: number, clauseIdx: number) => {
      if ((condition.groups[groupIdx]?.clauses.length ?? 0) <= 1) return;
      const newCondition = cloneCondition(condition);
      newCondition.groups[groupIdx].clauses.splice(clauseIdx, 1);
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleAddClause = useCallback(
    (groupIdx: number) => {
      const newCondition = cloneCondition(condition);
      newCondition.groups[groupIdx].clauses.push({
        id: `c${Date.now()}`,
        field: '',
        operator: 'equals',
      });
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleAddGroup = useCallback(() => {
    const newCondition = cloneCondition(condition);
    newCondition.groups.push({
      id: `g${Date.now()}`,
      clauses: [{ id: `c${Date.now()}`, field: '', operator: 'equals' }],
      logicalOp: 'AND',
    });
    onChange(newCondition);
  }, [condition, onChange]);

  const handleGroupLogicalOpChange = useCallback((groupIdx: number, logicalOp: LogicalOperator) => {
    const newCondition = cloneCondition(condition);
    newCondition.groups[groupIdx].logicalOp = logicalOp;
    onChange(newCondition);
  }, [condition, onChange]);

  const handleRemoveGroup = useCallback((groupIdx: number) => {
    if (condition.groups.length <= 1) return;
    const newCondition = cloneCondition(condition);
    newCondition.groups.splice(groupIdx, 1);
    onChange(newCondition);
  }, [condition, onChange]);

  const summary = useMemo(() => {
    const groups = condition.groups
      .map(group => {
        const clauses = group.clauses.map(describeClause);
        return clauses.length > 0 ? `(${clauses.join(` ${group.logicalOp} `)})` : '';
      })
      .filter(Boolean);
    return groups.length > 0 ? groups.join(` ${condition.groupLogicalOp} `) : 'Build a predicate by adding one or more conditions.';
  }, [condition]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-[#111426] p-4">
      <div className="rounded-xl border border-blue-500/30 bg-[#0d1830] p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">Logic Summary</div>
        <p className="mt-2 text-[11px] font-mono leading-5 text-slate-100 break-words">
          {summary}
        </p>
      </div>

      <div className="space-y-4">
        {condition.groups.map((group, gIdx) => (
          <div key={group.id} className="rounded-xl border border-slate-700 bg-[#171b31] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Condition Group {gIdx + 1}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Rows in this group are combined with {group.logicalOp}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveGroup(gIdx)}
                disabled={disabled || condition.groups.length <= 1}
                className={`${ACTION_BUTTON_CLASSNAME} border-slate-600 bg-[#111426] text-slate-300 hover:bg-slate-700`}
              >
                Remove Group
              </button>
            </div>

            <div className="space-y-3">
              {group.clauses.map((clause, cIdx) => (
                <div key={clause.id}>
                  {cIdx > 0 && (
                    <div className="my-3 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Within this group
                      </span>
                      <select
                        value={group.logicalOp}
                        onChange={e => handleGroupLogicalOpChange(gIdx, e.target.value as LogicalOperator)}
                        disabled={disabled}
                        className={MINI_SELECT_CLASSNAME}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  <ConditionClauseEditor
                    clause={clause}
                    fields={fields}
                    onChange={newClause => handleClauseChange(gIdx, cIdx, newClause)}
                    onRemove={() => handleClauseRemove(gIdx, cIdx)}
                    disabled={disabled}
                    canRemove={group.clauses.length > 1}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleAddClause(gIdx)}
              disabled={disabled}
              className={`${ACTION_BUTTON_CLASSNAME} mt-3 w-full border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20`}
            >
              Add Condition To This Group
            </button>
          </div>
        ))}
      </div>

      {condition.groups.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-600 bg-[#111426] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Connect Groups
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Across groups use</span>
              <select
                value={condition.groupLogicalOp}
                onChange={e => {
                  const newCondition = { ...condition, groupLogicalOp: e.target.value as LogicalOperator };
                  onChange(newCondition);
                }}
                disabled={disabled}
                className={MINI_SELECT_CLASSNAME}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddGroup}
              disabled={disabled}
              className={`${ACTION_BUTTON_CLASSNAME} w-full border-slate-600 bg-[#1b2342] text-slate-200 hover:bg-[#243059]`}
            >
              Add Another Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Convert ConditionBuilder output to a SQL predicate string.
 */
export function conditionToSQL(condition: ComplexCondition | null, engine: 'spark' | 'postgresql' | 'redshift'): string {
  if (!condition || condition.groups.length === 0) {
    return '1=1';
  }

  const groupSQLs = condition.groups
    .map(group => {
      const clauseSQLs = group.clauses
        .map(clause => {
          if (!clause.field) return null;
          const field = engine === 'spark' ? `\`${clause.field}\`` : `"${clause.field}"`;

          switch (clause.operator) {
            case 'equals':
              return `${field} = ${sqlLiteral(clause.value)}`;
            case 'not_equals':
              return `${field} != ${sqlLiteral(clause.value)}`;
            case 'gt':
              return `${field} > ${sqlLiteral(clause.value)}`;
            case 'gte':
              return `${field} >= ${sqlLiteral(clause.value)}`;
            case 'lt':
              return `${field} < ${sqlLiteral(clause.value)}`;
            case 'lte':
              return `${field} <= ${sqlLiteral(clause.value)}`;
            case 'contains':
              return `${field} LIKE '%${escapeSqlString(clause.value)}%'`;
            case 'starts_with':
              return `${field} LIKE '${escapeSqlString(clause.value)}%'`;
            case 'is_null':
              return `${field} IS NULL`;
            case 'is_not_null':
              return `${field} IS NOT NULL`;
            default:
              return null;
          }
        })
        .filter((sql): sql is string => Boolean(sql));

      if (clauseSQLs.length === 0) return null;
      return `(${clauseSQLs.join(` ${group.logicalOp} `)})`;
    })
    .filter((sql): sql is string => Boolean(sql));

  if (groupSQLs.length === 0) {
    return '1=1';
  }

  return groupSQLs.join(` ${condition.groupLogicalOp} `);
}
