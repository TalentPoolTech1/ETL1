# Multi-Transform System - Module Organization

Complete reference for all modules, types, and utilities in the multi-transform system.

## File Map

### 1. **Transform Registry** (`src/registry/TransformRegistry.ts`)

The master catalog of all 17+ transformation primitives.

**Exports:**

```typescript
// Types
export type TransformCategory = 'convert' | 'text' | 'datetime' | 'numeric' | 'regex' | 'conditional' | 'aggregation' | 'custom'
export type ParameterType = 'text' | 'number' | 'select' | 'toggle' | 'date' | 'expression' | 'list'
export interface ParameterDef { ... }
export interface TransformPrimitive { ... }

// Data
export const TRANSFORM_REGISTRY: Record<string, TransformPrimitive> = { ... }

// Utilities
export function getTransform(id: string): TransformPrimitive | null
export function getTransformsInCategory(category: TransformCategory): TransformPrimitive[]
export function getSupportedTransforms(engine: 'spark' | 'postgresql' | 'redshift'): TransformPrimitive[]
export function isNativelySupported(transformId: string, engine: string): boolean
```

**Contents (17+ primitives):**
- `to_number` — Convert text to number
- `to_date` — Convert text to date
- `cast` — Change data type
- `substring` — Extract part of text
- `trim` — Remove whitespace
- `trim_timestamp` — Remove time from timestamp
- `date_add` — Add days/months/years
- `round` — Round decimal
- `floor` — Round down
- `ceil` — Round up
- `regex_extract` — Pull text using pattern
- `coalesce` — Use first non-null
- `null_if` — Blank out specific value
- `custom_sql` — Write raw expression

---

### 2. **Intermediate Representation Layer** (`src/transformations/ir.ts`)

Engine-neutral serialization for transform sequences.

**Exports:**

```typescript
// Types
export interface TransformStep {
  stepId: string
  type: string
  params: Record<string, any>
  enabled: boolean
  onError: ErrorPolicy
  defaultValue?: any
  metadata?: { ... }
  children?: TransformStep[]
}

export interface TransformSequence {
  id: string
  name: string
  description?: string
  columnId: string
  columnName: string
  targetEngine: 'spark' | 'postgresql' | 'redshift'
  steps: TransformStep[]
  pipelineId: string
  datasetId: string
  author: string
  createdAt: Date
  updatedAt: Date
  currentVersionId: string
  versions?: TransformVersion[]
}

export interface TransformVersion {
  versionId: string
  sequenceId: string
  versionNumber: number
  name: string
  steps: TransformStep[]
  author: string
  createdAt: Date
  changeNote?: string
  previewSample?: PreviewSample
  diffSummary?: string
}

export interface TransformAuditEntry {
  id: string
  sequenceId: string
  versionId: string
  action: 'CREATED' | 'MODIFIED' | 'APPLIED' | 'REVERTED' | 'DELETED' | 'PREVIEWED'
  userId: string
  timestamp: Date
  changes?: { ... }
  metadata?: { ... }
}

// Factories
export function createStep(type: string, params?: {}, overrides?: Partial<TransformStep>): TransformStep
export function createSequence(columnId: string, columnName: string, pipelineId: string, datasetId: string, targetEngine: string): TransformSequence

// Serialization
export function serializeSequence(seq: TransformSequence): string
export function deserializeSequence(json: string): TransformSequence

// Validation
export function validateStep(step: TransformStep, primitive: TransformPrimitive): { valid: boolean; errors: string[] }
export function validateSequence(seq: TransformSequence, registry: Record<string, TransformPrimitive>): { valid: boolean; errors: Map<string, string[]> }

// Versioning
export function createVersionSnapshot(sequence: TransformSequence, changeNote?: string): TransformVersion
export function revertToVersion(sequence: TransformSequence, versionId: string): TransformSequence
export function diffVersions(oldVersion: TransformVersion, newVersion: TransformVersion): string
```

---

### 3. **Code Generation Layer** (`src/transformations/codegen.ts`)

Compiles IR to engine-specific SQL.

**Exports:**

```typescript
// Types
export interface CodeGenerationResult {
  sql: string
  warnings: string[]
  isValid: boolean
  executionTime?: number
}

// Base class
export abstract class BaseCodeGenerator {
  abstract compile(step: TransformStep, inputExpr: string): CodeGenerationResult
  abstract compileSequence(sequence: TransformSequence): CodeGenerationResult
  abstract escapeIdentifier(name: string): string
  abstract escapeString(value: string): string
}

// Implementations
export class SparkSQLGenerator extends BaseCodeGenerator { ... }
export class PostgreSQLGenerator extends BaseCodeGenerator { ... }
export class RedshiftCodeGenerator extends BaseCodeGenerator { ... }

// Factory & utilities
export function getCodeGenerator(engine: 'spark' | 'postgresql' | 'redshift'): BaseCodeGenerator
export function compileStep(step: TransformStep, engine: string, inputExpr?: string): CodeGenerationResult
export function compileSequence(sequence: TransformSequence): CodeGenerationResult
```

