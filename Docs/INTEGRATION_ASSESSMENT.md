# Integration Assessment: Transformations → Pipeline Editor → Code Generation

**Date:** March 2, 2026  
**Status:** Partially Integrated (Major Gaps Identified)  
**Assessment Type:** Comprehensive wiring review - all layers

---

## Executive Summary

You've built sophisticated transformation and push-down eligibility systems, BUT they are **not fully wired together** into a cohesive pipeline editor experience. Here's what exists vs. what's missing:

| Layer | Status | Details |
|-------|--------|---------|
| **Database Schema** | ✅ Ready | Pipeline, versions, contents tables exist |
| **Code Generation Engine** | ✅ Ready | Codegen service + PySpark engine registered |
| **API Routes** | ✅ Ready | Pipeline CRUD, validation, code gen endpoints exist |
| **Transform Components** | ✅ Built | TransformStepEditor, MultiTransformEditor exist |
| **Push-Down Engine** | ✅ Built | PushdownEligibilityEngine exists |
| **Function Matrix** | ✅ Built | FunctionMatrixService with 18 numeric functions |
| **Canvas UI** | ✅ Built | PipelineCanvas exists for drag-drop |
| **Validation Logic** | ✅ Partial | Basic exists, but transform-specific missing |
| **Pipeline-to-Transforms Wire** | ❌ **MISSING** | UI doesn't expose transform selection/composition |
| **Transform-to-Codegen Wire** | ❌ **MISSING** | Pipeline IR doesn't include multi-transform metadata |
| **Push-Down Integration** | ❌ **MISSING** | Eligibility engine not used in editor |
| **End-to-End Flow** | ❌ **MISSING** | User can't compose transforms → validate → generate code |

---

## What's Been Built (Good News)

### 1. ✅ Database Layer - Complete
```sql
catalog.pipelines          -- Metadata
  ↓
catalog.pipeline_versions  -- Snapshots
  ↓
catalog.pipeline_contents  -- JSON blob with IR
  └─ ir_payload_json       -- Stores ALL nodes/transforms/edges
  └─ ui_layout_json        -- Frontend state (positions, etc)
```

**Status:** Ready. The schema can store arbitrarily complex transform pipelines.

---

### 2. ✅ Backend API Routes - Complete
```
POST   /api/codegen/generate          -- Generate Spark SQL from pipeline
POST   /api/codegen/validate          -- Validate pipeline IR
POST   /api/pipelines                 -- Create pipeline
GET    /api/pipelines/:id             -- Get pipeline
PUT    /api/pipelines/:id             -- Update pipeline
DELETE /api/pipelines/:id             -- Delete pipeline
POST   /api/pipelines/:id/generate    -- Generate code from this pipeline
POST   /api/pipelines/:id/validate    -- Validate this pipeline
GET    /api/pipelines/:id/artifacts   -- Get generated code artifacts
GET    /api/pipelines/:id/executions  -- Get execution history
```

**Status:** All routes exist with proper error handling.

---

### 3. ✅ Code Generation Service - Ready
```typescript
codegenService.generate(pipeline)      // Returns GeneratedArtifact
codegenService.validate(pipeline)      // Returns ValidationResult
codegenService.supports(technology)    // Check if tech is registered
codegenService.listTechnologies()      // List available targets
```

**Engines Registered:**
- ✅ PySparkEngine (PySpark 3.0+)
- ✅ ScalaSparkEngine (Scala 2.12+)

**Status:** Can consume pipeline IR and emit Spark code.

---

### 4. ✅ Frontend Transform Components - Good Foundation
```
TransformStepEditor.tsx
  ├── SQL Filter Tab (WHERE clauses)
  ├── Column Mapping (select, rename, aggregate)
  ├── Preview (generated SQL + test results)
  └── Error handling

MultiTransformEditor.tsx
  ├── Compose multiple transforms in sequence
  ├── Visual flow UI
  ├── Test intermediate steps
  └── Export composition

PushdownStrategyEditor.tsx
  ├── Show eligibility matrix
  ├── Recommend push-down options
  ├── Select execution point (source vs PySpark)
  └── Validate choice against target
```

**Status:** Components exist but are **orphaned** (not integrated into pipeline editor).

---

