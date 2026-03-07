# Push-Down Eligibility System — Implementation Guide

## Overview

The **push-down eligibility system** enables users to strategically choose where each segment of their transformation pipeline executes:
- **Source Database** (fast, limited capabilities)
- **PySpark Cluster** (flexible, slower data movement)

The system analyzes the pipeline graph, detects execution boundaries, enforces function compatibility, and provides real-time UI guidance.

---

## Architecture

### Core Layers

```
┌─────────────────────────────────────────────┐
│        UI Components Layer                   │
│ ┌──────────────────────────────────────────┐ │
│ │ ExecutionPointPanel (choose point)        │ │
│ │ TransformPalette (show functions)         │ │
│ │ IssueResolutionBanner (list issues)       │ │
│ │ PushdownStrategyEditor (integration)      │ │
│ └──────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│        State Management Layer                │
│ ┌──────────────────────────────────────────┐ │
│ │ usePushdownStrategy Hook                  │ │
│ │ ExecutionPointStateManager                │ │
│ └──────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│        Logic Layer                          │
│ ┌──────────────────────────────────────────┐ │
│ │ PushdownEligibilityEngine (analyze)       │ │
│ │ FunctionAvailabilityFilter (check)        │ │
│ │ FunctionCapabilityMatrix (data)           │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── transformations/
│   ├── pushdown/
│   │   ├── CapabilityMatrix.ts           ← Master configuration (17 functions × 6 techs)
│   │   ├── PushdownEligibilityEngine.ts  ← Analyzes pipeline for eligibility
│   │   ├── ExecutionPointState.ts        ← Tracks user choices
│   │   └── FunctionAvailabilityFilter.ts ← Determines available functions
│   ├── ir.ts                             ← Transform sequence types
│   └── ...
├── components/
│   └── transformations/
│       ├── pushdown/
│       │   ├── ExecutionPointPanel.tsx   ← Segment registry + toggle buttons
│       │   ├── IssueResolutionBanner.tsx ← Issues + navigation
│       │   ├── TransformPalette.tsx      ← Function cards with availability
│       └── PushdownStrategyEditor.tsx    ← Integration example (main view)
└── hooks/
    └── usePushdownStrategy.ts            ← Complete state + action hooks
```

---

## Core Components

### 1. CapabilityMatrix

**Purpose:** Master configuration of which functions work in which source technologies.

**Key Exports:**
- `CAPABILITY_MATRIX` — 17 × 6 function-tech matrix
- `getCapability(primitiveId, tech)` — Look up capability
- `isNativeFunctionSupport(id, tech)` — Check native support
- `hasAlternative(id, tech)` — Check if alternative exists

**Example:**
```typescript
const cap = getCapability('if_else', 'oracle');
// { availability: 'alternative', alternativePrimitive: 'case_when', ... }
```

**Supports:** Oracle, PostgreSQL, MySQL, SQL Server, Redshift, Snowflake

---

### 2. PushdownEligibilityEngine

**Purpose:** Analyzes a pipeline to detect:
- Pushdown-eligible segments
- Lineage breaks (PySpark-derived columns)
- Cross-source joins
- Execution boundaries

**Key Methods:**
- `analyze(sourceTables, sequence, userChoices)` → `EligibilityAnalysis`
  - Returns segments with eligibility flags
  - Tracks column lineage (SOURCE_DIRECT vs PYSPARK_DERIVED)
  - Detects cross-source joins

**Result Types:**
```typescript
interface SegmentEligibility {
  segmentId: string;
  eligible: boolean;                    // Can push down
  ineligibilityReasons?: string[];      // Why not
  suggestedExecutionPoint: ExecutionPoint;
  affectedColumns: string[];
  sourceTechnologies: SourceTechnology[];
}
```

---

### 3. ExecutionPointStateManager

**Purpose:** Tracks user's execution point choices and validates changes.

**Key Methods:**
- `initialize(analysis)` — Set up with recommendations
- `getExecutionPoint(stepId)` → `'source' | 'pyspark' | 'forced_pyspark'`
- `previewSwitch(stepId, newPoint, sequence)` → `ExecutionPointSwitchImpact`
  - Shows affected steps and performance impact before change
