# Architecture Blueprint: Wiring Transformations into Pipeline Editor

This document shows the exact code changes needed to wire transformations, multi-transforms, push-down eligibility, and code generation into a coherent system.

---

## 1. Redux State Schema Update

### Current State (Incomplete)
```typescript
// store/slices/pipelineSlice.ts
interface Node {
  id: string;
  type: 'source' | 'transform' | 'target' | 'join' | 'aggregation' | 'union' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  config: {
    // For source node
    connectionId?: string;
    schema?: string;
    table?: string;
    
    // For transform node (INCOMPLETE)
    expression?: string;                    // WHERE clause
    columnMappings?: ColumnTransform[];
    cacheResults?: boolean;
    
    // ❌ MISSING for multi-transforms:
    // multiTransforms?: Transform[];
    // executionStrategy?: ExecutionStrategy;
    // pushdownEligibility?: EligibilityReport;
  };
}
```

### Required Changes

**File:** `Frontend/src/store/slices/pipelineSlice.ts`

```typescript
// NEW INTERFACES (add to file)

/**
 * Represents a single transformation (can be chained in multiTransforms)
 */
interface Transform {
  id: string;                           // UUID for this transform step
  type: 'filter' | 'column_map' | 'aggregation' | 'custom_sql';
  
  // Filter: WHERE clause
  filter?: {
    expression: string;                 // SQL WHERE clause
  };
  
  // Column Mapping: SELECT, RENAME, AGGREGATE
  columnMapping?: {
    mappings: ColumnTransform[];        // source → target
    aggregations?: AggregationSpec[];
  };
  
  // Custom SQL
  customSql?: {
    sql: string;
    readOnly: boolean;
  };
  
  // Result caching
  cacheResults?: boolean;
  
  // Validation state
  validation?: ValidationResult;
}

/**
 * Execution strategy: where to run the transformations
 */
interface ExecutionStrategy {
  eligibility: 'ELIGIBLE' | 'PARTIAL' | 'NOT_ELIGIBLE';
  executionPoint: 'SOURCE' | 'PYSPARK';      // Where to run
  recommendations: string[];                  // User-facing guidance
  sourceDatabase?: {
    technology: string;                       // Oracle, PostgreSQL, etc.
    version?: string;
  };
}

/**
 * Result from push-down eligibility check
 */
interface EligibilityReport {
  timestamp: string;                          // When checked
  targetTechnology: SourceTechnology;
  functionIds: string[];                      // Functions in transform
  eligible: {
    [functionId: string]: {
      support: SupportLevel;
      syntax?: string;
      alternative?: string;
      note?: string;
    };
  };
  canPushDown: boolean;
  recommendation: string;
}

/**
 * Updated Node interface with multi-transform support
 */
interface Node {
  id: string;
  type: 'source' | 'transform' | 'target' | 'join' | 'aggregation' | 'union' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  config: NodeConfig;
  validation?: ValidationResult;              // NEW: Track validation state
}

type NodeConfig = 
  | SourceNodeConfig
  | TransformNodeConfig
  | TargetNodeConfig
  | AggregationNodeConfig
  | JoinNodeConfig
  | UnionNodeConfig
  | CustomSQLNodeConfig;

/**
 * Transform node config (UPDATED with multi-transform support)
 */
interface TransformNodeConfig {
  // Original simple transform (for backward compatibility)
  expression?: string;                        // Single WHERE clause
  columnMappings?: ColumnTransform[];
  cacheResults?: boolean;
  
  // NEW: Multi-transform composition
  multiTransforms?: Transform[];              // Composed transforms
  
  // NEW: Push-down strategy
  executionStrategy?: ExecutionStrategy;
  
  // NEW: Eligibility report
  pushdownEligibility?: EligibilityReport;
  
  // NEW: Test results
  lastTestResults?: {
    timestamp: string;
    rowsIn: number;
    rowsOut: number;
    executionTimeMs: number;
    sampleOutput?: any[];
    error?: string;
  };
}

// === UPDATED SLICE ACTIONS ===

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {
    // ... existing reducers ...
    
    // NEW: Update transform config
    updateTransformConfig: (state, action: PayloadAction<{
      nodeId: string;
      config: Partial<TransformNodeConfig>;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        node.config = { ...node.config, ...action.payload.config };
      }
    },
    
    // NEW: Add multi-transform to node
    addMultiTransform: (state, action: PayloadAction<{
      nodeId: string;
      transform: Transform;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        const config = node.config as TransformNodeConfig;
        config.multiTransforms = [...(config.multiTransforms || []), action.payload.transform];
      }
    },
    
    // NEW: Remove multi-transform from node
    removeMultiTransform: (state, action: PayloadAction<{
      nodeId: string;
      transformId: string;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        const config = node.config as TransformNodeConfig;
        config.multiTransforms = (config.multiTransforms || [])
          .filter(t => t.id !== action.payload.transformId);
      }
    },
    
    // NEW: Update execution strategy
    setExecutionStrategy: (state, action: PayloadAction<{
      nodeId: string;
      strategy: ExecutionStrategy;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        const config = node.config as TransformNodeConfig;
        config.executionStrategy = action.payload.strategy;
      }
    },
    
    // NEW: Update eligibility report
    updateEligibilityReport: (state, action: PayloadAction<{
      nodeId: string;
      report: EligibilityReport;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        const config = node.config as TransformNodeConfig;
        config.pushdownEligibility = action.payload.report;
      }
    },
    
    // NEW: Update validation result
    updateNodeValidation: (state, action: PayloadAction<{
      nodeId: string;
      validation: ValidationResult;
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node) {
        node.validation = action.payload.validation;
      }
    },
    
    // NEW: Update test results
    setTestResults: (state, action: PayloadAction<{
      nodeId: string;
      results: TransformNodeConfig['lastTestResults'];
    }>) => {
      const node = state.nodes[action.payload.nodeId];
      if (node && node.type === 'transform') {
        const config = node.config as TransformNodeConfig;
        config.lastTestResults = action.payload.results;
      }
    },
  },
});
```