### 5. ✅ Push-Down Eligibility Engine - Working
```typescript
const engine = new PushdownEligibilityEngine();

// Check if function can run at source
engine.checkEligibility({
  functionId: 'upper_case',
  targetTechnology: SourceTechnology.ORACLE,
  sourceDatabase: 'Oracle 19c'
});
// Returns: { eligible: true, recommendation: 'PUSH', reason: 'NATIVE' }

// Get alternatives if source doesn't support
engine.alternativeFunctions(functionId, targetTech);
// Returns: [ {function, supportLevel, note} ]
```

**Status:** Logic works, but not called from pipeline editor.

---

### 6. ✅ Canvas & Node Factory - Functional
```
PipelineCanvas.tsx
  ├── Drag table → auto-creates source node ✅
  ├── Connect nodes with edges ✅
  ├── Select nodes ✅
  ├── Show toolbar ✅
  └── Pan/zoom ✅

nodeFactory.ts
  ├── createSourceNode() ✅
  ├── createTransformNode() ✅
  ├── createAggregationNode() ✅
  ├── createJoinNode() ✅
  ├── createTargetNode() ✅
  ├── createUnionNode() ✅
  └── createCustomSQLNode() ✅
```

**Status:** Can create nodes, but transform configuration UI missing.

---

## What's MISSING (Critical Gaps)

### 1. ❌ Transform Configuration Panel
**Problem:** When user selects a transform node on canvas, there's NO UI to:
- Enter filter expressions (WHERE clauses)
- Map/select columns
- Define aggregations
- Test the transform
- See/use push-down eligibility recommendations

**Current:** User selects transform node → nothing happens
**Needed:**  
```typescript
// Show configuration panel when transform node selected
<TransformConfigurationPanel 
  node={selectedNode}
  inputColumns={sourceColumns}
  onUpdate={(config) => {
    // Update the node's config in store
    // Revalidate pipeline
  }}
  pushdownEligibility={eligibilityReport}  // Show recommendations
/>
```

---

### 2. ❌ Multi-Transform Composition in Pipeline
**Problem:** Users can only add single transform nodes. Multi-transform composition (the work you built) is not integrated into the pipeline editor at all.

**Current State:**
```
MultiTransformEditor.tsx exists as standalone component
  └─ No connection to pipeline/nodes/store
```

**Needed:**
```
User clicks "Add Transform" node
  ↓
Opens "Multi-Transform Composer" (in modal or sidebar)
  ├─ User adds String → Date → Numeric transforms
  ├─ Composes them (trim → parse → multiply)
  ├─ Tests intermediate results
  └─ Saves as single node config
  ↓
Transform node on canvas stores entire composition
  ├─ node.config.transforms = [ {...}, {...}, {...} ]
  ├─ node.config.executionPoint = 'SOURCE_ORACLE' | 'PYSPARK'
  └─ node.config.pushdownEligibility = { ... }
```

---

### 3. ❌ No Transform Config Persistence in IR
**Problem:** Pipeline IR (catalog.pipeline_contents.ir_payload_json) doesn't know about transforms yet.

**Current IR Structure (Missing):**
```json
{
  "id": "pipeline-1",
  "nodes": [
    {
      "id": "node-1",
      "type": "source",
      "config": { "connection": "pg-1", "table": "users" }
    },
    {
      "id": "node-2",
      "type": "transform",
      "config": {
        "expression": "age > 18",
        "columnMappings": [{...}],
        "cacheResults": false,
        // ↓ MISSING ↓
        "multiTransforms": [
          {
            "type": "string_trim",
            "params": {"columns": ["name"]}
          },
          {
            "type": "date_parse",
            "params": {"dateCol": "birthdate"}
          }
        ],
        "executionStrategy": {
          "eligibility": "ELIGIBLE",
          "executionPoint": "SOURCE_ORACLE",
          "pushdownCapabilities": {...}
        }
      }
    },
    {
      "id": "node-3",
      "type": "target",
      "config": { "connection": "sf-1", "table": "users_processed" }
    }
  ],
  "edges": [...]
}
```

---

### 4. ❌ Validation Service for Transforms
**Problem:** No backend service to validate transform configurations.

**Missing Service:**
```typescript
// Backend: src/api/services/transform.service.ts (NEEDS CREATION)
class TransformService {
  validateExpression(expression: string, sourcetech: string): ValidationResult
  validateColumnMappings(mappings: ColumnTransform[], sourceColumns: Column[]): ValidationResult
  validateMultiTransform(composition: Transform[]): ValidationResult
  testTransform(config: TransformConfig, sampleData: any[]): TestResult
}
```