- `applyExecutionPointChange(stepId, newPoint, sequence)` — Apply change
- `exportConfiguration()` → serializable config for code gen

---

### 4. FunctionAvailabilityFilter

**Purpose:** Determine which functions are available for a given context.

**Key Methods:**
- `filterFunctions(sourceTech, executionPoint)` → `FunctionPalette`
  - Groups into: available, alternatives, unavailable
- `checkFunctionAvailability(funcId, tech, execPoint)` → `FunctionAvailabilityResult`
  - Includes source implementation name, notes, and alternative suggestions
- `validateSegmentFunctions(funcIds, tech, execPoint)` → validation result

**Example:**
```typescript
const result = filter.checkFunctionAvailability('list_agg', 'postgresql', 'source');
// {
//   availability: 'unavailable',
//   message: 'list_agg not in PostgreSQL. Use string_agg instead.',
//   alternativeSuggestion: { ... }
// }
```

---

## UI Components

### ExecutionPointPanel

**Purpose:** Sidebar that shows all segments and allows execution point toggle.

**Features:**
- Segment cards showing eligibility
- Toggle buttons (Source DB, PySpark)
- Impact preview before applying change
- Summary stats (3 pushdown, 2 pyspark, 1 locked)
- Export button for code generation

**Props:**
```typescript
{
  analysis: EligibilityAnalysis;
  stateManager: ExecutionPointStateManager;
  sequence: TransformSequence;
  onExecutionPointChange?: (stepId, newPoint) => void;
  isOpen?: boolean;
}
```

---

### TransformPalette

**Purpose:** Displays available functions with availability badges and suggestions.

**Features:**
- Color-coded badges (✓ Available, ⚠ Alternative, ✗ Unavailable)
- Source implementation names (e.g., "Oracle: LISTAGG(... WITHIN GROUP)")
- One-click alternative recommendations
- Category filtering (string, numeric, date, etc.)
- Preview of unavailable functions for PySpark-bound segments

**Props:**
```typescript
{
  sourceTechnology: SourceTechnology;
  executionPoint: 'source' | 'pyspark' | 'forced_pyspark';
  onSelectFunction: (functionId: string) => void;
  filter?: FunctionAvailabilityFilter;
  selectedFunctionIds?: string[];
  allowUnavailable?: boolean;
}
```

---

### IssueResolutionBanner

**Purpose:** Sticky banner at top listing all incompatibilities with navigation.

**Features:**
- Groups issues by severity (errors, warnings)
- Each issue shows step, problem, and suggestion
- "Go to step" button navigates to problematic step
- Error count blocks save if not resolved
- Dismissible (stored in local state)

**Props:**
```typescript
{
  analysis: EligibilityAnalysis;
  sequence: TransformSequence;
  isVisible?: boolean;
  onDismiss?: () => void;
  onNavigate?: (stepId) => void;
  functionFilter?: FunctionAvailabilityFilter;
}
```

---

### ExecutionPointPanel

**Purpose:** Complete integration example combining all components.

**Features:**
- Pipeline segment visualization
- Side-by-side execution strategy panel
- Selected step's function palette on demand
- Issue banner with auto-hide
- Export/reset actions

---

## Hook: usePushdownStrategy

**Purpose:** Complete state management for pushdown at component level.

**Usage:**
```typescript
const pushdown = usePushdownStrategy();

// 1. Analyze on mount
useEffect(() => {
  pushdown.analyzeEligibility(sourceTables, sequence);
}, [sequence]);

// 2. Get segment analysis
const { analysis, executionPoints } = pushdown.state;

// 3. Change execution point
pushdown.changeExecutionPoint(stepId, 'pyspark');

// 4. Get filtered function palette
const palette = pushdown.getFunctionPalette(stepId);

// 5. Export for code gen
const config = pushdown.exportStrategy();
```