---

## 2. Transform Configuration Panel Component

### New Component Required

**File:** `Frontend/src/components/transformations/TransformConfigurationPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  updateTransformConfig,
  updateNodeValidation,
  setTestResults,
  updateEligibilityReport,
} from '@/store/slices/pipelineSlice';
import { Node } from '@/types';
import { TransformNodeConfig, ValidationResult } from '@/store/slices/pipelineSlice';
import { getTransformValidation, testTransform, checkEligibility } from '@/services/transformService';
import { PushdownStrategyPanel } from './PushdownStrategyPanel';
import { MultiTransformComposer } from './MultiTransformComposer';

interface TransformConfigurationPanelProps {
  node: Node;
  sourceColumns: Column[];
  onClose?: () => void;
}

/**
 * Configuration panel shown when user selects a transform node
 * 
 * Tabs:
 * 1. Configuration - Filter/column mapping
 * 2. Multi-Transform - Compose multiple transforms
 * 3. Push-Down Strategy - Check eligibility + execution point
 * 4. Test Results - Show last test execution
 */
export const TransformConfigurationPanel: React.FC<TransformConfigurationPanelProps> = ({
  node,
  sourceColumns,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'config' | 'multi' | 'pushdown' | 'test'>('config');
  const [expression, setExpression] = useState((node.config as TransformNodeConfig)?.expression || '');
  const [columnMappings, setColumnMappings] = useState(
    (node.config as TransformNodeConfig)?.columnMappings || []
  );
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // ─── VALIDATION ───────────────────────────────────────────────────────────

  // Validate expression on change (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (expression.trim()) {
        setIsValidating(true);
        try {
          const result = await getTransformValidation({
            expression,
            sourceColumns,
            mappings: columnMappings,
          });
          setValidation(result);
          dispatch(updateNodeValidation({ nodeId: node.id, validation: result }));
        } catch (error) {
          setValidation({
            valid: false,
            errors: [{ code: 'VALIDATION_ERROR', message: String(error) }],
          });
        } finally {
          setIsValidating(false);
        }
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [expression, columnMappings, dispatch, node.id, sourceColumns]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────

  const handleExpressionChange = (value: string) => {
    setExpression(value);
    dispatch(updateTransformConfig({
      nodeId: node.id,
      config: { expression: value },
    }));
  };

  const handleColumnMappingChange = (mappings: ColumnTransform[]) => {
    setColumnMappings(mappings);
    dispatch(updateTransformConfig({
      nodeId: node.id,
      config: { columnMappings: mappings },
    }));
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const results = await testTransform({
        expression,
        mappings: columnMappings,
        sourceColumns,
        // Configuration from node if needed
      });
      dispatch(setTestResults({
        nodeId: node.id,
        results: {
          timestamp: new Date().toISOString(),
          rowsIn: results.inputRows,
          rowsOut: results.outputRows,
          executionTimeMs: results.executionTime,
          sampleOutput: results.sampleRows,
          error: results.error,
        },
      }));
    } catch (error) {
      dispatch(setTestResults({
        nodeId: node.id,
        results: {
          timestamp: new Date().toISOString(),
          rowsIn: 0,
          rowsOut: 0,
          executionTimeMs: 0,
          error: String(error),
        },
      }));
    } finally {
      setIsTesting(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const config = node.config as TransformNodeConfig;
  const isValidForTest = validation?.valid ?? false;

  return (
    <div className="transform-config-panel bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Transform Configuration</h2>
        {onClose && <button onClick={onClose}>✕</button>}
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200 mb-4">
        <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')}>
          Configuration
        </TabButton>
        <TabButton active={activeTab === 'multi'} onClick={() => setActiveTab('multi')}>
          Multi-Transform
        </TabButton>
        <TabButton active={activeTab === 'pushdown'} onClick={() => setActiveTab('pushdown')}>
          Push-Down Strategy
        </TabButton>
        <TabButton active={activeTab === 'test'} onClick={() => setActiveTab('test')}>
          Test Results {config.lastTestResults && '✓'}
        </TabButton>
      </div>

      {/* CONFIGURATION TAB */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          {/* SQL Filter Expression */}
          <div>
            <label className="block font-medium mb-2">Filter Expression (WHERE clause)</label>
            <textarea
              value={expression}
              onChange={(e) => handleExpressionChange(e.target.value)}
              className={`w-full border rounded p-2 font-mono text-sm ${
                isValidating ? 'bg-yellow-50' : validation?.valid ? 'bg-green-50' : 'bg-red-50'
              }`}
              rows={4}
              placeholder="e.g., age > 18 AND country = 'US'"
            />
            {isValidating && <p className="text-sm text-gray-500 mt-1">Validating...</p>}
            {validation && !validation.valid && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700">
                {validation.errors?.[0]?.message || 'Invalid expression'}
                <br />
                <span className="text-xs text-red-600">Code: {validation.errors?.[0]?.code}</span>
              </div>
            )}
            {validation?.valid && (
              <p className="text-sm text-green-600 mt-1">✓ Valid SQL expression</p>
            )}
          </div>

          {/* Column Mapping */}
          <ColumnMappingInterface
            sourceColumns={sourceColumns}
            mappings={columnMappings}
            onChange={handleColumnMappingChange}
          />

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={!isValidForTest || isTesting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isTesting ? 'Testing...' : '▶ Test Transform'}
          </button>
        </div>
      )}

      {/* MULTI-TRANSFORM TAB */}
      {activeTab === 'multi' && (
        <MultiTransformComposer
          nodeId={node.id}
          multiTransforms={config.multiTransforms || []}
          sourceColumns={sourceColumns}
        />
      )}

      {/* PUSH-DOWN STRATEGY TAB */}
      {activeTab === 'pushdown' && (
        <PushdownStrategyPanel
          nodeId={node.id}
          transformConfig={config}
          onStrategyChange={(strategy) => {
            // This will be handled by PushdownStrategyPanel
          }}
        />
      )}

      {/* TEST RESULTS TAB */}
      {activeTab === 'test' && config.lastTestResults && (
        <TestResultsDisplay
          results={config.lastTestResults}
          columnInfo={{ input: sourceColumns, output: columnMappings.map((m) => m.target) }}
        />
      )}
    </div>
  );
};

// ─── HELPER COMPONENTS ─────────────────────────────────────────────────────

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
      active
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const ColumnMappingInterface: React.FC<{
  sourceColumns: Column[];
  mappings: ColumnTransform[];
  onChange: (mappings: ColumnTransform[]) => void;
}> = ({ sourceColumns, mappings, onChange }) => {
  // Render column mapping table with drag-drop or select
  return (
    <div>
      <label className="block font-medium mb-2">Column Mapping</label>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Source Column</th>
            <th className="border p-2 text-left">Target Column</th>
            <th className="border p-2 text-left">Aggregation</th>
            <th className="border p-2">Delete</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, idx) => (
            <tr key={idx}>
              <td className="border p-2">{mapping.source.name}</td>
              <td className="border p-2">
                <input
                  value={mapping.target}
                  onChange={(e) => {
                    const updated = [...mappings];
                    updated[idx].target = e.target.value;
                    onChange(updated);
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td className="border p-2">
                <select
                  value={mapping.aggregation || 'none'}
                  onChange={(e) => {
                    const updated = [...mappings];
                    updated[idx].aggregation = e.target.value as any;
                    onChange(updated);
                  }}
                  className="border rounded px-2 py-1"
                >
                  <option value="none">None</option>
                  <option value="sum">SUM</option>
                  <option value="count">COUNT</option>
                  <option value="avg">AVG</option>
                  <option value="max">MAX</option>
                  <option value="min">MIN</option>
                </select>
              </td>
              <td className="border p-2 text-center">
                <button
                  onClick={() => onChange(mappings.filter((_, i) => i !== idx))}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => {
          if (sourceColumns.length > 0) {
            const newMapping: ColumnTransform = {
              source: sourceColumns[0],
              target: sourceColumns[0].name,
            };
            onChange([...mappings, newMapping]);
          }
        }}
        className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
      >
        + Add Mapping
      </button>
    </div>
  );
};

const TestResultsDisplay: React.FC<{
  results: any;
  columnInfo: { input: Column[]; output: string[] };
}> = ({ results, columnInfo }) => {
  if (results.error) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded text-red-700">
        <p className="font-bold">Error During Test</p>
        <p className="text-sm font-mono">{results.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-gray-600">Input Rows</p>
          <p className="text-2xl font-bold text-blue-600">{results.rowsIn}</p>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <p className="text-sm text-gray-600">Output Rows</p>
          <p className="text-2xl font-bold text-green-600">{results.rowsOut}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <p className="text-sm text-gray-600">Execution Time</p>
          <p className="text-2xl font-bold text-purple-600">{results.executionTimeMs}ms</p>
        </div>
      </div>
      {results.sampleOutput && (
        <div>
          <p className="font-medium mb-2">Sample Output (first 5 rows)</p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(results.sampleOutput?.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TransformConfigurationPanel;
```

