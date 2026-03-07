# Multi-Transform Quick Start Guide

Everything you need to integrate the multi-transform system into your pipeline builder.

## What You Get

A complete, reusable transformation composition system for ETL1:

✅ **17+ built-in transformation primitives** (convert, text, datetime, math, regex, etc.)  
✅ **Engine-agnostic IR layer** (Spark SQL, PostgreSQL, Redshift)  
✅ **Real-time code generation** (3 engines, optimized SQL)  
✅ **Reusable React components** (parameter panel, condition builder, pattern wizard)  
✅ **Version management & audit trail** (immutable snapshots, changeLog)  
✅ **Plain-language UI** (no SQL syntax exposed to users)  

## File Structure

```
Frontend/
  src/
    registry/
      TransformRegistry.ts          ← All 17+ transforms defined here
    transformations/
      ir.ts                         ← Intermediate representation (serialization)
      codegen.ts                    ← Code generators for 3 engines
      index.ts                      ← Central export barrel
    components/transformations/
      ParameterPanel.tsx            ← Generic param input builder
      ConditionBuilder.tsx          ← Plain-language conditional logic
      PatternWizard.tsx             ← Regex pattern builder with live test
      TransformStepEditor.tsx       ← Single-step editor + step list
      MultiTransformEditor.tsx      ← Full editor (complete example)
    MULTI_TRANSFORM_IMPLEMENTATION_GUIDE.md  ← Detailed architecture docs
```

## 5-Minute Integration

### 1. Copy files into your project

```bash
# Core logic
cp registry/TransformRegistry.ts src/registry/
cp transformations/ir.ts src/transformations/
cp transformations/codegen.ts src/transformations/
cp transformations/index.ts src/transformations/

# Components
cp components/transformations/*.tsx src/components/transformations/
```

### 2. Basic usage in your component

```typescript
import {
  createSequence,
  createStep,
  compileSequence,
  StepList,
  TransformSequence,
} from '@/transformations';

function MyPipeline() {
  const [sequence, setSequence] = useState(() =>
    createSequence(
      'col_id',      // columnId
      'phone',       // columnName
      'pipe_1',      // pipelineId
      'dataset_1',   // datasetId
      'spark'        // targetEngine
    )
  );

  const handleStepsChange = (newSteps) => {
    setSequence(prev => ({ ...prev, steps: newSteps }));
  };

  const codePreview = compileSequence(sequence);

  return (
    <div>
      <StepList
        steps={sequence.steps}
        onChange={handleStepsChange}
        engine={sequence.targetEngine}
        inputColumnName="phone"
      />

      <pre>{codePreview.sql}</pre>
      
      {codePreview.warnings.map(w => (
        <div key={w} className="warning">{w}</div>
      ))}
    </div>
  );
}
```

### 3. Save to database

```typescript
import { serializeSequence } from '@/transformations';

async function saveTransformation(sequence: TransformSequence) {
  const response = await fetch('/api/transforms', {
    method: 'POST',
    body: JSON.stringify({
      pipelineId: sequence.pipelineId,
      columnId: sequence.columnId,
      sequenceJson: serializeSequence(sequence),
    }),
  });
  return response.json();
}
```

## Key Concepts

### 1. Transform Primitives

Each primitive = one reusable transformation with metadata.

```typescript
const primitive = getTransform('to_number');
console.log(primitive.label);           // "Convert Text to Number"
console.log(primitive.engineSupport);   // { spark: 'native', postgresql: 'native', ... }
console.log(primitive.parameters);      // [ { id: 'format', label: '...', type: 'text' }, ... ]
```

**17 built-in primitives:**
- **Convert:** `to_number`, `to_date`, `cast`
- **Text:** `substring`, `trim`
- **Datetime:** `trim_timestamp`, `date_add`
- **Math:** `round`, `floor`, `ceil`
- **Regex:** `regex_extract`, `regex_replace`
- **Aggregate:** `coalesce`, `null_if`
- **Custom:** `custom_sql`

### 2. Transform Steps

Steps are instances of primitives with specific parameters.

