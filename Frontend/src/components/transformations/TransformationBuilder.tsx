/**
 * Transformation Builder
 * 
 * Interactive UI for designing Spark transformations with live SQL preview,
 * column mapping, and result simulation.
 */

import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { transformNodeValidations } from '@/validators/ValidationRules';

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
}

interface ColumnTransform {
  source: Column;
  target: string;
  expression?: string;
  aggregation?: 'none' | 'sum' | 'count' | 'avg' | 'max' | 'min' | 'collect_list';
}

interface TransformationBuilderProps {
  inputColumns: Column[];
  outputColumns: Column[];
  currentExpression: string;
  currentMappings: ColumnTransform[];
  onExpressionChange: (expr: string) => void;
  onMappingsChange: (mappings: ColumnTransform[]) => void;
  onTest: () => void;
  testResults?: any;
}

export function TransformationBuilder({
  inputColumns,
  outputColumns,
  currentExpression,
  currentMappings,
  onExpressionChange,
  onMappingsChange,
  onTest,
  testResults,
}: TransformationBuilderProps) {
  const [activeTab, setActiveTab] = useState<'sql' | 'mapping' | 'preview'>('sql');
  const [selectedColumn, setSelectedColumn] = useState<ColumnTransform | null>(null);
  const [aggregations, setAggregations] = useState<Record<string, string>>({});

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
    if (!testResults?.results) return {};
    return testResults.results.reduce(
      (acc: any, row: any) => {
        Object.keys(row).forEach(col => {
          if (!acc[col]) {
            acc[col] = { count: 0, nullCount: 0, sampleValues: new Set() };
          }
          acc[col].count++;
          if (row[col] === null || row[col] === undefined) {
            acc[col].nullCount++;
          } else {
            if (acc[col].sampleValues.size < 3) {
              acc[col].sampleValues.add(row[col]);
            }
          }
        });
        return acc;
      },
      {} as Record<string, any>
    );
  }, [testResults]);

  const handleAddMapping = (sourceCol: Column) => {
    const newMapping: ColumnTransform = {
      source: sourceCol,
      target: sourceCol.name,
      aggregation: 'none',
    };
    onMappingsChange([...currentMappings, newMapping]);
  };

  const handleRemoveMapping = (sourceName: string) => {
    onMappingsChange(currentMappings.filter(m => m.source.name !== sourceName));
  };

  const handleUpdateMapping = (sourceName: string, field: string, value: any) => {
    onMappingsChange(
      currentMappings.map(m =>
        m.source.name === sourceName ? { ...m, [field]: value } : m
      )
    );
  };

  const generateSQLPreview = () => {
    if (currentMappings.length === 0) return '';

    const selectClauses = currentMappings.map(m => {
      const expr = m.aggregation !== 'none' ? `${m.aggregation}(${m.source.name})` : m.source.name;
      return `  ${expr} AS ${m.target}`;
    });

    const groupBy =
      currentMappings.some(m => m.aggregation !== 'none') &&
      currentMappings.filter(m => m.aggregation === 'none').length > 0
        ? `\nGROUP BY ${currentMappings
            .filter(m => m.aggregation === 'none')
            .map(m => m.source.name)
            .join(', ')}`
        : '';

    return `SELECT\n${selectClauses.join(',\n')}\nFROM source_table${groupBy}${
      currentExpression ? `\nWHERE ${currentExpression}` : ''
    }`;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {['sql', 'mapping', 'preview'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab === 'sql'
              ? '📋 SQL Filter'
              : tab === 'mapping'
                ? '🔄 Column Mapping'
                : '👁️ Preview'}
          </button>
        ))}
      </div>

      {/* SQL Editor Tab */}
      {activeTab === 'sql' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Define WHERE clause to filter rows. Columns referenced as {'{column_name}'}
          </p>

          <div className="border border-slate-700 rounded-md overflow-hidden">
            <Editor
              height="300px"
              language="sql"
              value={currentExpression}
              onChange={value => onExpressionChange(value || '')}
              theme="light"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>

          {!validationResult.valid && (
            <Alert variant="warning">
              <p className="text-sm">{validationResult.errors[0]?.message}</p>
            </Alert>
          )}

          {validationResult.valid && currentExpression && (
            <div className="p-2 bg-success-50 border border-success-200 rounded-md">
              <p className="text-xs text-success-800">✓ Valid SQL expression</p>
            </div>
          )}
        </div>
      )}

      {/* Column Mapping Tab */}
      {activeTab === 'mapping' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Available Input Columns */}
            <div>
              <p className="text-sm font-medium text-neutral-900 mb-2">Input Columns</p>
              <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-800 rounded-md p-2 bg-neutral-50">
                {inputColumns.map(col => (
                  <div
                    key={col.name}
                    className="flex justify-between items-center p-2 bg-[#161b25] border border-slate-800 rounded-md hover:border-primary-300"
                  >
                    <div>
                      <p className="text-xs font-mono text-neutral-900">{col.name}</p>
                      <p className="text-xs text-neutral-500">{col.type}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddMapping(col)}
                      disabled={currentMappings.some(m => m.source.name === col.name)}
                    >
                      +
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Configured Mappings */}
            <div>
              <p className="text-sm font-medium text-neutral-900 mb-2">
                Output Mapping ({currentMappings.length})
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-800 rounded-md p-2 bg-neutral-50">
                {currentMappings.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">No mappings. Click + to add.</p>
                ) : (
                  currentMappings.map(mapping => (
                    <div
                      key={mapping.source.name}
                      onClick={() => setSelectedColumn(mapping)}
                      className={`p-2 rounded-md border cursor-pointer transition-colors ${
                        selectedColumn?.source.name === mapping.source.name
                          ? 'bg-primary-50 border-primary-300'
                          : 'bg-[#161b25] border-slate-800 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-mono text-neutral-900">{mapping.source.name}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveMapping(mapping.source.name);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">→</span>
                        <input
                          type="text"
                          value={mapping.target}
                          onChange={e =>
                            handleUpdateMapping(mapping.source.name, 'target', e.target.value)
                          }
                          className="flex-1 px-2 py-1 text-xs border border-slate-800 rounded-md"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      {selectedColumn?.source.name === mapping.source.name && (
                        <div className="mt-2 pt-2 border-t border-slate-800">
                          <label className="text-xs font-medium text-neutral-700 block mb-1">
                            Aggregation
                          </label>
                          <select
                            value={mapping.aggregation || 'none'}
                            onChange={e =>
                              handleUpdateMapping(
                                mapping.source.name,
                                'aggregation',
                                e.target.value
                              )
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-800 rounded-md"
                          >
                            <option value="none">None</option>
                            <option value="sum">Sum</option>
                            <option value="count">Count</option>
                            <option value="avg">Average</option>
                            <option value="max">Max</option>
                            <option value="min">Min</option>
                            <option value="collect_list">Collect List</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-neutral-900 mb-2">Generated SQL</p>
            <div className="p-3 bg-neutral-50 border border-slate-800 rounded-md">
              <pre className="text-xs font-mono text-neutral-800 whitespace-pre-wrap">
                {generateSQLPreview() || '(No SQL generated yet)'}
              </pre>
            </div>
          </div>

          {testResults && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-900">Test Results</p>
                <Badge variant={testResults?.success ? 'success' : 'danger'}>
                  {testResults?.success ? 'Passed' : 'Failed'}
                </Badge>
              </div>

              {testResults?.results && (
                <div className="p-3 bg-neutral-50 border border-slate-800 rounded-md">
                  <p className="text-xs text-neutral-600 mb-2">
                    <span className="font-medium">{testResults.results.length}</span> rows
                    processed
                  </p>
                  <div className="space-y-1">
                    {Object.entries(columnStats).map(([colName, stats]: any) => (
                      <div key={colName} className="text-xs">
                        <p className="font-mono text-neutral-700">{colName}</p>
                        <p className="text-neutral-500">
                          {stats.count} rows, {stats.nullCount} nulls
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button onClick={onTest} className="w-full" size="sm">
            ▶️ Test Transformation
          </Button>
        </div>
      )}
    </div>
  );
}