---

## 3. Backend Transform Validation Service

### New Service Required

**File:** `Backend/src/api/services/transform.service.ts`

```typescript
import { ValidationResult, ValidationError } from '@/shared/errors/types';
import { SourceTechnology } from '@/codegen/core/types/pipeline.types';
import { AppError } from '@/shared/errors/AppError';
import { createLogger } from '@/shared/logging';

const log = createLogger('transform');

/**
 * Service for validation, testing, and eligibility checking of transforms
 */
export class TransformService {
  /**
   * Validate a SQL filter expression
   */
  validateExpression(
    expression: string,
    sourceTechnology: SourceTechnology
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if empty
    if (!expression?.trim()) {
      errors.push({
        code: 'TRANSFORM-001',
        message: 'Expression is required',
      });
      return { valid: false, errors, warnings };
    }

    // Check SQL syntax (basic parsing)
    try {
      this.validateSQLSyntax(expression, sourceTechnology);
    } catch (error) {
      errors.push({
        code: 'TRANSFORM-002',
        message: `Invalid SQL syntax: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Check for dangerous operations
    const dangerousPatterns = [/DROP\s+TABLE/i, /DELETE\s+FROM/i, /TRUNCATE/i];
    if (dangerousPatterns.some((p) => p.test(expression))) {
      errors.push({
        code: 'TRANSFORM-010',
        message: 'Expression contains dangerous operations (DELETE, DROP, TRUNCATE)',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate column mappings
   */
  validateColumnMappings(
    mappings: ColumnTransform[],
    sourceColumns: Column[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check at least one mapping exists
    if (!mappings || mappings.length === 0) {
      errors.push({
        code: 'TRANSFORM-003',
        message: 'At least one column mapping is required',
      });
    }

    const seenTargetNames = new Set<string>();

    mappings.forEach((mapping, idx) => {
      // Check source column exists
      if (!sourceColumns.find((c) => c.name === mapping.source.name)) {
        errors.push({
          code: 'TRANSFORM-004',
          message: `Source column not found: ${mapping.source.name}`,
        });
      }

      // Check target column name not empty
      if (!mapping.target?.trim()) {
        errors.push({
          code: 'TRANSFORM-005',
          message: `Target column name is required for mapping ${idx + 1}`,
        });
      }

      // Check for duplicate target columns
      if (mapping.target && seenTargetNames.has(mapping.target)) {
        errors.push({
          code: 'TRANSFORM-006',
          message: `Duplicate target column name: ${mapping.target}`,
        });
      }
      seenTargetNames.add(mapping.target);

      // Warning: aggregation without GROUP BY
      if (mapping.aggregation && mapping.aggregation !== 'none') {
        warnings.push({
          code: 'WARN-001',
          message: `Column ${mapping.source.name} uses aggregation without explicit GROUP BY. Ensure pipeline has aggregation node.`,
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a complete transform configuration
   */
  validateTransformConfig(
    config: any,
    sourceColumns: Column[],
    sourceTech?: SourceTechnology
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate expression
    if (config.expression) {
      const exprValidation = this.validateExpression(config.expression, sourceTech || 'pyspark');
      errors.push(...exprValidation.errors);
      warnings.push(...exprValidation.warnings);
    }

    // Validate column mappings
    if (config.columnMappings) {
      const mappingValidation = this.validateColumnMappings(config.columnMappings, sourceColumns);
      errors.push(...mappingValidation.errors);
      warnings.push(...mappingValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check push-down eligibility for a transform against a target technology
   */
  async checkEligibility(
    config: any,
    sourceTechnology: SourceTechnology,
    targetTechnology?: SourceTechnology
  ): Promise<EligibilityReport> {
    // This would call PushdownEligibilityEngine
    // For now, returning placeholder
    return {
      timestamp: new Date().toISOString(),
      targetTechnology: targetTechnology || 'pyspark',
      functionIds: [],
      eligible: {},
      canPushDown: false,
      recommendation: 'Unable to check eligibility',
    };
  }

  /**
   * Test execute a transform with sample data
   */
  async testTransform(
    config: any,
    sourceColumns: Column[]
  ): Promise<TestResult> {
    log.info('Starting transform test execution', { action: 'transform.test' });

    try {
      // Validate first
      const validation = this.validateTransformConfig(config, sourceColumns);
      if (!validation.valid) {
        throw new AppError({
          code: 'TRANSFORM-011',
          errorClass: 'VALIDATION',
          httpStatus: 400,
          userMessage: 'Transform configuration is invalid',
          internalMessage: validation.errors.map((e) => e.message).join('; '),
        });
      }

      // Would execute against actual database or test harness
      // For now, returning mock results
      return {
        inputRows: 1000,
        outputRows: 750,
        executionTime: 245,
        error: null,
        sampleRows: [
          { id: 1, name: 'John', age: 25 },
          { id: 2, name: 'Jane', age: 30 },
        ],
      };
    } catch (error) {
      log.error('Transform test failed', {
        action: 'transform.test',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────

  private validateSQLSyntax(sql: string, tech: SourceTechnology): void {
    // Very basic SQL validation (real implementation would use SQL parser)
    const basicCheck = /^(\w+\s+)*(\w+)(.|\s)*$/;
    if (!basicCheck.test(sql)) {
      throw new Error('SQL syntax appears invalid');
    }

    // Could add tech-specific validation here
  }
}

export const transformService = new TransformService();
```

### New Controller Required

**File:** `Backend/src/api/controllers/transform.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { transformService } from '../services/transform.service';
import { createLogger } from '@/shared/logging';

const log = createLogger('transforms');

export class TransformController {
  /**
   * POST /api/transforms/validate
   * Validate a transform configuration
   */
  async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { config, sourceColumns, sourceTechnology } = req.body;

      const result = transformService.validateTransformConfig(
        config,
        sourceColumns,
        sourceTechnology
      );

      res.json({
        success: true,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/transforms/test
   * Execute a transform with test data
   */
  async test(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { config, sourceColumns } = req.body;

      const result = await transformService.testTransform(config, sourceColumns);

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/transforms/check-eligibility
   * Check push-down eligibility
   */
  async checkEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { config, sourceTechnology, targetTechnology } = req.body;

      const result = await transformService.checkEligibility(
        config,
        sourceTechnology,
        targetTechnology
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const transformController = new TransformController();
```

### New Routes Required

**File:** `Backend/src/api/routes/transform.routes.ts`

```typescript
import { Router } from 'express';
import { transformController } from '../controllers/transform.controller';

const router = Router();

// Validation
router.post('/validate', (req, res, next) => transformController.validate(req, res, next));

// Testing
router.post('/test', (req, res, next) => transformController.test(req, res, next));

// Eligibility checking
router.post('/check-eligibility', (req, res, next) =>
  transformController.checkEligibility(req, res, next)
);

export { router as transformRouter };
```

### Register Routes in App

**File:** `Backend/src/api/server.ts` (update)

```typescript
// Add to imports
import { transformRouter } from './routes/transform.routes';

// Add to Express setup (after other routes)
app.use('/api/transforms', transformRouter);
```

---

## 4. PushdownStrategyPanel Component

### New Component Required

**File:** `Frontend/src/components/transformations/PushdownStrategyPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { updateExecutionStrategy, updateEligibilityReport } from '@/store/slices/pipelineSlice';
import { checkEligibility } from '@/services/transformService';
import { TransformNodeConfig, ExecutionStrategy, EligibilityReport } from '@/store/slices/pipelineSlice';

interface PushdownStrategyPanelProps {
  nodeId: string;
  transformConfig: TransformNodeConfig;
  onStrategyChange?: (strategy: ExecutionStrategy) => void;
}

/**
 * Shows push-down eligibility and allows user to choose execution strategy
 * 
 * Checks which functions in the transform can be pushed down to the source DB
 * and recommends whether to execute at source or in PySpark
 */
export const PushdownStrategyPanel: React.FC<PushdownStrategyPanelProps> = ({
  nodeId,
  transformConfig,
  onStrategyChange,
}) => {
  const dispatch = useAppDispatch();
  const [eligibilityReport, setEligibilityReport] = useState<EligibilityReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<'SOURCE' | 'PYSPARK'>(
    transformConfig.executionStrategy?.executionPoint || 'SOURCE'
  );

  // ─── CHECK ELIGIBILITY ────────────────────────────────────────────────────

  const handleCheckEligibility = async () => {
    setIsChecking(true);
    try {
      const report = await checkEligibility({
        config: transformConfig,
        sourceTechnology: transformConfig.executionStrategy?.sourceDatabase?.technology,
      });

      setEligibilityReport(report);
      dispatch(updateEligibilityReport({ nodeId, report }));
    } catch (error) {
      console.error('Failed to check eligibility:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // ─── EXECUTION POINT SELECTION ────────────────────────────────────────────

  const handleExecutionPointChange = (point: 'SOURCE' | 'PYSPARK') => {
    setSelectedPoint(point);

    const strategy: ExecutionStrategy = {
      eligibility: eligibilityReport?.canPushDown ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      executionPoint: point,
      recommendations: eligibilityReport?.recommendation ? [eligibilityReport.recommendation] : [],
      sourceDatabase: transformConfig.executionStrategy?.sourceDatabase,
    };

    dispatch(updateExecutionStrategy({ nodeId, strategy }));
    onStrategyChange?.(strategy);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="pushdown-strategy-panel space-y-4">
      {/* Info Card */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-900">
          <strong>Push-Down Strategy:</strong> Determines whether your transform executes at the
          source database (Oracle, PostgreSQL, etc.) or in PySpark. Source execution is faster but
          limited to functions the database supports.
        </p>
      </div>

      {/* Check Eligibility */}
      <div>
        <button
          onClick={handleCheckEligibility}
          disabled={isChecking}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {isChecking ? 'Checking...' : '✓ Check Eligibility'}
        </button>
      </div>

      {/* Eligibility Report */}
      {eligibilityReport && (
        <EligibilityReportCard report={eligibilityReport} />
      )}

      {/* Execution Point Selection */}
      {eligibilityReport && (
        <div className="space-y-3">
          <p className="font-medium">Choose Execution Point:</p>

          {/* SOURCE OPTION */}
          <ExecutionPointOption
            point="SOURCE"
            label="Execute at Source Database"
            selected={selectedPoint === 'SOURCE'}
            onChange={() => handleExecutionPointChange('SOURCE')}
            eligible={eligibilityReport.canPushDown}
            description={
              eligibilityReport.canPushDown
                ? 'All functions supported ✓'
                : `❌ Not all functions supported: ${
                    Object.entries(eligibilityReport.eligible)
                      .filter(([_, cap]) => !['NATIVE', 'ALTERNATIVE'].includes(cap.support))
                      .map(([fnId]) => fnId)
                      .join(', ') || 'see details'
                  }`
            }
          />

          {/* PYSPARK OPTION */}
          <ExecutionPointOption
            point="PYSPARK"
            label="Execute in PySpark"
            selected={selectedPoint === 'PYSPARK'}
            onChange={() => handleExecutionPointChange('PYSPARK')}
            eligible={true}
            description="All functions supported, but slower than source execution"
          />
        </div>
      )}

      {/* Details: Function Coverage */}
      {eligibilityReport && (
        <FunctionCoverageTable eligibility={eligibilityReport.eligible} />
      )}
    </div>
  );
};

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────

const EligibilityReportCard: React.FC<{ report: EligibilityReport }> = ({ report }) => {
  const statusColor = report.canPushDown ? 'green' : 'red';
  const statusText = report.canPushDown ? 'Eligible for Push-Down' : 'Not Eligible for Push-Down';
  const statusIcon = report.canPushDown ? '✓' : '❌';

  return (
    <div className={`p-4 border rounded bg-${statusColor}-50 border-${statusColor}-200`}>
      <p className={`font-bold text-${statusColor}-900`}>
        {statusIcon} {statusText}
      </p>
      <p className={`text-sm text-${statusColor}-800 mt-2`}>{report.recommendation}</p>
    </div>
  );
};

const ExecutionPointOption: React.FC<{
  point: 'SOURCE' | 'PYSPARK';
  label: string;
  selected: boolean;
  onChange: () => void;
  eligible: boolean;
  description: string;
}> = ({ point, label, selected, onChange, eligible, description }) => (
  <div
    className={`p-4 border rounded cursor-pointer transition-colors ${
      selected
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 bg-white hover:bg-gray-50'
    } ${!eligible ? 'opacity-60' : ''}`}
    onClick={eligible ? onChange : undefined}
  >
    <div className="flex items-start gap-3">
      <input
        type="radio"
        checked={selected}
        onChange={onChange}
        disabled={!eligible}
        className="mt-1"
      />
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className={`text-sm ${eligible ? 'text-gray-600' : 'text-red-600'}`}>
          {description}
        </p>
      </div>
    </div>
  </div>
);

const FunctionCoverageTable: React.FC<{
  eligibility: { [fnId: string]: any };
}> = ({ eligibility }) => (
  <div>
    <p className="font-medium mb-3">Function Coverage Details</p>
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-2 text-left">Function</th>
          <th className="border p-2 text-left">Support Level</th>
          <th className="border p-2 text-left">Note</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(eligibility).map(([fnId, cap]: [string, any]) => (
          <tr key={fnId}>
            <td className="border p-2 font-mono text-xs">{fnId}</td>
            <td className="border p-2">
              <span
                className={`px-2 py-1 rounded text-white text-xs font-bold ${
                  cap.support === 'NATIVE'
                    ? 'bg-green-600'
                    : cap.support === 'ALTERNATIVE'
                      ? 'bg-yellow-600'
                      : 'bg-red-600'
                }`}
              >
                {cap.support}
              </span>
            </td>
            <td className="border p-2 text-gray-600">
              {cap.note || cap.alternative ? `Use: ${cap.alternative}` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default PushdownStrategyPanel;
```

---

## 5. Codegen Engine Updates

### Update PySparkEngine to Handle Multi-Transforms

**File:** `Backend/src/codegen/engines/spark/pyspark/pyspark.engine.ts` (update)

```typescript
// Add to existing PySparkEngine class

/**
 * Generate code for a transform node (single or multi-transform)
 */
private generateTransformNode(node: Node, context: GenerationContext): string {
  const config = node.config as TransformNodeConfig;
  
  // Check if this is a multi-transform composition
  if (config.multiTransforms && config.multiTransforms.length > 0) {
    return this.generateMultiTransform(node, config, context);
  }
  
  // Single transform (original logic)
  return this.generateSingleTransform(node, config, context);
}

/**
 * Generate code for multi-transform composition
 */
private generateMultiTransform(
  node: Node,
  config: TransformNodeConfig,
  context: GenerationContext
): string {
  let code = '# Multi-Transform Composition\n';
  let currentDf = `df_${node.id}`;

  // Get input dataframe name
  const inputNodes = context.getInputNodes(node.id);
  if (inputNodes.length > 0) {
    currentDf = `df_${inputNodes[0].id}`;
  }

  code += `${currentDf} = df_input  # Starting dataframe\n\n`;

  // Apply each transform in sequence
  config.multiTransforms.forEach((transform, idx) => {
    const nextDf = idx === config.multiTransforms!.length - 1
      ? `df_${node.id}`
      : `df_step_${idx + 1}`;

    code += `# Transform Step ${idx + 1}: ${transform.type}\n`;

    switch (transform.type) {
      case 'filter':
        code += this.generateFilterTransform(transform, currentDf, nextDf);
        break;
      case 'column_map':
        code += this.generateColumnMapTransform(transform, currentDf, nextDf);
        break;
      case 'aggregation':
        code += this.generateAggregationTransform(transform, currentDf, nextDf);
        break;
      case 'custom_sql':
        code += this.generateCustomSQLTransform(transform, currentDf, nextDf);
        break;
    }

    code += '\n';
    currentDf = nextDf;
  });

  // Handle caching if specified
  if (config.cacheResults) {
    code += `df_${node.id}.cache()\n`;
  }

  return code;
}

private generateFilterTransform(
  transform: Transform,
  inputDf: string,
  outputDf: string
): string {
  const expr = transform.filter?.expression || '1=1';
  return `${outputDf} = ${inputDf}.filter("${this.escapeSQLString(expr)}")\n`;
}

private generateColumnMapTransform(
  transform: Transform,
  inputDf: string,
  outputDf: string
): string {
  const mappings = transform.columnMapping?.mappings || [];
  let code = '';

  const selectClauses = mappings.map((m) => {
    if (m.aggregation && m.aggregation !== 'none') {
      return `F.${m.aggregation.toLowerCase()}("${m.source.name}").alias("${m.target}")`;
    }
    return `col("${m.source.name}").alias("${m.target}")`;
  });

  code += `${outputDf} = ${inputDf}.select(${selectClauses.join(', ')})\n`;
  return code;
}

private generateAggregationTransform(
  transform: Transform,
  inputDf: string,
  outputDf: string
): string {
  // Assuming aggregation metadata in transform
  const groupByCols = (transform as any).groupBy || [];
  const aggs = (transform as any).aggregations || {};

  if (groupByCols.length === 0) {
    // Global aggregation
    const aggExpressions = Object.entries(aggs)
      .map(([col, fn]) => `F.${(fn as string).toLowerCase()}("${col}").alias("${col}_${fn}")`)
      .join(', ');
    return `${outputDf} = ${inputDf}.agg(${aggExpressions})\n`;
  }

  const aggExpressions = Object.entries(aggs)
    .map(([col, fn]) => `F.${(fn as string).toLowerCase()}("${col}").alias("${col}_${fn}")`)
    .join(', ');

  return `${outputDf} = ${inputDf}.groupBy(${groupByCols.map((c) => `"${c}"`).join(', ')}).agg(${aggExpressions})\n`;
}

private generateCustomSQLTransform(
  transform: Transform,
  inputDf: string,
  outputDf: string
): string {
  const sql = transform.customSql?.sql || '';
  // Create temp view and execute SQL
  return `${inputDf}.createOrReplaceTempView("temp_input")\n${outputDf} = spark.sql("${this.escapeSQLString(sql)}")\n`;
}

private escapeSQLString(sql: string): string {
  return sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/**
 * Update validate() to check multi-transforms
 */
validate(pipeline: PipelineDefinition): ValidationResult {
  // Existing validation...
  
  // NEW: Validate multi-transforms
  for (const node of pipeline.nodes) {
    if (node.type === 'transform') {
      const config = node.config as TransformNodeConfig;
      if (config.multiTransforms && config.multiTransforms.length > 0) {
        // Validate each transform in sequence
        for (const transform of config.multiTransforms) {
          if (!transform.type) {
            return {
              valid: false,
              errors: [{ code: 'MULTI_TRANSFORM_INVALID', message: 'Transform type is required' }],
              warnings: [],
            };
          }
        }
      }
    }
  }
  
  return { valid: true, errors: [], warnings: [] };
}
```

---

## 6. Integration Checklist

To wire everything together, follow this order:

```typescript
// 1. Update Redux state schema (pipelineSlice.ts)
✓ Add Transform, ExecutionStrategy, EligibilityReport interfaces
✓ Update TransformNodeConfig with multi-transform fields
✓ Add reducer actions (addMultiTransform, setExecutionStrategy, etc.)

// 2. Create Transform Configuration Panel component
✓ TransformConfigurationPanel.tsx
✓ Wired to Redux store
✓ Mounted in pipeline editor when node selected

// 3. Create Backend Transform Service
✓ Create transform.service.ts
✓ Create transform.controller.ts
✓ Create transform.routes.ts
✓ Register routes in Express app
✓ Wire calls from TransformConfigurationPanel

// 4. Create PushdownStrategyPanel component
✓ Integrated into transform config (as tab)
✓ Calls checkEligibility backend endpoint
✓ Updates ExecutionStrategy in store

// 5. Update CodegenService/Engines
✓ Update PySparkEngine to handle multiTransforms
✓ Add generateMultiTransform() method
✓ Test code generation

// 6. Integration Tests
✓ User creates pipeline with multi-transforms
✓ Saves transforms to database
✓ Can retrieve and edit
✓ Generates correct Spark code
```

---

## Summary

This blueprint shows the exact code needed to wire transform components into the pipeline editor. The key insight: **transform configurations must flow through Redux → database → codegen engines** for the system to work end-to-end.

Start with #1 (Redux schema) and #2 (configuration panel). Those unblock everything else.

