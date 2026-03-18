import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback } from 'react';
const OPERATORS = {
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
function ConditionClauseEditor({ clause, fields, onChange, onRemove, disabled, }) {
    return (_jsxs("div", { className: "flex gap-2 items-end", children: [_jsxs("select", { value: clause.field, onChange: e => onChange({
                    ...clause,
                    field: e.target.value,
                }), disabled: disabled, className: "flex-1 px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "", children: "Select field..." }), fields.map(f => (_jsx("option", { value: f.name, children: f.name }, f.name)))] }), _jsx("select", { value: clause.operator, onChange: e => onChange({
                    ...clause,
                    operator: e.target.value,
                }), disabled: disabled, className: "flex-1 px-3 py-2 border border-gray-300 rounded-md", children: Object.entries(OPERATORS).map(([key, { label }]) => (_jsx("option", { value: key, children: label }, key))) }), OPERATORS[clause.operator].requiresValue && (_jsx("input", { type: "text", placeholder: "value", value: clause.value || '', onChange: e => onChange({
                    ...clause,
                    value: e.target.value,
                }), disabled: disabled, className: "flex-1 px-3 py-2 border border-gray-300 rounded-md" })), _jsx("button", { onClick: onRemove, disabled: disabled, className: "px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50", children: "\u2715" })] }));
}
/**
 * Main Condition Builder Component
 */
export const ConditionBuilder = ({ value, onChange, fields, disabled, }) => {
    const condition = value || {
        groups: [
            {
                id: 'g1',
                clauses: [{ id: 'c1', field: '', operator: 'equals' }],
                logicalOp: 'AND',
            },
        ],
        groupLogicalOp: 'AND',
    };
    const handleClauseChange = useCallback((groupIdx, clauseIdx, newClause) => {
        const newCondition = JSON.parse(JSON.stringify(condition));
        newCondition.groups[groupIdx].clauses[clauseIdx] = newClause;
        onChange(newCondition);
    }, [condition, onChange]);
    const handleClauseRemove = useCallback((groupIdx, clauseIdx) => {
        const newCondition = JSON.parse(JSON.stringify(condition));
        newCondition.groups[groupIdx].clauses.splice(clauseIdx, 1);
        onChange(newCondition);
    }, [condition, onChange]);
    const handleAddClause = useCallback((groupIdx) => {
        const newCondition = JSON.parse(JSON.stringify(condition));
        newCondition.groups[groupIdx].clauses.push({
            id: `c${Date.now()}`,
            field: '',
            operator: 'equals',
        });
        onChange(newCondition);
    }, [condition, onChange]);
    const handleAddGroup = useCallback(() => {
        const newCondition = JSON.parse(JSON.stringify(condition));
        newCondition.groups.push({
            id: `g${Date.now()}`,
            clauses: [{ id: `c${Date.now()}`, field: '', operator: 'equals' }],
            logicalOp: 'AND',
        });
        onChange(newCondition);
    }, [condition, onChange]);
    return (_jsxs("div", { className: "space-y-4 p-4 border border-gray-300 rounded-md bg-gray-50", children: [_jsx("div", { className: "p-3 bg-blue-50 border border-blue-200 rounded-md", children: _jsx("p", { className: "text-sm text-blue-900 font-mono", children: condition.groups
                        .map((group, gIdx) => {
                        const clauses = group.clauses
                            .map(c => `${c.field} ${OPERATORS[c.operator]?.label || c.operator} ${c.value || ''}`)
                            .join(` ${group.logicalOp} `);
                        return `(${clauses})`;
                    })
                        .join(` ${condition.groupLogicalOp} `) }) }), _jsx("div", { className: "space-y-4", children: condition.groups.map((group, gIdx) => (_jsxs("div", { className: "space-y-2 p-3 border border-gray-200 rounded-md bg-white", children: [_jsx("div", { className: "space-y-2", children: group.clauses.map((clause, cIdx) => (_jsxs("div", { children: [cIdx > 0 && (_jsx("div", { className: "flex items-center my-2", children: _jsxs("select", { value: group.logicalOp, onChange: e => {
                                                const newCondition = JSON.parse(JSON.stringify(condition));
                                                newCondition.groups[gIdx].logicalOp = e.target.value;
                                                onChange(newCondition);
                                            }, disabled: disabled, className: "px-3 py-1 bg-gray-100 border-0 rounded text-sm", children: [_jsx("option", { value: "AND", children: "AND" }), _jsx("option", { value: "OR", children: "OR" })] }) })), _jsx(ConditionClauseEditor, { clause: clause, fields: fields, onChange: newClause => handleClauseChange(gIdx, cIdx, newClause), onRemove: () => handleClauseRemove(gIdx, cIdx), disabled: disabled })] }, clause.id))) }), _jsx("button", { onClick: () => handleAddClause(gIdx), disabled: disabled, className: "text-sm px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-50", children: "+ Add condition in this group" })] }, group.id))) }), condition.groups.length > 0 && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { value: condition.groupLogicalOp, onChange: e => {
                            const newCondition = { ...condition, groupLogicalOp: e.target.value };
                            onChange(newCondition);
                        }, disabled: disabled, className: "px-3 py-1 bg-gray-100 border-0 rounded text-sm", children: [_jsx("option", { value: "AND", children: "AND" }), _jsx("option", { value: "OR", children: "OR" })] }), _jsx("button", { onClick: handleAddGroup, disabled: disabled, className: "text-sm px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50", children: "+ Add group of conditions" })] }))] }));
};
/**
 * Convert ConditionBuilder output to SQL WHERE clause
 */
export function conditionToSQL(condition, engine) {
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
