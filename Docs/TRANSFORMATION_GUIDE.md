# Pipelines & Transformations Guide

## Overview

The ETL1 pipeline builder includes comprehensive support for designing and executing Spark transformations, with drag-and-drop table creation and interactive transformation building.

## Features Implemented

### 1. Drag & Drop Table Creation

**From Metadata Tree to Canvas:**
- Drag any table from the Metadata Catalog to the pipeline canvas
- Automatically creates a **source node** with connection details
- Connector ID and schema are extracted and populated
- Drop position becomes the node's placement on canvas

**Implementation:**
```typescript
// MetadataTree.tsx - Extracts parent metadata
const { connectorId, schema } = getParentMetadata(node.id, SAMPLE_TREE);

// PipelineCanvas.tsx - Creates source node at drop location
const newNode = createSourceNode(
  draggedItem.connectorId,
  draggedItem.schema,
  draggedItem.label,
  { x, y }
);
```

**Usage:**
1. Open Metadata Catalog (left sidebar)
2. Expand Connectors → select connector → select schema → select table
3. Drag table to canvas
4. Source node automatically created with configuration

---

### 2. Transformation Builder Component

**File:** `src/components/transformations/TransformationBuilder.tsx`

**Capabilities:**
- **SQL Filter Tab**: Write WHERE clauses to filter rows
- **Column Mapping Tab**: Select, rename, and aggregate columns
- **Preview Tab**: See generated SQL and test results

**Props:**
```typescript
interface TransformationBuilderProps {
  inputColumns: Column[];           // Available input columns
  outputColumns: Column[];          // Mapped output columns
  currentExpression: string;        // WHERE clause
  currentMappings: ColumnTransform[]; // Column mappings
  onExpressionChange: (expr: string) => void;
  onMappingsChange: (mappings: ColumnTransform[]) => void;
  onTest: () => void;
  testResults?: any;
}
```

**Column Transform Structure:**
```typescript
interface ColumnTransform {
  source: Column;                    // Input column
  target: string;                    // Output column name
  expression?: string;               // Custom expression
  aggregation?: 'none' | 'sum' | 'count' | 'avg' | 'max' | 'min' | 'collect_list';
}
```

---

### 3. Node Factory Utilities

**File:** `src/utils/nodeFactory.ts`

**Available Node Types:**

#### Source Node
```typescript
createSourceNode(
  connectorId: string,
  schema: string,
  table: string,
  opts?: NodeFactoryOptions
): Node

// Example
const sourceNode = createSourceNode('pg-1', 'public', 'users', {
  x: 100,
  y: 100
});
```

#### Transform Node
```typescript
createTransformNode(
  name?: string,
  opts?: NodeFactoryOptions
): Node
```

#### Aggregation Node
```typescript
createAggregationNode(
  groupByColumns?: string[],
  opts?: NodeFactoryOptions
): Node
```

#### Join Node
```typescript
createJoinNode(
  leftTable: string,
  rightTable: string,
  joinType?: string, // 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  opts?: NodeFactoryOptions
): Node
```

#### Target Node
```typescript
createTargetNode(
  connectorId: string,
  table: string,
  writeMode?: string, // 'OVERWRITE' | 'APPEND' | 'MERGE'
  opts?: NodeFactoryOptions
): Node

// Example
const targetNode = createTargetNode('sf-1', 'output_table', 'OVERWRITE', {
  x: 700,
  y: 100
});
```

#### Union Node
```typescript
createUnionNode(
  unionType?: string, // 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT'
  opts?: NodeFactoryOptions
): Node
```

#### Custom SQL Node
```typescript
createCustomSQLNode(
  sql?: string,
  opts?: NodeFactoryOptions
): Node
```