---

### 4. **Parameter Panel Component** (`src/components/transformations/ParameterPanel.tsx`)

Generic, reusable input component for transform parameters.

**Exports:**

```typescript
export interface ParameterPanelProps {
  primitive: TransformPrimitive
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  onValidationChange?: (errors: Record<string, string>) => void
  disabled?: boolean
}

export const ParameterPanel: React.FC<ParameterPanelProps>

export function useParameterPanel(initialValues?: Record<string, any>): {
  values: Record<string, any>
  errors: Record<string, string>
  handleChange: (newValues: Record<string, any>) => void
  handleValidationChange: (newErrors: Record<string, string>) => void
  reset: () => void
  isValid: boolean
}
```

**Usage:**
```typescript
<ParameterPanel
  primitive={getTransform('to_number')}
  values={{ format: '#,##0.00' }}
  onChange={setValues}
  onValidationChange={setErrors}
/>
```

---

### 5. **Condition Builder Component** (`src/components/transformations/ConditionBuilder.tsx`)

Plain-language conditional logic builder.

**Exports:**

```typescript
export type ComparisonOperator = 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts_with' | 'is_null' | 'is_not_null'
export type LogicalOperator = 'AND' | 'OR'

export interface ConditionClause {
  id: string
  field: string
  operator: ComparisonOperator
  value?: any
}

export interface ConditionGroup {
  id: string
  clauses: ConditionClause[]
  logicalOp: LogicalOperator
}

export interface ComplexCondition {
  groups: ConditionGroup[]
  groupLogicalOp: LogicalOperator
}

export const ConditionBuilder: React.FC<ConditionBuilderProps>
export function conditionToSQL(condition: ComplexCondition | null, engine: 'spark' | 'postgresql' | 'redshift'): string
```

**Usage:**
```typescript
const [condition, setCondition] = useState(null)
const whereClause = conditionToSQL(condition, 'spark')
// Output: "(status = 'active') AND (amount > 1000)"
```

---

### 6. **Pattern Wizard Component** (`src/components/transformations/PatternWizard.tsx`)

Interactive regex pattern builder with live testing.

**Exports:**

```typescript
export interface PatternWizardResult {
  pattern: string
  groupIndex: number
  caseSensitive: boolean
  multiline: boolean
  dotMatchesNewline: boolean
}

export const PatternWizard: React.FC<PatternWizardProps>
```

**Usage:**
```typescript
<PatternWizard
  onComplete={result => {
    setStep({
      ...step,
      params: {
        pattern: result.pattern,
        group: result.groupIndex,
      }
    })
  }}
  sampleData={['example@email.com', 'test@domain.org']}
/>
```

---

### 7. **Transform Step Editor** (`src/components/transformations/TransformStepEditor.tsx`)

Individual step editor + step list with reordering.

**Exports:**

```typescript
export interface TransformStepEditorProps {
  step: TransformStep
  onChange: (step: TransformStep) => void
  onRemove: () => void
  engine: 'spark' | 'postgresql' | 'redshift'
  inputColumnName: string
  disabled?: boolean
}

export const TransformStepEditor: React.FC<TransformStepEditorProps>

export interface StepListProps {
  steps: TransformStep[]
  onChange: (steps: TransformStep[]) => void
  engine: 'spark' | 'postgresql' | 'redshift'
  inputColumnName: string
  disabled?: boolean
}

export const StepList: React.FC<StepListProps>
```

**Usage:**
```typescript
<StepList
  steps={sequence.steps}
  onChange={newSteps => setSequence({...sequence, steps: newSteps})}
  engine="spark"
  inputColumnName="phone_number"
/>
```

---

### 8. **Multi-Transform Editor** (`src/components/transformations/MultiTransformEditor.tsx`)

Complete, integrated editor for entire transformation sequences. Full example.

**Exports:**

```typescript
export interface MultiTransformEditorProps {
  columnId: string
  columnName: string
  pipelineId: string
  datasetId: string
  defaultEngine: 'spark' | 'postgresql' | 'redshift'
  onSave?: (sequence: TransformSequence) => Promise<void>
  onCancel?: () => void
}

export const MultiTransformEditor: React.FC<MultiTransformEditorProps>
```