---

### 5. ❌ Integration: Editor → Store → DB → Codegen
**Missing:** The complete wiring diagram:

```
User Actions in Pipeline Editor
  ├─ Drag table                           ✅ Works
  ├─ Create transform node                ✅ Works (node created)
  ├─ Click on transform node              ❌ Nothing happens
  │  └─ MISSING: Show config panel
  ├─ Configure filters/mappings           ❌ No UI
  ├─ Add multi-transforms                 ❌ No compose UI
  ├─ Check push-down eligibility          ❌ Not shown
  ├─ Choose execution point (source/spark) ❌ No choice UI
  ├─ Save pipeline                        ✅ Works (but doesn't save transform config!)
  └─ Generate code
     └─ codegen.generate(pipeline)        ✅ Engine ready
        └─ Codegen engine can handle...
           ├─ Source node                 ✅ 
           ├─ Transform node              ❌ MISSING: Multi-transform handling
           ├─ Target node                 ✅
           └─ Edges                       ✅
```

---

### 6. ❌ Push-Down Eligibility in Editor
**Missing:** The push-down UI integration flow:

```
Transform node with filter: age > 18
  ├─ User clicks "Check Eligibility"     ❌ No button
  ├─ Engine checks against target DB
  │  ├─ Can Oracle 19c run it?           ✅ Engine can check
  │  ├─ Can PostgreSQL run it?           ✅ Engine can check
  │  └─ Can push to source?               ✅ Engine can check
  └─ Show recommendation UI              ❌ Not implemented
     ├─ "✓ Eligible for Oracle push-down"
     ├─ "⚠️ Limited in MySQL (alternative: ...)"
     └─ "❌ Not supported in SQL Server (must use PySpark)"
```

---

### 7. ❌ Error Handling for Invalid Transforms
**Missing:** Transform-specific error codes and messaging:

```typescript
// From CLAUDE.md Error Standards, we should have:
// But MISSING are TRANSFORM-specific ones

VALIDATION / NOT_FOUND / CONFLICT / AUTH
  ├─ TRANSFORM-001: Expression is required
  ├─ TRANSFORM-002: Invalid SQL syntax
  ├─ TRANSFORM-003: Column mapping validation failed
  ├─ TRANSFORM-004: Source column not found
  ├─ TRANSFORM-005: Aggregation target column required
  ├─ TRANSFORM-006: Duplicate target column name
  ├─ TRANSFORM-007: Multi-transform composition invalid
  ├─ TRANSFORM-008: Push-down not eligible for target
  └─ TRANSFORM-009: Execution point not supported
```

---