**Helper Functions:**
```typescript
// Get recommended next node types
getNextNodeType(currentType: string): string[]

// Calculate auto-position for new nodes
calculateAutoPosition(existingNodes: Node[]): { x: number; y: number }

// Create node from metadata item
createNodeFromMetadataItem(
  item: MetadataItem,
  connectorId?: string,
  schema?: string,
  position?: { x: number; y: number }
): Node | null
```

---

### 4. Pipeline Node Types

#### Source Node
Reads data from a connector.

**Configuration:**
```typescript
config: {
  connectionId: string;      // Connector ID
  schema: string;            // Schema name
  table: string;             // Table name
  selectAll?: boolean;       // Read all columns
}
```

#### Transform Node
Applies row-level transformations and filtering.

**Configuration:**
```typescript
config: {
  expression: string;                // WHERE clause
  columnMappings: ColumnTransform[]; // Column mappings
  cacheResults?: boolean;            // Cache outputs
}
```

**Validation:**
- Expression required
- SQL syntax validation
- Column mappings validated

#### Aggregation Node
Performs GROUP BY and aggregate functions.

**Configuration:**
```typescript
config: {
  groupByColumns: string[];    // GROUP BY columns
  aggregations: {              // Aggregate functions
    [columnName: string]: string; // e.g., { 'revenue': 'SUM' }
  };
}
```

#### Join Node
Combines data from multiple inputs.

**Configuration:**
```typescript
config: {
  leftTable: string;
  rightTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  joinCondition: string;       // ON clause
  isMultipleInputsAllowed: boolean;
}
```

#### Target Node
Writes data to a connector.

**Configuration:**
```typescript
config: {
  connectionId: string;        // Connector ID
  table: string;               // Table name
  writeMode: 'OVERWRITE' | 'APPEND' | 'MERGE';
  partitionColumns?: string[]; // PARTITION BY
  bucketColumns?: string[];    // DISTRIBUTE BY
}
```

#### Union Node
Combines multiple datasets.

**Configuration:**
```typescript
config: {
  unionType: 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT';
  isMultipleInputsAllowed: boolean;
}
```

#### Custom SQL Node
Executes raw SQL.

**Configuration:**
```typescript
config: {
  sql: string;      // SQL statement
  readOnly: boolean; // Is SQL editable
}
```

---

### 5. Transformation Validation

All transformations are validated against `transformNodeValidations` from `ValidationRules.ts`:

**Validations:**
- ✅ Expression required (TRANSFORM-001)
- ✅ SQL syntax checking (TRANSFORM-002)
- ✅ Column mappings (at least one) (TRANSFORM-003)
- ✅ Source column not empty (TRANSFORM-004)
- ✅ Target column not empty (TRANSFORM-005)
- ✅ No duplicate target columns (TRANSFORM-006)

**Error Codes:**
All validation errors follow the pattern `TRANSFORM-XXX` for tracking and analytics.

---

## Workflow Examples

### Example 1: Simple Extract-Transform-Load (ETL)

```
┌──────────────┐      ┌───────────────┐      ┌──────────────┐
│ Read Customers       Filter (age > 18)    Write Processed  │
│  (source node)       (transform node)      (target node)     │
└──────────────┘      └───────────────┘      └──────────────┘
        │                     │                      │
        └─────────────────────┴──────────────────────┘
```

**Steps:**
1. Drag `customers` table → creates source node
2. Add transform node (Ctrl+Shift+T)
3. Configure filter: `age > 18`
4. Map columns: `customer_id → id`, `name → customer_name`
5. Add target node to write to `customers_filtered`

---

### Example 2: Aggregation Pipeline

```
┌──────────────────┐      ┌────────────────────┐      ┌──────────────┐
│ Read Order Items │      │ Group by Customer  │      │ Write Daily  │
│                  │ ───→ │ Sum Revenue        │ ───→ │ Totals       │
│ (source node)    │      │ (aggregation node) │      │ (target node)│
└──────────────────┘      └────────────────────┘      └──────────────┘
```