```typescript
const step = createStep('to_number', {
  format: '#,##0.00',
  locale: 'en_US',
  onFail: 'RETURN_NULL',
});

// Step has unique ID, is enabled/disabled, error handling policy, etc.
console.log(step.stepId);      // UUID
console.log(step.enabled);     // true | false
console.log(step.onError);     // 'FAIL' | 'RETURN_NULL' | 'USE_DEFAULT'
```

### 3. Transform Sequences

A sequence = ordered collection of steps for one column.

```typescript
const sequence = createSequence(
  'col_1',           // columnId
  'amount',          // columnName
  'pipeline_1',      // pipelineId
  'dataset_1',       // datasetId
  'spark'            // targetEngine
);

sequence.steps.push(createStep('to_number', { format: '#,##0.00' }));
sequence.steps.push(createStep('round', { places: 2 }));

// Sequence is versioned, auditable, and persisted
console.log(sequence.currentVersionId); // UUID of current version
console.log(sequence.versions);         // [ TransformVersion[], ... ]
```

### 4. Code Generation

Automatic SQL generation for any engine.

```typescript
const sequence = /* ... */;
const result = compileSequence(sequence);

console.log(result.sql);          // "ROUND(CAST(...), 2)"
console.log(result.warnings);     // [ "Warning...", ... ]
console.log(result.isValid);      // boolean
```

**Different output per engine:**
```typescript
// Same IR, different SQL
sequence.targetEngine = 'spark';
const spark = compileSequence(sequence).sql;
// → "ROUND(CAST(amount AS DECIMAL), 2)"

sequence.targetEngine = 'postgresql';
const pg = compileSequence(sequence).sql;
// → "ROUND(CAST(amount::NUMERIC, 2))"
```

### 5. Component Hierarchy

```
MultiTransformEditor (top-level)
  ├─ StepList (step reordering UI)
  │   └─ TransformStepEditor (per-step)
  │       ├─ Transform Catalog (selector)
  │       └─ ParameterPanel (param input builder)
  │           └─ ParameterInput (different per param type)
  │
  └─ Code Preview
      └─ compileSequence(sequence)
```

## Common Tasks

### Add a Step

```typescript
const newStep = createStep('to_number', { format: '#,##0.00' });
sequence.steps.push(newStep);
setSequence({...sequence, steps: [...sequence.steps]});
```

### Remove a Step

```typescript
const updated = sequence.steps.filter(s => s.stepId !== stepToRemove.stepId);
setSequence({...sequence, steps: updated});
```

### Enable/Disable a Step

```typescript
const step = sequence.steps[0];
step.enabled = false;
setSequence({...sequence});
```

### Reorder Steps

```typescript
const steps = [...sequence.steps];
const [step] = steps.splice(dragIndex, 1);
steps.splice(dropIndex, 0, step);
setSequence({...sequence, steps});
```

### Validate

```typescript
import { validateSequence } from '@/transformations';

const result = validateSequence(sequence, TRANSFORM_REGISTRY);
if (!result.valid) {
  console.log('Errors:', result.errors);
  // errors = Map<string, string[]>
  // stepId → [ "param required", "format invalid", ... ]
}
```

### Save Version

```typescript
import { createVersionSnapshot } from '@/transformations';

const version = createVersionSnapshot(sequence, 'Fixed regex pattern');
sequence.versions = [...(sequence.versions || []), version];
sequence.currentVersionId = version.versionId;
```

### Persist to Database

```typescript
import { serializeSequence } from '@/transformations';

const json = serializeSequence(sequence);
await db.transforms.insert({
  id: sequence.id,
  pipelineId: sequence.pipelineId,
  columnId: sequence.columnId,
  sequenceJson: json,  // Store as JSONB
  currentVersionId: sequence.currentVersionId,
});
```

## API Integration

### Database Schema

```sql
CREATE TABLE transforms (
  id UUID PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  column_id UUID NOT NULL,
  column_name TEXT,
  target_engine TEXT,           -- 'spark', 'postgresql', 'redshift'
  sequence_json JSONB NOT NULL, -- Serialized TransformSequence
  current_version_id UUID,
  author_user_uuid UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE transform_versions (
  id UUID PRIMARY KEY,
  transform_id UUID NOT NULL REFERENCES transforms(id),
  version_number INTEGER,
  steps_json JSONB,             -- Serialized TransformStep[]
  change_note TEXT,
  created_at TIMESTAMP
);

CREATE TABLE transform_audits (
  id UUID PRIMARY KEY,
  transform_id UUID NOT NULL,
  action TEXT,                  -- CREATED, MODIFIED, APPLIED, REVERTED, DELETED
  user_uuid UUID,
  timestamp TIMESTAMP,
  details JSONB
);
```