**Returns:**
```typescript
{
  // State
  state: {
    analysis: EligibilityAnalysis | null;
    executionPoints: Map<string, ExecutionPoint>;
    functionPalettes: Map<string, FunctionPalette>;
    isAnalyzing: boolean;
    isValid: boolean;
  };
  
  // Actions
  analyzeEligibility(tables, sequence): Promise<void>;
  changeExecutionPoint(stepId, point): void;
  getFunctionPalette(stepId): FunctionPalette | null;
  hasIssues(): boolean;
  getIssueCount(): number;
  exportStrategy(): { ... };
  importStrategy(config): void;
  reset(): void;
  
  // Managers
  eligibilityEngine: PushdownEligibilityEngine;
  executionPointManager: ExecutionPointStateManager;
  functionFilter: FunctionAvailabilityFilter;
}
```

---

## Data Types

### SegmentEligibility
```typescript
{
  segmentId: string;                         // "segment_0_3"
  stepRange: string;                         // "Step 1-4"
  eligible: boolean;                         // Can push down?
  reasons: string[];                         // Why eligible
  ineligibilityReasons?: string[];           // Why not
  ineligibilityType?: 'function_unsupported' | 'cross_source' | 'lineage_break';
  suggestedExecutionPoint: ExecutionPoint;
  affectedColumns: string[];
  sourceTechnologies: SourceTechnology[];
}
```

### ExecutionPointSwitchImpact
```typescript
{
  valid: boolean;                            // Can make change?
  warnings: string[];
  affectedSteps: string[];                   // Downstream steps affected
  affectedColumns: string[];
  dataMovementRequired: boolean;
  estimatedPerformanceImpact?: 'high' | 'medium' | 'low';
}
```

### FunctionAvailabilityResult
```typescript
{
  functionId: string;                        // 'list_agg'
  label: string;                             // 'List Aggregate'
  availability: 'available' | 'alternative' | 'unavailable';
  canAdd: boolean;
  message?: string;
  alternativeSuggestion?: {
    alternativeId: string;
    alternativeLabel: string;
    reason: string;
  };
  sourceImplementation?: {
    sourceTech: SourceTechnology;
    implementation: string;                  // 'STRING_AGG'
    notes?: string;
  };
}
```

---

## Workflow

### 1. Initialize
```typescript
const pushdown = usePushdownStrategy();

useEffect(() => {
  pushdown.analyzeEligibility(sourceTables, sequence);
}, []);
```

### 2. Display Analysis
```typescript
return (
  <PushdownStrategyEditor
    sequence={sequence}
    sourceTables={sourceTables}
    onStrategyChange={(strategy) => {
      // Save to DB for code generation
    }}
  />
);
```

### 3. User Changes Execution Point
```typescript
// Inside ExecutionPointPanel
const handleSwitch = (newPoint) => {
  const impact = stateManager.previewSwitch(stepId, newPoint, sequence);
  // Show impact preview UI
  
  if (userConfirms) {
    const result = stateManager.applyExecutionPointChange(stepId, newPoint, sequence);
    if (result.success) {
      // Update UI
    }
  }
};
```

### 4. Export for Code Generation
```typescript
const config = pushdown.exportStrategy();
// {
//   analysis: { segments, columnLineage, ... },
//   executionPoints: { 'segment_0_3': 'source', 'segment_4_5': 'pyspark', ... },
//   functionAvailability: { ... }
// }

// Send to backend CodeGen service
await api.generateCode(pipelineId, config);
```

---

## Key Behaviors

### Lineage Break Propagation
When a column is computed in PySpark:
1. It's marked `PYSPARK_DERIVED`
2. All downstream steps referencing it are **forced to PySpark**
3. Override not allowed ("locked" state)
4. User can change earlier step to Source DB to "recover" pushdown

**Example:**
```
Step 1 (Source DB) → col_a
Step 2 (PySpark) → col_b = transform(col_a)
Step 3 ??? — References col_b

// Step 3 is FORCED to PySpark because col_b was derived there
```

### Function Enforcement Levels

| Situation | Availability | Behavior |
|-----------|--------------|----------|
| Native support in source tech | ✓ Available | Can add, executes in source DB |
| Alternative exists (e.g., CASE vs IF_ELSE) | ⚠ Alternative | Can add, uses alternative syntax |
| No equivalent in source tech | ✗ Unavailable | Cannot add to source segment; offer PySpark switch |
| Always PySpark (e.g., regex_extract) | ✗ PySpark Only | Only visible in PySpark segments |

---

## Integration Patterns

