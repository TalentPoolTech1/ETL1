import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Transformation Builder
 *
 * Interactive UI for designing Spark transformations with live SQL preview,
 * column mapping, and result simulation.
 */
import { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { transformNodeValidations } from '@/validators/ValidationRules';
export function TransformationBuilder({ inputColumns, outputColumns, currentExpression, currentMappings, onExpressionChange, onMappingsChange, onTest, testResults, }) {
    const [activeTab, setActiveTab] = useState('sql');
    const [selectedColumn, setSelectedColumn] = useState(null);
    const [aggregations, setAggregations] = useState({});
    // Validate SQL expression
    const validationResult = useMemo(() => {
        if (!currentExpression?.trim()) {
            return { valid: true, errors: [] };
        }
        const exprValidation = transformNodeValidations.sqlSyntax(currentExpression);
        return exprValidation;
    }, [currentExpression]);
    // Column statistics for preview
    const columnStats = useMemo(() => {
        if (!testResults?.results)
            return {};
        return testResults.results.reduce((acc, row) => {
            Object.keys(row).forEach(col => {
                if (!acc[col]) {
                    acc[col] = { count: 0, nullCount: 0, sampleValues: new Set() };
                }
                acc[col].count++;
                if (row[col] === null || row[col] === undefined) {
                    acc[col].nullCount++;
                }
                else {
                    if (acc[col].sampleValues.size < 3) {
                        acc[col].sampleValues.add(row[col]);
                    }
                }
            });
            return acc;
        }, {});
    }, [testResults]);
    const handleAddMapping = (sourceCol) => {
        const newMapping = {
            source: sourceCol,
            target: sourceCol.name,
            aggregation: 'none',
        };
        onMappingsChange([...currentMappings, newMapping]);
    };
    const handleRemoveMapping = (sourceName) => {
        onMappingsChange(currentMappings.filter(m => m.source.name !== sourceName));
    };
    const handleUpdateMapping = (sourceName, field, value) => {
        onMappingsChange(currentMappings.map(m => m.source.name === sourceName ? { ...m, [field]: value } : m));
    };
    const generateSQLPreview = () => {
        if (currentMappings.length === 0)
            return '';
        const selectClauses = currentMappings.map(m => {
            const expr = m.aggregation !== 'none' ? `${m.aggregation}(${m.source.name})` : m.source.name;
            return `  ${expr} AS ${m.target}`;
        });
        const groupBy = currentMappings.some(m => m.aggregation !== 'none') &&
            currentMappings.filter(m => m.aggregation === 'none').length > 0
            ? `\nGROUP BY ${currentMappings
                .filter(m => m.aggregation === 'none')
                .map(m => m.source.name)
                .join(', ')}`
            : '';
        return `SELECT\n${selectClauses.join(',\n')}\nFROM source_table${groupBy}${currentExpression ? `\nWHERE ${currentExpression}` : ''}`;
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex gap-2 border-b border-neutral-200", children: ['sql', 'mapping', 'preview'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-neutral-600 hover:text-neutral-900'}`, children: tab === 'sql'
                        ? '📋 SQL Filter'
                        : tab === 'mapping'
                            ? '🔄 Column Mapping'
                            : '👁️ Preview' }, tab))) }), activeTab === 'sql' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("p", { className: "text-sm text-neutral-600", children: ["Define WHERE clause to filter rows. Columns referenced as ", '{column_name}'] }), _jsx("div", { className: "border border-neutral-300 rounded-md overflow-hidden", children: _jsx(Editor, { height: "300px", language: "sql", value: currentExpression, onChange: value => onExpressionChange(value || ''), theme: "light", options: {
                                minimap: { enabled: false },
                                fontSize: 12,
                                lineNumbers: 'off',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                            } }) }), !validationResult.valid && (_jsx(Alert, { variant: "warning", children: _jsx("p", { className: "text-sm", children: validationResult.errors[0]?.message }) })), validationResult.valid && currentExpression && (_jsx("div", { className: "p-2 bg-success-50 border border-success-200 rounded-md", children: _jsx("p", { className: "text-xs text-success-800", children: "\u2713 Valid SQL expression" }) }))] })), activeTab === 'mapping' && (_jsx("div", { className: "space-y-3", children: _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-900 mb-2", children: "Input Columns" }), _jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto border border-neutral-200 rounded-md p-2 bg-neutral-50", children: inputColumns.map(col => (_jsxs("div", { className: "flex justify-between items-center p-2 bg-white border border-neutral-200 rounded-md hover:border-primary-300", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-mono text-neutral-900", children: col.name }), _jsx("p", { className: "text-xs text-neutral-500", children: col.type })] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => handleAddMapping(col), disabled: currentMappings.some(m => m.source.name === col.name), children: "+" })] }, col.name))) })] }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium text-neutral-900 mb-2", children: ["Output Mapping (", currentMappings.length, ")"] }), _jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto border border-neutral-200 rounded-md p-2 bg-neutral-50", children: currentMappings.length === 0 ? (_jsx("p", { className: "text-xs text-neutral-500 italic", children: "No mappings. Click + to add." })) : (currentMappings.map(mapping => (_jsxs("div", { onClick: () => setSelectedColumn(mapping), className: `p-2 rounded-md border cursor-pointer transition-colors ${selectedColumn?.source.name === mapping.source.name
                                            ? 'bg-primary-50 border-primary-300'
                                            : 'bg-white border-neutral-200 hover:border-primary-300'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("p", { className: "text-xs font-mono text-neutral-900", children: mapping.source.name }), _jsx(Button, { size: "sm", variant: "ghost", onClick: e => {
                                                            e.stopPropagation();
                                                            handleRemoveMapping(mapping.source.name);
                                                        }, children: "\u2715" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-neutral-500", children: "\u2192" }), _jsx("input", { type: "text", value: mapping.target, onChange: e => handleUpdateMapping(mapping.source.name, 'target', e.target.value), className: "flex-1 px-2 py-1 text-xs border border-neutral-200 rounded-md", onClick: e => e.stopPropagation() })] }), selectedColumn?.source.name === mapping.source.name && (_jsxs("div", { className: "mt-2 pt-2 border-t border-neutral-200", children: [_jsx("label", { className: "text-xs font-medium text-neutral-700 block mb-1", children: "Aggregation" }), _jsxs("select", { value: mapping.aggregation || 'none', onChange: e => handleUpdateMapping(mapping.source.name, 'aggregation', e.target.value), className: "w-full px-2 py-1 text-xs border border-neutral-200 rounded-md", children: [_jsx("option", { value: "none", children: "None" }), _jsx("option", { value: "sum", children: "Sum" }), _jsx("option", { value: "count", children: "Count" }), _jsx("option", { value: "avg", children: "Average" }), _jsx("option", { value: "max", children: "Max" }), _jsx("option", { value: "min", children: "Min" }), _jsx("option", { value: "collect_list", children: "Collect List" })] })] }))] }, mapping.source.name)))) })] })] }) })), activeTab === 'preview' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-900 mb-2", children: "Generated SQL" }), _jsx("div", { className: "p-3 bg-neutral-50 border border-neutral-200 rounded-md", children: _jsx("pre", { className: "text-xs font-mono text-neutral-800 whitespace-pre-wrap", children: generateSQLPreview() || '(No SQL generated yet)' }) })] }), testResults && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-medium text-neutral-900", children: "Test Results" }), _jsx(Badge, { variant: testResults?.success ? 'success' : 'danger', children: testResults?.success ? 'Passed' : 'Failed' })] }), testResults?.results && (_jsxs("div", { className: "p-3 bg-neutral-50 border border-neutral-200 rounded-md", children: [_jsxs("p", { className: "text-xs text-neutral-600 mb-2", children: [_jsx("span", { className: "font-medium", children: testResults.results.length }), " rows processed"] }), _jsx("div", { className: "space-y-1", children: Object.entries(columnStats).map(([colName, stats]) => (_jsxs("div", { className: "text-xs", children: [_jsx("p", { className: "font-mono text-neutral-700", children: colName }), _jsxs("p", { className: "text-neutral-500", children: [stats.count, " rows, ", stats.nullCount, " nulls"] })] }, colName))) })] }))] })), _jsx(Button, { onClick: onTest, className: "w-full", size: "sm", children: "\u25B6\uFE0F Test Transformation" })] }))] }));
}