**Usage:**
```typescript
<MultiTransformEditor
  columnId="col_1"
  columnName="phone_number"
  pipelineId="pipe_1"
  datasetId="dataset_1"
  defaultEngine="spark"
  onSave={async (seq) => {
    await api.post('/transforms', { sequence: seq })
  }}
/>
```

---

### 9. **Barrel Export** (`src/transformations/index.ts`)

Central export point for all transformation modules.

**Exports everything from:**
- `TransformRegistry.ts` (registry, primitives, utilities)
- `ir.ts` (types, factories, serialization, versioning)
- `codegen.ts` (generators, code generation)
- `ParameterPanel.tsx`
- `ConditionBuilder.tsx`
- `PatternWizard.tsx`
- `TransformStepEditor.tsx`

**Plus utility functions:**
```typescript
export function getCategories(): string[]
export function sequencesAreEqual(seq1: TransformSequence, seq2: TransformSequence): boolean
export function countEnabledSteps(sequence: TransformSequence): number
export function getFailedStepsFromValidation(validation: ReturnType<typeof validateSequence>): string[]
export function createAuditEntry(...): TransformAuditEntry
```

**Usage:**
```typescript
// Import everything from one place
import {
  createSequence,
  createStep,
  compileSequence,
  getTransform,
  ParameterPanel,
  StepList,
} from '@/transformations'
```

---

## Import Patterns

### Pattern 1: Just use the barrel export

```typescript
import {
  createSequence,
  StepList,
  compileSequence,
} from '@/transformations'
```

### Pattern 2: Import specific modules

```typescript
import { getTransform } from '@/registry/TransformRegistry'
import { compileSequence } from '@/transformations/codegen'
import { ParameterPanel } from '@/components/transformations/ParameterPanel'
```

### Pattern 3: Import types only

```typescript
import type {
  TransformSequence,
  TransformStep,
  CodeGenerationResult,
} from '@/transformations'
```

---

## Type Hierarchy

```
TransformRegistry
  ├── TransformPrimitive
  │   └── ParameterDef
  │       └── validation() function
  └── codeGenTemplate
      └── (params, inputExpr) => string

TransformSequence (root)
  ├── columnId: string
  ├── steps: TransformStep[]
  │   └── stepId, type, params, enabled, onError, defaultValue
  ├── versions: TransformVersion[]
  │   └── versionNumber, steps (copy), changeNote, createdAt
  └── metadata

CodeGenerationResult
  ├── sql: string
  ├── warnings: string[]
  └── isValid: boolean

ComplexCondition (for conditionals)
  └── groups: ConditionGroup[]
      └── clauses: ConditionClause[]
          └── field, operator, value
```

---

## Key Dependencies

- **React 18+** — UI components
- **TypeScript** — Type safety
- No external SQL libraries — code gen is string-based
- No database dependency — IR is JSON-serializable

---

## Database Persistence

All types are JSON-serializable:

```typescript
// Save to DB
const json = serializeSequence(sequence)
await db.transforms.insert({
  sequenceJson: json,  // Store as JSONB
})

// Retrieve from DB
const json = await db.transforms.findOne(id)
const sequence = deserializeSequence(json)
```

---

## Configuration & ENV

No configuration needed. All defaults are sensible.

Optional tuning (in seconds):
```typescript
const CODE_GEN_CACHE_TTL = 300  // Memoize for 5 min
const PREVIEW_TIMEOUT = 5000    // Preview max 5 sec
const MAX_STEPS = 200           // Hard limit per sequence
```

---

## Troubleshooting

### "Cannot find module '@/transformations'"

Check tsconfig.json paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/transformations": ["src/transformations/index.ts"],
      "@/registry/*": ["src/registry/*"],
      "@/components/*": ["src/components/*"]
    }
  }
}
```

### "Unknown transform type 'my_transform'"

Add to TRANSFORM_REGISTRY:
```typescript
TRANSFORM_REGISTRY.my_transform = {
  id: 'my_transform',
  label: 'My Transform',
  // ... full definition
}
```

### "Code generation returned empty SQL"

Check step.type and step.params are valid:
```typescript
const prim = getTransform(step.type)
console.log('primitive:', prim)
console.log('params:', step.params)
```

---

## See Also

- [MULTI_TRANSFORM_IMPLEMENTATION_GUIDE.md](./MULTI_TRANSFORM_IMPLEMENTATION_GUIDE.md) — Detailed architecture
- [MULTI_TRANSFORM_QUICK_START.md](./MULTI_TRANSFORM_QUICK_START.md) — 5-minute integration
- [multi-transform-requirements.md](../Docs/multi-transform-requirements.md) — Full requirements