**Steps:**
1. Source: `order_items` (Postgres)
2. Aggregation node with:
   - GROUP BY: `customer_id`
   - Aggregations: `SUM(revenue)`, `COUNT(*)`
3. Target: `daily_customer_totals` (Snowflake)

---

### Example 3: Join & Enrichment

```
┌────────────────┐
│ Read Users     │
│ (source: PG)   │
└────────────────┘
         │
         ▼
     ┌────────────┐
     │   JOIN     │
     │   (on id)  │
     └────────────┘
         ▲
         │
┌────────────────┐
│ Read Profiles  │
│ (source: S3)   │
└────────────────┘
         
         ▼
    ┌─────────┐
    │Transform│ (select, rename)
    └─────────┘
         │
         ▼
   ┌────────────────┐
   │ Write Enriched │
   │ Users to DW    │
   └────────────────┘
```

**Steps:**
1. Create 2 source nodes (users, profiles)
2. Join node: INNER JOIN on `id`
3. Transform: select and rename columns
4. Target: write to `enriched_users`

---

## Drag & Drop Detailed Guide

### Supported Items
- ✅ **Tables**: Creates source node automatically
- ❌ **Columns**: Not supported (future: for column-level lineage)
- ❌ **Schemas**: Not supported
- ❌ **Connectors**: Not supported

### Visual Feedback
- **Hover**: Table row highlights with blue border
- **Dragging**: Cursor shows copy icon
- **Over Canvas**: Canvas border becomes dashed primary blue
- **Drop**: Source node appears at drop location

### Smart Features
- ✅ Connector ID automatically populated
- ✅ Schema automatically extracted from hierarchy
- ✅ Node positioned at exact drop location
- ✅ Node automatically selected after creation
- ✅ Connector metadata preserved in config

---

## Integration with Properties Panel

When a transform node is selected:

1. **Configuration Tab** displays:
   - SQL expression editor with syntax validation
   - Test Transform button (disabled until valid)
   - Test results with row counts and execution time

2. **Schema Tab** displays:
   - Column mapping interface
   - Drag source → drop target columns
   - Visual feedback on mappings

3. **Advanced Tab** displays:
   - Cache results toggle
   - Partition key input
   - Resource hints

---

## Testing Transformations

### In Properties Panel

1. Click **Configuration** tab on selected transform node
2. Enter SQL expression in editor
3. Click **▶️ Test Transform** button
4. View results:
   - ✓ Rows success
   - ✗ Rows error
   - ⏱️ Execution time

### Via TransformationBuilder Component

```typescript
<TransformationBuilder
  inputColumns={[
    { name: 'user_id', type: 'INTEGER' },
    { name: 'email', type: 'STRING' }
  ]}
  outputColumns={[]}
  currentExpression="age > 18"
  currentMappings={[...]}
  onTest={() => runTransformTest()}
  testResults={testResults}
/>
```

---

## Error Handling

### Validation Errors
Display with red borders and error text:
- "Expression is required"
- "Invalid SQL syntax"
- "Duplicate target column"

### Execution Errors
Display in test results:
- Query execution failed
- Column not found
- Type mismatch

### Resolution
1. Check error message and code (e.g., TRANSFORM-002)
2. Refer to validation guide above
3. Fix and re-test

---

## Performance Tips

1. **Aggregate early**: Filter/group as close to source as possible
2. **Cache intermediate results**: Enable cache on expensive transforms
3. **Partition wisely**: Partition by high-cardinality columns
4. **Test incrementally**: Test each transform node individually
5. **Use hints**: Provide resource hints for complex operations

---

## Future Enhancements

- [ ] Column-level drag-drop for lineage
- [ ] Python UDF support in transforms
- [ ] Window functions in aggregations
- [ ] Incremental load patterns
- [ ] Data quality checks in pipeline
- [ ] Monitoring and alerting integration
- [ ] Version control for pipelines
- [ ] Multi-output nodes (fan-out patterns)
