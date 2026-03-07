import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateNode } from '@/store/slices/pipelineSlice';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { validateNode } from '@/utils/nodeValidator';
import type { NodeValidationResult, NodeConfig } from '@/utils/nodeValidator';
import { MultiTransformEditor } from '@/components/transformations/MultiTransformEditor';
import type { TransformSequence } from '@/transformations';

interface ColumnMapping {
  source: string;
  target: string;
  type?: string;
}

type Section = 'overview' | 'configuration' | 'schema' | 'advanced' | 'permissions' | 'history';

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const { selectedNodeIds, nodes, activePipeline } = useAppSelector(state => state.pipeline);
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  // Get selected node (single select for now)
  const selectedNodeId = selectedNodeIds[0];
  const selectedNode = selectedNodeId
    ? (nodes[selectedNodeId] as any as NodeConfig)
    : null;

  // Validate selected node
  const validationResult = useMemo<NodeValidationResult | null>(() => {
    if (!selectedNode) return null;
    return validateNode({
      id: selectedNode.id,
      name: selectedNode.name,
      type: selectedNode.type as 'source' | 'transform' | 'target',
      x: selectedNode.x,
      y: selectedNode.y,
      config: selectedNode.config || {},
    });
  }, [selectedNode]);

  // Count errors per section
  const sectionErrorCounts = useMemo(() => {
    if (!validationResult) return {};

    return {
      overview: (
        (validationResult.fieldErrors['name']?.length || 0) as number
      ),
      configuration: (
        ((validationResult.fieldErrors['connectionId']?.length || 0) +
          (validationResult.fieldErrors['schema']?.length || 0) +
          (validationResult.fieldErrors['table']?.length || 0) +
          (validationResult.fieldErrors['expression']?.length || 0) +
          (validationResult.fieldErrors['writeMode']?.length || 0)) as number
      ),
      schema: (
        (validationResult.fieldErrors['columnMappings']?.length || 0) as number
      ),
      advanced: 0,
      permissions: 0,
      history: 0,
    };
  }, [validationResult]);


  if (!selectedNode) {
    return (
      <aside className="w-90 bg-white border-l border-neutral-200 flex flex-col p-4">
        <p className="text-center text-neutral-500 text-sm">
          Select a node to edit properties
        </p>
      </aside>
    );
  }

  const handleUpdateNode = (key: string, value: any) => {
    dispatch(
      updateNode({
        id: selectedNode.id,
        config: {
          ...selectedNode.config,
          [key]: value,
        },
      })
    );
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      handleUpdateNode('expression', value);
    }
  };

  const handleTestTransform = async () => {
    // Check if expression is provided before testing
    if (!selectedNode.config.expression?.trim()) {
      setTestResults({
        error: 'Expression is required to test the transform',
      });
      return;
    }

    // Simulate running the transform on sample data
    setTestResults({
      rowsProcessed: 100,
      rowsSuccess: 98,
      rowsError: 2,
      executionTime: 245,
      sampleRows: [
        { input_col: 'value1', output_col: 'TRANSFORMED_1' },
        { input_col: 'value2', output_col: 'TRANSFORMED_2' },
      ],
    });
  };

  const handleColumnDragStart = (source: string) => {
    setIsDragging(source);
  };

  const handleColumnDrop = (target: string) => {
    if (isDragging) {
      const existing = columnMappings.find(m => m.source === isDragging);
      if (existing) {
        setColumnMappings(
          columnMappings.map(m =>
            m.source === isDragging ? { ...m, target } : m
          )
        );
      } else {
        setColumnMappings([...columnMappings, { source: isDragging, target }]);
      }
      setIsDragging(null);
    }
  };

  // Sections
  const sections = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'configuration', label: '⚙️ Config' },
    { id: 'schema', label: '📊 Schema' },
    { id: 'advanced', label: '🔧 Advanced' },
    { id: 'permissions', label: '🔒 Perms' },
    { id: 'history', label: '📜 History' },
  ] as const;

  return (
    <aside className="w-90 bg-white border-l border-neutral-200 flex flex-col h-full overflow-hidden">
      {/* Section Tabs - Sticky */}
      <div className="sticky top-0 bg-white border-b border-neutral-200 flex gap-1 px-2 py-2 overflow-x-auto">
        {sections.map(section => {
          const errorCount = sectionErrorCounts[section.id];
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as Section)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1
                ${
                  activeSection === section.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }
              `}
            >
              {section.label}
              {errorCount ? (
                <Badge variant="danger" size="sm">
                  {errorCount}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Global validation summary */}
        {validationResult && !validationResult.isValid && (
          <Alert
            variant="warning"
            onClose={() => {
              /* no-op for persistent alert */
            }}
          >
            <div>
              <p className="font-medium">
                {Object.keys(validationResult.fieldErrors).length} validation
                error(s)
              </p>
              <p className="text-sm mt-1">{validationResult.summary}</p>
            </div>
          </Alert>
        )}
        {/* OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              Node Details
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-neutral-700">
                  Node Name
                </label>
                {validationResult?.fieldErrors['name'] && (
                  <span className="text-xs text-danger-600">
                    {validationResult.fieldErrors['name'][0].code}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={selectedNode.name}
                onChange={e =>
                  dispatch(
                    updateNode({ id: selectedNode.id, name: e.target.value })
                  )
                }
                className={`
                  w-full px-3 py-2 rounded-md text-sm
                  ${
                    validationResult?.fieldErrors['name']
                      ? 'border border-danger-300 bg-danger-50'
                      : 'border border-neutral-300'
                  }
                `}
              />
              {validationResult?.fieldErrors['name']?.[0] && (
                <p className="text-xs text-danger-600 mt-1">
                  {validationResult.fieldErrors['name'][0].message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Type
              </label>
              <div className="mt-1 px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200 text-sm text-neutral-600">
                {selectedNode.type.charAt(0).toUpperCase() +
                  selectedNode.type.slice(1)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-neutral-600">Position X</p>
                <p className="font-mono text-neutral-900">{selectedNode.x}</p>
              </div>
              <div>
                <p className="text-neutral-600">Position Y</p>
                <p className="font-mono text-neutral-900">{selectedNode.y}</p>
              </div>
              <div>
                <p className="text-neutral-600">Version</p>
                <p className="font-mono text-neutral-900">
                  {selectedNode.version}
                </p>
              </div>
              <div>
                <p className="text-neutral-600">Inputs</p>
                <p className="font-mono text-neutral-900">
                  {selectedNode.inputs?.length || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CONFIGURATION SECTION */}
        {activeSection === 'configuration' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              Configuration
            </h3>

            {selectedNode.type === 'source' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Connection
                    </label>
                    {validationResult?.fieldErrors['connectionId'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <select
                    value={selectedNode.config.connectionId || ''}
                    onChange={e =>
                      handleUpdateNode('connectionId', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['connectionId']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  >
                    <option value="">Select connection...</option>
                    <option value="pg1">Postgres DB</option>
                    <option value="s3">AWS S3</option>
                    <option value="sf">Snowflake</option>
                  </select>
                  {validationResult?.fieldErrors['connectionId']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {
                        validationResult.fieldErrors['connectionId'][0]
                          .message
                      }
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Schema
                    </label>
                    {validationResult?.fieldErrors['schema'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="public"
                    value={selectedNode.config.schema || ''}
                    onChange={e =>
                      handleUpdateNode('schema', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['schema']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  />
                  {validationResult?.fieldErrors['schema']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {validationResult.fieldErrors['schema'][0].message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Table
                    </label>
                    {validationResult?.fieldErrors['table'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="users"
                    value={selectedNode.config.table || ''}
                    onChange={e =>
                      handleUpdateNode('table', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['table']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  />
                  {validationResult?.fieldErrors['table']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {validationResult.fieldErrors['table'][0].message}
                    </p>
                  )}
                </div>
              </>
            )}

            {selectedNode.type === 'transform' && (
              <MultiTransformEditor
                columnId={selectedNode.id}
                columnName={selectedNode.name}
                pipelineId={activePipeline?.id ?? ''}
                datasetId={selectedNode.id}
                defaultEngine="spark"
                initialSequence={selectedNode.config.transformSequences?.[0] as TransformSequence | undefined}
                onSave={async (sequence: TransformSequence) => {
                  dispatch(
                    updateNode({
                      id: selectedNode.id,
                      config: {
                        ...selectedNode.config,
                        transformSequences: [sequence],
                      },
                    })
                  );
                }}
              />
            )}

            {(selectedNode.type as string) === 'filter' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Filter Expression
                    </label>
                    {validationResult?.fieldErrors['expression'] && (
                      <span className="text-xs text-danger-600">
                        {validationResult.fieldErrors['expression'].length} error
                        {validationResult.fieldErrors['expression'].length > 1
                          ? 's'
                          : ''}
                      </span>
                    )}
                  </div>
                  <div
                    className={`border rounded-md overflow-hidden ${
                      validationResult?.fieldErrors['expression']
                        ? 'border-danger-300'
                        : 'border-neutral-300'
                    }`}
                  >
                    <Editor
                      height="200px"
                      language="sql"
                      value={selectedNode.config.expression || ''}
                      onChange={handleEditorChange}
                      theme="light"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                  {validationResult?.fieldErrors['expression']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {validationResult.fieldErrors['expression'][0].message}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 mt-1">
                    SQL WHERE clause — reference columns by name
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleTestTransform}
                  className="w-full"
                  disabled={
                    !selectedNode.config.expression?.trim() ||
                    !validationResult?.isValid
                  }
                >
                  Test Filter
                </Button>

                {testResults && (
                  <div
                    className={`border rounded-md p-2 ${
                      testResults.error
                        ? 'bg-danger-50 border-danger-200'
                        : 'bg-success-50 border-success-200'
                    }`}
                  >
                    <p
                      className={`text-xs font-medium ${
                        testResults.error
                          ? 'text-danger-900'
                          : 'text-success-900'
                      }`}
                    >
                      {testResults.error ? 'Error' : 'Test Results'}
                    </p>
                    <div
                      className={`mt-1 space-y-1 text-xs ${
                        testResults.error
                          ? 'text-danger-800'
                          : 'text-success-800'
                      }`}
                    >
                      {testResults.error ? (
                        <p>{testResults.error}</p>
                      ) : (
                        <>
                          <p>{testResults.rowsSuccess} rows passed</p>
                          <p>{testResults.rowsError} rows filtered</p>
                          <p>{testResults.executionTime}ms</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedNode.type === 'target' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Connection
                    </label>
                    {validationResult?.fieldErrors['connectionId'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <select
                    value={selectedNode.config.connectionId || ''}
                    onChange={e =>
                      handleUpdateNode('connectionId', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['connectionId']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  >
                    <option value="">Select connection...</option>
                    <option value="pg1">Postgres DB</option>
                    <option value="sf">Snowflake</option>
                  </select>
                  {validationResult?.fieldErrors['connectionId']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {
                        validationResult.fieldErrors['connectionId'][0]
                          .message
                      }
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Target Table
                    </label>
                    {validationResult?.fieldErrors['table'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="output_table"
                    value={selectedNode.config.table || ''}
                    onChange={e =>
                      handleUpdateNode('table', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['table']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  />
                  {validationResult?.fieldErrors['table']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {validationResult.fieldErrors['table'][0].message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Write Mode
                    </label>
                    {validationResult?.fieldErrors['writeMode'] && (
                      <span className="text-xs text-danger-600">Required</span>
                    )}
                  </div>
                  <select
                    value={selectedNode.config.writeMode || ''}
                    onChange={e =>
                      handleUpdateNode('writeMode', e.target.value)
                    }
                    className={`
                      w-full px-3 py-2 rounded-md text-sm
                      ${
                        validationResult?.fieldErrors['writeMode']
                          ? 'border border-danger-300 bg-danger-50'
                          : 'border border-neutral-300'
                      }
                    `}
                  >
                    <option value="">Select write mode...</option>
                    <option value="OVERWRITE">Overwrite</option>
                    <option value="APPEND">Append</option>
                    <option value="MERGE">Merge</option>
                  </select>
                  {validationResult?.fieldErrors['writeMode']?.[0] && (
                    <p className="text-xs text-danger-600 mt-1">
                      {validationResult.fieldErrors['writeMode'][0].message}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SCHEMA MAPPING SECTION */}
        {activeSection === 'schema' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Schema Mapping</h3>

            <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-md border border-neutral-200">
              {/* Source Columns */}
              <div>
                <p className="text-xs font-semibold text-neutral-700 mb-2">Source</p>
                <div className="space-y-1">
                  {['user_id', 'first_name', 'last_name', 'email'].map(col => (
                    <div
                      key={col}
                      draggable
                      onDragStart={() => handleColumnDragStart(col)}
                      className={`
                        px-2 py-1.5 bg-blue-50 border border-blue-300 rounded text-xs cursor-move
                        hover:bg-blue-100 active:opacity-70
                        ${isDragging === col ? 'opacity-50' : ''}
                      `}
                    >
                      {col}
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Columns */}
              <div>
                <p className="text-xs font-semibold text-neutral-700 mb-2">Target</p>
                <div className="space-y-1">
                  {['user_id', 'fname', 'lname', 'email_address'].map(col => (
                    <div
                      key={col}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleColumnDrop(col)}
                      className="px-2 py-1.5 bg-green-50 border border-green-300 rounded text-xs min-h-8 flex items-center cursor-drop"
                    >
                      {columnMappings.find(m => m.target === col)?.source || (
                        <span className="text-neutral-400">Drop here</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {columnMappings.length > 0 && (
              <div className="bg-primary-50 border border-primary-200 rounded-md p-2">
                <p className="text-xs font-medium text-primary-900 mb-1">Mappings ({columnMappings.length})</p>
                <div className="space-y-1">
                  {columnMappings.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-xs text-primary-800">
                      <span className="font-mono">{m.source}</span>
                      <span>→</span>
                      <span className="font-mono">{m.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADVANCED SECTION */}
        {activeSection === 'advanced' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Advanced Settings</h3>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={selectedNode.config.cacheResults || false}
                  onChange={e => handleUpdateNode('cacheResults', e.target.checked)}
                />
                <span className="text-sm text-neutral-700">Cache Results</span>
              </label>
              <p className="text-xs text-neutral-500 ml-6 mt-1">
                Reuse computed output across multiple runs
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">Partition Key</label>
              <input
                type="text"
                placeholder="Optional"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              />
              <p className="text-xs text-neutral-500 mt-1">For better parallelization</p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">Resource Hints</label>
              <input
                type="text"
                placeholder="e.g. large, gpu, memory_intensive"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}

        {/* PERMISSIONS SECTION */}
        {activeSection === 'permissions' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Permissions</h3>

            <div>
              <p className="text-xs font-medium text-neutral-700 mb-2">Owner</p>
              <div className="px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200 text-sm text-neutral-600">
                you@company.com
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-neutral-700 mb-2">Shared With</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200">
                  <span className="text-sm text-neutral-700">data-team@company.com</span>
                  <button className="text-xs text-danger-600 hover:text-danger-700">Remove</button>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="w-full mt-2">
                + Share
              </Button>
            </div>
          </div>
        )}

        {/* HISTORY SECTION */}
        {activeSection === 'history' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Change History</h3>

            <div className="space-y-2 text-xs">
              <div className="border-l-2 border-primary-300 pl-3 py-2">
                <p className="font-medium text-neutral-900">Updated configuration</p>
                <p className="text-neutral-500">by you@company.com</p>
                <p className="text-neutral-400 text-xs mt-1">2 minutes ago</p>
              </div>

              <div className="border-l-2 border-neutral-300 pl-3 py-2">
                <p className="font-medium text-neutral-900">Created node</p>
                <p className="text-neutral-500">by you@company.com</p>
                <p className="text-neutral-400 text-xs mt-1">30 minutes ago</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