## Current Integration State (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PIPELINE EDITOR UI                         │
├─────────────────────────────────────────────────────────────────────┤
│  PipelineCanvas                                                       │
│  ├─ Drag table → creates source node        ✅                      │
│  ├─ Add transform node                      ✅                      │
│  ├─ Click transform → show config panel     ❌ MISSING              │
│  ├─ TransformConfigurationPanel             ❌ MISSING              │
│  ├─ MultiTransformComposer modal            ❌ NOT INTEGRATED       │
│  ├─ PushdownStrategyPanel                   ❌ NOT INTEGRATED       │
│  └─ Test transform                          ❌ MISSING              │
└─────────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      REDUX STATE (Pipeline Store)                     │
├─────────────────────────────────────────────────────────────────────┤
│  nodes: {                                                             │
│    'source-1': { type: 'source', config: {...} }        ✅         │
│    'transform-1': {                                                   │
│      type: 'transform',                                              │
│      config: {                                                        │
│        expression: '',          ❌ Empty/never filled               │
│        columnMappings: [],       ❌ Empty/never filled               │
│        // ❌ MISSING these:                                          │
│        multiTransforms: [],      ❌ Not in schema                    │
│        executionStrategy: {},    ❌ Not in schema                    │
│        pushdownEligibility: {}   ❌ Not in schema                    │
│      }                                                                │
│    }                                                                  │
│    'target-1': { type: 'target', config: {...} }        ✅         │
│  }                                                                    │
│  edges: [...]                                            ✅         │
└─────────────────────────────────────────────────────────────────────┘
  ↓ (Save)
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (catalog.pipeline_contents)               │
├─────────────────────────────────────────────────────────────────────┤
│  ir_payload_json: {                                                   │
│    nodes: [                                                           │
│      { id: 'source-1', type: 'source', ... }  ✅ Stored             │
│      { id: 'transform-1', config: {           ❌ Empty!             │
│        expression: ''              ← User never filled this          │
│      }}                                                               │
│      { id: 'target-1', type: 'target', ... }  ✅ Stored             │
│    ]                                                                  │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
  ↓ (Generate)
┌─────────────────────────────────────────────────────────────────────┐
│                     CODE GENERATION ENGINE                           │
├─────────────────────────────────────────────────────────────────────┤
│  codegenService.generate(pipeline)                                    │
│    ├─ PySparkEngine.generate()       ✅ Ready                        │
│    ├─ Processes source node          ✅ Works                        │
│    ├─ Processes transform            ❌ Can't - config is empty!    │
│    └─ Processes target node          ✅ Works                        │
│  Result: INCOMPLETE Spark code       ❌ Can't compile               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist: What Needs to Be Wired

### Phase 1: Transform Configuration UI (CRITICAL)
- [ ] Create `TransformConfigurationPanel.tsx` component
  - [ ] SQL filter expression editor with syntax highlighting
  - [ ] Column mapping interface (source → target)
  - [ ] Aggregation selector (SUM, COUNT, AVG, etc.)
  - [ ] Test button with sample execution
  - [ ] Display validation errors with codes (TRANSFORM-00X)

- [ ] Wire to Redux store
  - [ ] Dispatch node config updates
  - [ ] Dispatch validation after each change
  - [ ] Trigger revalidation of entire pipeline

- [ ] Show in pipeline editor
  - [ ] Detect when transform node selected
  - [ ] Mount panel in right sidebar
  - [ ] Sync panel ↔ store ↔ node

### Phase 2: Multi-Transform Integration (CRITICAL)
- [ ] Integrate `MultiTransformEditor.tsx` into pipeline editor
  - [ ] "Add Multi-Transform" button in toolbar
  - [ ] Opens composer in modal
  - [ ] User builds transform sequence
  - [ ] Saves as `node.config.multiTransforms[]`

- [ ] Update IR schema (store + backend)
  - [ ] `node.config.transforms: Transform[]`
  - [ ] `node.config.executionStrategy: ExecutionStrategy`
  - [ ] `node.config.pushdownEligibility: EligibilityReport`

- [ ] Update Redux state schema
  - [ ] `pipelineSlice` node type includes multi-transform fields
  - [ ] Actions to add/remove/reorder transforms

### Phase 3: Push-Down Integration (CRITICAL)
- [ ] Integrate `PushdownStrategyEditor.tsx` into Transform panel
  - [ ] Show after transform is configured
  - [ ] "Check Eligibility" button to run engine
  - [ ] Display recommendation UI:
    - [ ] "✓ Push this transform to Oracle"
    - [ ] "⚠️ Partial support in MySQL (use alternative)"
    - [ ] "❌ Not supported in SQL Server (evaluate in PySpark)"
  - [ ] User can override recommendation with warning
  - [ ] Save choice in `node.config.executionStrategy`

- [ ] Create `PushdownEligibilityService` (backend)
  - [ ] Endpoint: `POST /api/transforms/check-eligibility`
  - [ ] Input: transform config + target technology
  - [ ] Output: EligibilityReport with recommendation
  - [ ] Calls PushdownEligibilityEngine

### Phase 4: Backend Transform Service (CRITICAL)
- [ ] Create `src/api/services/transform.service.ts`
  - [ ] `validateExpression(expr, sourceTech): ValidationResult`
  - [ ] `validateColumnMappings(mappings, schema): ValidationResult`
  - [ ] `validateMultiTransformComposition(transforms): ValidationResult`
  - [ ] `executeTest(config, sampleRows): TestResult`

- [ ] Create `src/api/controllers/transform.controller.ts`
  - [ ] `POST /api/transforms/validate`
  - [ ] `POST /api/transforms/test`
  - [ ] `POST /api/transforms/check-eligibility`

### Phase 5: Code Generation for Multi-Transforms (CRITICAL)
- [ ] Update Codegen engines to handle multi-transforms
  - [ ] `PySparkEngine`: Handle transform sequence
    - [ ] Apply each transform in order
    - [ ] Insert pandas/UDF if push-down not eligible
    - [ ] Generate Spark SQL or PySpark code

  - [ ] Update transform node handler
    - [ ] If `multiTransforms` present, process each
    - [ ] Respect `executionStrategy.executionPoint`
    - [ ] Fallback to PySpark if source doesn't support

- [ ] Validation in codegen
  - [ ] Check all transforms are valid before generation
  - [ ] Ensure source supports all functions
  - [ ] Validate column transformations form valid lineage

### Phase 6: Validation & Error Handling (IMPORTANT)
- [ ] Create error codes (TRANSFORM-001 through TRANSFORM-009)
  - [ ] Add to `Backend/src/shared/errors/catalog/transform.errors.ts`
  - [ ] Add user-friendly messages
  - [ ] Add logging with correlationId

- [ ] Pipeline validation includes transforms
  - [ ] When saving pipeline, validate all transform configs
  - [ ] Return detailed error report
  - [ ] Prevent save if ANY transform invalid

### Phase 7: Testing & Integration Tests (IMPORTANT)
- [ ] Frontend component tests
  - [ ] TransformConfigurationPanel renders
  - [ ] Column mapping works
  - [ ] Validation displays errors
  - [ ] Multi-transform composer integrates

- [ ] Backend service tests
  - [ ] Transform validation works
  - [ ] Push-down eligibility checks
  - [ ] Code generation produces valid Spark

- [ ] Integration tests
  - [ ] End-to-end: User creates pipeline with multi-transforms → generates code
  - [ ] Test edge cases:
    - [ ] Transform with no source support (force PySpark)
    - [ ] Partial support (show alternatives)
    - [ ] Complex multi-transform sequence

---

## Recommended Wiring Order

### Priority Level: CRITICAL (Do First)

**1. Transform Configuration Panel** (4-6 hours)
   - Until this is done, users can't configure transforms at all
   - Blocks everything downstream

**2. Backend Transform Validation Service** (3-4 hours)
   - Required for panel to validate user input
   - Unblocks Push-Down integration

**3. Multi-Transform in IR Schema** (2-3 hours)
   - Update Redux store and database schema
   - Required for persistence

**4. Push-Down Integration** (4-5 hours)
   - Show eligibility UI in panel
   - Call backend service

**5. Code Generation for Multi-Transforms** (6-8 hours)
   - Update engines to handle transforms
   - Test with actual Spark

### Priority Level: IMPORTANT (Do Second)

**6. Transform Test Execution** (4-5 hours)
   - Let users test transforms with sample data
   - Show row counts, execution time, sample results

**7. Error Handling & Codes** (2-3 hours)
   - Proper error messages
   - User-friendly guidance

**8. Integration Tests** (6-8 hours)
   - Full pipeline with transforms → code → execution

### Priority Level: NICE-TO-HAVE (Do Last)

**9. Performance Optimization** (3-4 hours)
   - Cache validation results
   - Lazy evaluation of expensive checks

**10. Advanced Features** (Depends)
   - Transform templates/presets
   - Transform reusability/library
   - Transform versioning

---

## Timeline Estimate

**Total Wiring Work:** 42-60 hours

| Phase | Hours | Dependencies |
|-------|-------|--------------|
| 1. Transform Config Panel | 4-6 | None |
| 2. Backend Validation | 3-4 | Phase 1 |
| 3. IR Schema Update | 2-3 | Phase 2 |
| 4. Push-Down UI | 4-5 | Phase 2-3 |
| 5. Codegen Multi-Transform | 6-8 | Phase 3 |
| 6. Test Execution | 4-5 | Phase 5 |
| 7. Error Codes | 2-3 | All phases |
| 8. Integration Tests | 6-8 | All above |
| **TOTAL** | **32-42 hours** | Sequential |

If parallelized (phases 2-3 while phase 1 in progress):
- **Realistic Timeline:** 2-3 weeks of solid development

---

## Key Dependencies & Blockers

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRANSFORM CONFIG PANEL                   │
│        (Must exist before anything else can work)               │
├─────────────────────────────────────────────────────────────────┤
│ Blocked by: Nothing                                              │
│ Blocks: Multi-transform, Push-down UI, Codegen, Everything      │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│                BACKEND VALIDATION SERVICE                        │
│    (Panel needs this to validate while user types)              │
├─────────────────────────────────────────────────────────────────┤
│ Blocked by: Transform Config Panel (UI exists first)             │
│ Blocks: Push-down service, code generation                      │
└─────────────────────────────────────────────────────────────────┘
         ↓ (in parallel with above)
┌─────────────────────────────────────────────────────────────────┐
│              IR SCHEMA & REDUX UPDATE                            │
│       (So transform configs can be serialized)                  │
├─────────────────────────────────────────────────────────────────┤
│ Blocked by: (can start immediately)                              │
│ Blocks: Saving transforms, Codegen                              │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│          PUSH-DOWN ELIGIBILITY SERVICE & UI                      │
│   (Show eligibility after transform is configured)              │
├─────────────────────────────────────────────────────────────────┤
│ Blocked by: Validation Service + IR Schema                       │
│ Blocks: Code generation with push-down awareness                │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│        UPDATE CODEGEN ENGINES (Multi-Transform Support)         │
│       (So generated code handles composed transforms)           │
├─────────────────────────────────────────────────────────────────┤
│ Blocked by: IR Schema, Transform Validation                      │
│ Blocks: Working end-to-end pipelines                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### User Can:

- ✅ Create a pipeline by dragging tables
- ✅ Add a transform node
- ✅ Click transform → open configuration panel
- ✅ Enter SQL filter expression with live validation
- ✅ Map source columns to output columns
- ✅ Add aggregations (SUM, COUNT, etc.)
- ✅ Click "Add Multi-Transform" → compose string + date + type transforms
- ✅ Click "Check Eligibility" → see if source DB supports transforms
- ✅ Choose execution point (Source Oracle or PySpark)
- ✅ Save pipeline with all transform configurations
- ✅ Generate Spark code that implements the transforms
- ✅ See generated code includes multi-transform logic
- ✅ See push-down functions in Spark SQL when eligible
- ✅ See fallback to PySpark when not eligible

### System Does:

- ✅ Persist transform config in IR JSON
- ✅ Validate transforms before allowing save
- ✅ Report validation errors with codes (TRANSFORM-00X)
- ✅ Check push-down eligibility against target DB
- ✅ Generate correct Spark code for each execution strategy
- ✅ Test transforms with sample data before pipeline execution
- ✅ Handle errors throughout with proper logging + user messages

---

## Honest Assessment

**You've built excellent individual components:**
- Transform editors (multi-transform composer)
- Push-down eligibility engine
- Function matrix system
- Code generation infrastructure

**But they're not talking to each other:**
- User can't actually USE these features in the pipeline editor
- Transform configs don't persist
- Code generation doesn't know about multi-transforms
- Push-down recommendations aren't shown

**This is typical of distributed development:**
- Front-end team built UI components
- Push-down team built eligibility engine
- Function team built matrix system
- Code-gen team built engines
- *But no one "wired the breaker panel"*

**To fix:** Implement the Integration Checklist above. Start with Transform Configuration Panel - that's the linchpin. Everything depends on it.

---

## Questions to Answer

1. **Do you want to wire everything or start fresh with different architecture?**
   - Current approach works, but requires the 42-60 hours of integration work

2. **Should multi-transforms be first-class nodes or embedded in single nodes?**
   - Currently: Single "transform" node can contain multiple transforms
   - Alternative: Each step is a separate node in DAG
   - Recommendation: Current approach (simpler, maps to function composition concept)

3. **Should push-down eligibility block code generation or just warn?**
   - Current design: Warn, but allow generation (falls back to PySpark)
   - Alternative: Block if any function not supported
   - Recommendation: Warn (more flexible, gives user choice)

4. **Who will do the integration work?**
   - Frontend team: Transform Config Panel + Multi-Transform integration + UI
   - Backend team: Validation service + Codegen updates + Tests
   - Suggested split: 40% frontend, 60% backend

---

## Next Steps

1. **Acknowledge this assessment** with your team
2. **Make architecture decisions** (questions above)
3. **Allocate resources** (which team, when, how many hours)
4. **Start with Transform Config Panel** - highest priority
5. **Work backward from success criteria**
6. **Test after each phase**

This assessment explains why you can build pipelines but can't actually configure or compose transformations. The pieces exist; they just need to be connected.

