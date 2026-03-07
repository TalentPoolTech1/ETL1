/**
 * Plain-Language Condition Builder Component
 * 
 * Provides a visual, plain-language interface for building conditions
 * without exposing users to SQL syntax. Supports:
 * - Single conditions: Field OP Value
 * - Multi-condition: (Cond1 AND Cond2) OR (Cond3)
 * 
 * Used by if/else and case/when transforms.
 */

import React, { useState, useCallback } from 'react';

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

/**
 * Single condition clause editor
 */
function ConditionClauseEditor({
  clause,
  fields,
  onChange,
  onRemove,
  disabled,
}: {
  clause: ConditionClause;
  fields: Array<{ name: string; type: string }>;
  onChange: (clause: ConditionClause) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 items-end">
      {/* Field selector */}
      <select
        value={clause.field}
        onChange={e =>
          onChange({
            ...clause,
            field: e.target.value,
          })
        }
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="">Select field...</option>
        {fields.map(f => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={clause.operator}
        onChange={e =>
          onChange({
            ...clause,
            operator: e.target.value as ComparisonOperator,
          })
        }
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
      >
        {Object.entries(OPERATORS).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Value input (if operator requires it) */}
      {OPERATORS[clause.operator].requiresValue && (
        <input
          type="text"
          placeholder="value"
          value={clause.value || ''}
          onChange={e =>
            onChange({
              ...clause,
              value: e.target.value,
            })
          }
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50"
      >
        ✕
      </button>
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
  const condition = value || {
    groups: [
      {
        id: 'g1',
        clauses: [{ id: 'c1', field: '', operator: 'equals' }],
        logicalOp: 'AND' as const,
      },
    ],
    groupLogicalOp: 'AND' as const,
  };

  const handleClauseChange = useCallback(
    (groupIdx: number, clauseIdx: number, newClause: ConditionClause) => {
      const newCondition = JSON.parse(JSON.stringify(condition)) as ComplexCondition;
      newCondition.groups[groupIdx].clauses[clauseIdx] = newClause;
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleClauseRemove = useCallback(
    (groupIdx: number, clauseIdx: number) => {
      const newCondition = JSON.parse(JSON.stringify(condition)) as ComplexCondition;
      newCondition.groups[groupIdx].clauses.splice(clauseIdx, 1);
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleAddClause = useCallback(
    (groupIdx: number) => {
      const newCondition = JSON.parse(JSON.stringify(condition)) as ComplexCondition;
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
    const newCondition = JSON.parse(JSON.stringify(condition)) as ComplexCondition;
    newCondition.groups.push({
      id: `g${Date.now()}`,
      clauses: [{ id: `c${Date.now()}`, field: '', operator: 'equals' }],
      logicalOp: 'AND',
    });
    onChange(newCondition);
  }, [condition, onChange]);

  return (
    <div className="space-y-4 p-4 border border-gray-300 rounded-md bg-gray-50">
      {/* Plain-language summary */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-900 font-mono">
          {condition.groups
            .map((group, gIdx) => {
              const clauses = group.clauses
                .map(
                  c =>
                    `${c.field} ${OPERATORS[c.operator]?.label || c.operator} ${c.value || ''}`
                )
                .join(` ${group.logicalOp} `);
              return `(${clauses})`;
            })
            .join(` ${condition.groupLogicalOp} `)}
        </p>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {condition.groups.map((group, gIdx) => (
          <div key={group.id} className="space-y-2 p-3 border border-gray-200 rounded-md bg-white">
            <div className="space-y-2">
              {group.clauses.map((clause, cIdx) => (
                <div key={clause.id}>
                  {cIdx > 0 && (
                    <div className="flex items-center my-2">
                      <select
                        value={group.logicalOp}
                        onChange={e => {
                          const newCondition = JSON.parse(JSON.stringify(condition));
                          newCondition.groups[gIdx].logicalOp = e.target.value;
                          onChange(newCondition);
                        }}
                        disabled={disabled}
                        className="px-3 py-1 bg-gray-100 border-0 rounded text-sm"
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
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => handleAddClause(gIdx)}
              disabled={disabled}
              className="text-sm px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              + Add condition in this group
            </button>
          </div>
        ))}
      </div>

      {/* Add group button */}
      {condition.groups.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={condition.groupLogicalOp}
            onChange={e => {
              const newCondition = { ...condition, groupLogicalOp: e.target.value as LogicalOperator };
              onChange(newCondition);
            }}
            disabled={disabled}
            className="px-3 py-1 bg-gray-100 border-0 rounded text-sm"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <button
            onClick={handleAddGroup}
            disabled={disabled}
            className="text-sm px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50"
          >
            + Add group of conditions
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Convert ConditionBuilder output to SQL WHERE clause
 */
export function conditionToSQL(condition: ComplexCondition | null, engine: 'spark' | 'postgresql' | 'redshift'): string {
  if (!condition || condition.groups.length === 0) {
    return '1=1';
  }

  const groupSQLs = condition.groups.map(group => {
    const clauseSQLs = group.clauses.map(clause => {
      const field = engine === 'spark' ? `\`${clause.field}\`` : `"${clause.field}"`;

      switch (clause.operator) {
        case 'equals':
          return `${field} = '${clause.value}'`;
        case 'not_equals':
          return `${field} != '${clause.value}'`;
        case 'gt':
          return `${field} > ${clause.value}`;
        case 'gte':
          return `${field} >= ${clause.value}`;
        case 'lt':
          return `${field} < ${clause.value}`;
        case 'lte':
          return `${field} <= ${clause.value}`;
        case 'contains':
          return `${field} LIKE '%${clause.value}%'`;
        case 'starts_with':
          return `${field} LIKE '${clause.value}%'`;
        case 'is_null':
          return `${field} IS NULL`;
        case 'is_not_null':
          return `${field} IS NOT NULL`;
        default:
          return '1=1';
      }
    });

    return `(${clauseSQLs.join(` ${group.logicalOp} `)})`;
  });

  return groupSQLs.join(` ${condition.groupLogicalOp} `);
}