### Pattern 1: Inline inside Pipeline Builder
```typescript
export function PipelineBuilder() {
  const pushdown = usePushdownStrategy();
  
  useEffect(() => {
    pushdown.analyzeEligibility(tables, sequence);
  }, [sequence]);
  
  return (
    <>
      <IssueResolutionBanner analysis={pushdown.state.analysis} />
      <div className="flex gap-4">
        <PipelineCanvas sequence={sequence} />
        <ExecutionPointPanel
          analysis={pushdown.state.analysis}
          stateManager={pushdown.executionPointManager}
          onExecutionPointChange={(stepId, point) => {
            pushdown.changeExecutionPoint(stepId, point);
          }}
        />
      </div>
    </>
  );
}
```

### Pattern 2: Dedicated Strategy Tab
```typescript
export function PipelineEditor() {
  const [activeTab, setActiveTab] = useState('design');
  
  return (
    <>
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      
      {activeTab === 'design' && <PipelineCanvas />}
      {activeTab === 'strategy' && (
        <PushdownStrategyEditor sequence={sequence} sourceTables={tables} />
      )}
    </>
  );
}
```

### Pattern 3: Function Palette in Transform Builder
```typescript
export function TransformBuilder() {
  const [selectedStep, setSelectedStep] = useState(null);
  const pushdown = usePushdownStrategy();
  const palette = selectedStep ? pushdown.getFunctionPalette(selectedStep) : null;
  
  return (
    <>
      {palette && (
        <TransformPalette
          sourceTechnology={palette.sourceTechnology}
          executionPoint={palette.executionPoint}
          onSelectFunction={handleAddFunction}
          filter={pushdown.functionFilter}
        />
      )}
    </>
  );
}
```

---

## Testing

### Unit Tests
```typescript
// PushdownEligibilityEngine.test.ts
describe('PushdownEligibilityEngine', () => {
  it('detects cross-source joins', () => {
    const analysis = engine.analyze(
      [table1 (Oracle), table2 (PostgreSQL)],
      sequenceWithJoin
    );
    expect(analysis.crossSourceJoins).toHaveLength(1);
  });
  
  it('propagates lineage breaks', () => {
    const analysis = engine.analyze(tables, sequence);
    const lineage = analysis.columnLineage.get('col_b');
    expect(lineage.origin).toBe('PYSPARK_DERIVED');
  });
});

// FunctionAvailabilityFilter.test.ts
describe('FunctionAvailabilityFilter', () => {
  it('marks list_agg unavailable in PostgreSQL', () => {
    const result = filter.checkFunctionAvailability('list_agg', 'postgresql', 'source');
    expect(result.availability).toBe('unavailable');
  });
  
  it('suggests STRING_AGG as alternative', () => {
    // PostgreSQL users get offered STRING_AGG
  });
});
```

### Integration Tests
```typescript
// PushdownStrategyEditor.test.tsx
it('updates function palette when execution point changes', async () => {
  render(<PushdownStrategyEditor {...props} />);
  
  const pysparkButton = screen.getByText('PySpark');
  fireEvent.click(pysparkButton);
  
  // Should now show all functions including PySpark-only
  await waitFor(() => {
    expect(screen.getByText('Regex Extract')).toBeInTheDocument();
  });
});
```

---

## Notes

- **Function registry extensible:** Add custom functions via `functionFilter.registerFunction()`
- **Capability matrix data-driven:** All tech-specific logic lives in `CAPABILITY_MATRIX`
- **Lineage doesn't persist:** Recalculated on each analysis; user choices override it
- **No code generation here:** This is UI/strategy only; backend receives execution point config
- **Performance:** Engine runs in milliseconds even for large pipelines (optimize segment detection if needed)

---

## Next Steps (Post-UI Implementation)

1. **Code Generation Integration** — Backend CodeGen service reads execution point config and generates per-segment SQL
2. **Column-level Lineage Tracking** — Track origins at column (not just segment) level for finer control
3. **Custom Function Extensions** — Allow users to register custom functions with tech-specific implementations
4. **Performance Profiling** — Show estimated query cost per segment (source vs PySpark)
5. **Visual Pipeline Graph** — Render segments with boundaries, nodes with execution indicators