### Backend Routes

```typescript
// Create
POST /api/transforms
{
  pipelineId, columnId, columnName, targetEngine,
  sequenceJson
}

// Read
GET /api/transforms/:id
GET /api/transforms?pipelineId=...&columnId=...

// Update (creates version)
PUT /api/transforms/:id
{
  sequenceJson, changeNote
}

// Get versions
GET /api/transforms/:id/versions

// Revert to version
POST /api/transforms/:id/revert/:versionId

// Preview (with sample data)
POST /api/transforms/:id/preview
{
  sampleData: ["value1", "value2", ...],
  sampleCount: 100
}
```

## Testing Examples

### Unit Test

```typescript
import { compileSequence, createSequence, createStep } from '@/transformations';

describe('Transform Codegen', () => {
  it('chains steps correctly in Spark', () => {
    const seq = createSequence('c1', 'amount', 'p1', 'd1', 'spark');
    seq.steps = [
      createStep('cast', { targetType: 'DECIMAL' }),
      createStep('round', { places: 2, mode: 'HALF_UP' }),
    ];

    const result = compileSequence(seq);
    expect(result.isValid).toBe(true);
    expect(result.sql).toContain('DECIMAL');
    expect(result.sql).toContain('ROUND');
  });
});
```

### Integration Test

```typescript
it('end-to-end: create → edit → save → retrieve', async () => {
  let seq = createSequence('col', 'phone', 'p1', 'd1', 'spark');
  seq.steps.push(createStep('trim', {}));
  seq.steps.push(createStep('to_number', { format: '#,##0' }));

  // Save
  const saved = await saveTransformation(seq);
  expect(saved.id).toBeDefined();

  // Retrieve
  const retrieved = await getTransformation(saved.id);
  expect(retrieved.steps).toHaveLength(2);
});
```

## Performance Tips

1. **Memoize code generation** for large step counts
   ```typescript
   const codePreview = useMemo(() => compileSequence(sequence), [sequence]);
   ```

2. **Virtual scrolling** for >50 steps
   ```typescript
   import { FixedSizeList } from 'react-window';
   ```

3. **Lazy-load param panel** when not needed
   ```typescript
   {showParams && <ParameterPanel ... />}
   ```

4. **Debounce parameter changes** to avoid excessive re-renders
   ```typescript
   const handleChange = useDebouncedCallback(setParams, 300);
   ```

## Troubleshooting

### Code generation returns empty SQL

Check if transform type exists:
```typescript
const prim = getTransform(step.type);
if (!prim) throw new Error(`Unknown transform: ${step.type}`);
```

### Warnings about unsupported engine

```typescript
const supported = isNativelySupported(stepType, 'postgresql');
if (!supported) {
  console.warn('Using fallback, may be inefficient');
}
```

### Serialization loses dates

Manually reconstruct Date objects after deserialization:
```typescript
const seq = deserializeSequence(json);
seq.createdAt = new Date(seq.createdAt);
seq.versions?.forEach(v => {
  v.createdAt = new Date(v.createdAt);
});
```

## Next Steps

1. ✅ Copy files
2. ✅ Create DB schema
3. ✅ Add API routes
4. ✅ Integrate UI components
5. ✅ Write unit tests
6. ✅ Add E2E tests
7. ✅ Document custom transforms (if adding new ones)

## Reference

- [Complete Implementation Guide](./MULTI_TRANSFORM_IMPLEMENTATION_GUIDE.md)
- [Requirements Document](../Docs/multi-transform-requirements.md)
- Component Docstrings (in each `.tsx` file)

---

**Questions?** Check the inline comments in each file or the MULTI_TRANSFORM_IMPLEMENTATION_GUIDE.md for deeper dives.
