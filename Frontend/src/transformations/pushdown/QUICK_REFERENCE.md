# Function Matrix - Quick Reference & Implementation Checklist

## TL;DR - 5-Minute Category Implementation

### Step 1: Create File
```bash
# Create: src/transformations/pushdown/config/functions_<category>.ts
touch functions_string_text.ts  # example
```

### Step 2: Use Template Below
```typescript
import { FunctionEntry, FunctionCategory, SourceTechnology, SupportLevel, capability, functionEntry } from '../FunctionMatrixTypes';

export const stringTextFunctions: FunctionEntry[] = [
  functionality(
    'function_id',
    'Display Label',
    FunctionCategory.STRING_TEXT,
    'What it does',
    {
      [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'SYNTAX'),
      [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'syntax'),
    },
    { priority: 'high' }
  ),
  // ... more functions
];
```

### Step 3: Update Service
Edit `FunctionMatrixService.ts`:
```typescript
// Add import at top
import { stringTextFunctions } from './config/functions_string_text';

// In loadFunctions() method, add to functions array:
this.functions = [
  ...numericMathFunctions,
  ...stringTextFunctions,  // NEW
];
```

### Step 4: Enable Flag
Edit `FunctionMatrixService.ts` DEFAULT_FEATURE_FLAGS:
```typescript
[FunctionCategory.STRING_TEXT]: true,  // Change from false
```

### Step 5: Verify
Browser console:
```javascript
window.functionMatrixDev.printCurrentState()
window.functionMatrixDev.listCategory('string_text')
window.functionMatrixDev.validateMatrix()
```

---

## Support Level Quick Reference

| Level | Use For | Example |
|-------|---------|---------|
| `NATIVE` | Direct support | `UPPER(str)` |
| `ALTERNATIVE` | Different syntax, same result | `MOD() vs %` |
| `PARTIAL` | Works with limitations | `Limited in Redshift` |
| `NONE` | Not supported | Must use PySpark |
| `PYSPARK_ONLY` | PySpark exclusive | No DB equivalent |
| `UDF_REQUIRED` | Needs custom function | Advanced only |

---

## Technologies Reference

```typescript
SourceTechnology.ORACLE       // Amazon RDS Oracle 19c+
SourceTechnology.POSTGRESQL   // PostgreSQL 12+
SourceTechnology.MYSQL        // MySQL 5.7+
SourceTechnology.SQLSERVER    // SQL Server 2019+
SourceTechnology.REDSHIFT     // Amazon Redshift
SourceTechnology.SNOWFLAKE    // Snowflake
SourceTechnology.PYSPARK      // PySpark 3.0+
```

---

## Categories Reference

```typescript
FunctionCategory.NUMERIC_MATH              // ✅ DONE (18)
FunctionCategory.STRING_TEXT               // ⏳ 48 functions
FunctionCategory.DATE_TIME                 // ⏳ 52 functions
FunctionCategory.TYPE_CONVERSION           // ⏳ 18 functions
FunctionCategory.CONDITIONAL_LOGIC         // ⏳ 10 functions
FunctionCategory.NULL_HANDLING             // ⏳ 8 functions
FunctionCategory.AGGREGATE                 // ⏳ 24 functions
FunctionCategory.WINDOW_ANALYTICAL         // ⏳ 22 functions
FunctionCategory.RANKING                   // ⏳ 8 functions
FunctionCategory.CONCATENATION             // ⏳ 8 functions
FunctionCategory.REGEX                     // ⏳ 10 functions
FunctionCategory.HIERARCHICAL_RECURSIVE    // ⏳ 8 functions
FunctionCategory.ARRAY_COLLECTION          // ⏳ 22 functions
FunctionCategory.JSON                      // ⏳ 16 functions
FunctionCategory.ENCODING_HASHING          // ⏳ 12 functions
FunctionCategory.STATISTICAL               // ⏳ 14 functions
FunctionCategory.TECHNOLOGY_SPECIFIC       // ⏳ varies
```

---

## Common Syntax Patterns

### Oracle → Others Cheat Sheet

| Oracle | PostgreSQL | MySQL | SQL Server | Snowflake |
|--------|-----------|-------|-----------|-----------|
| `SUBSTR(s,p,l)` | `SUBSTRING(s FROM p FOR l)` | `SUBSTRING(s,p,l)` | `SUBSTRING(s,p,l)` | `SUBSTRING(s,p,l)` |
| `INSTR(s,ss)` | `POSITION(ss IN s)` | `LOCATE(ss,s)` | `CHARINDEX(ss,s)` | `POSITION(ss IN s)` |
| `TO_CHAR(d,'fmt')` | `TO_CHAR(d,'fmt')` | `DATE_FORMAT(d,'fmt')` | `FORMAT(d,'fmt')` | `TO_VARCHAR(d,'fmt')` |
| `TO_DATE(s,'fmt')` | `TO_TIMESTAMP(s,'fmt')` | `STR_TO_DATE(s,'fmt')` | `CONVERT(date,s,fmt)` | `TO_TIMESTAMP(s,'fmt')` |
| `SYSDATE` | `CURRENT_DATE` | `CURDATE()` | `GETDATE()` | `CURRENT_DATE()` |
| `NVL(a,b)` | `COALESCE(a,b)` | `IFNULL(a,b)` | `ISNULL(a,b)` | `COALESCE(a,b)` |

---

## Function Entry Template (Expanded)

```typescript
functionEntry(
  'function_id',                      // String: kebab-case identifier (unique!)
  'User Facing Label',                // String: How it appears in UI
  FunctionCategory.CATEGORY,          // Enum: Which category
  'Description of what this does',    // String: Clear purpose
  {
    [SourceTechnology.ORACLE]: capability(
      SupportLevel.NATIVE,            // Enum: Support level
      'ORACLE_SYNTAX(param)',         // String: Exact SQL syntax
      {                               // Optional metadata
        notes: 'Special notes',
        example: 'SELECT syntax(col) FROM table',
        alternative: 'ALT_SYNTAX() if needed',
        minVersion: '12.0',
        disablePushdown: false,        // Force PySpark evaluation
        uiBehavior: 'Show warning badge',
      }
    ),
    // ... repeat for each technology
    [SourceTechnology.PYSPARK]: capability(
      SupportLevel.NATIVE,
      'pyspark_function(col)',
      {
        example: 'df.select(pyspark_function(col(\'col_name\')))',
      }
    ),
  },
  {
    priority: 'high',                 // 'high' | 'medium' | 'low'
    notes: 'Cross-tech notes here',
    relatedFunctions: ['other_fn_id'],
    tested: true,                     // Only if actually tested
  }
)
```

---

## Validation Checklist

Before pushing changes:

```javascript
// Every function MUST satisfy ALL of these:
const checklist = {
  hasId: true,                        // Unique string
  hasnLabel: true,                    // User-facing label
  hasCategory: true,                  // Valid FunctionCategory
  hasDescription: true,               // Clear purpose
  hasAllTechnologies: true,           // All 7 covered
  allSyntaxesValid: true,             // Match official docs
  noDuplicateIds: true,               // Unique across all categories
  hasValidSupportLevels: true,        // Valid enum values
  relatedFunctionsExist: true,        // If specified, must be valid
};

// Run this in browser:
window.functionMatrixDev.validateMatrix();
// MUST return: { isValid: true, errors: [], warnings: [] }
```

---

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feat/function-matrix-string-text

# 2. Create the config file
touch src/transformations/pushdown/config/functions_string_text.ts

# 3. Add entries following template

# 4. Update FunctionMatrixService.ts imports

# 5. Update feature flags in FunctionMatrixService.ts

# 6. Test in browser, validate

# 7. Commit (atomic)
git add -A
git commit -m "feat: add 48 string/text functions to matrix"

# 8. Push
git push origin feat/function-matrix-string-text
```

---

## Testing in Browser Console

```javascript
// === QUICK CHECKS ===

// 1. See what's loaded
window.functionMatrixDev.printCurrentState();

// 2. Check specific category
window.functionMatrixDev.listCategory('string_text');

// 3. Show single function details
window.functionMatrixDev.showFunction('upper_case');

// 4. Validate everything
const report = window.functionMatrixDev.validateMatrix();
console.assert(report.isValid, 'Validation failed!', report.errors);

// 5. Generate reports
console.log(window.functionMatrixDev.generateMarkdownReport());
```

---

## Debugging

**Problem:** Feature flag enabled but functions not showing
```javascript
// Check service state
const service = FunctionMatrixService.getInstance();
console.log(service.getFeatureFlags());
console.log(service.getStatistics());
```

**Problem:** Syntax not matching documentation
```javascript
// Check specific function
const fn = service.getFunction('function_id');
console.log(fn.capabilities[SourceTechnology.ORACLE]);
// Check: syntax property matches official Oracle docs exactly
```

**Problem:** Category not in enum
```typescript
// Make sure you're using exact enum value:
FunctionCategory.STRING_TEXT  // ✅ Correct
FunctionCategory.String_Text  // ❌ Wrong case
FunctionCategory.StringText   // ❌ Wrong format
```

**Problem:** Import error
```typescript
// Make sure import path is correct:
import { stringTextFunctions } from './config/functions_string_text';
// File MUST exist at that exact path
```

---

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Right | Why |
|--------|---------|-----|
| `'_id': true` | `'string_text': true` | Use enum value, not string |
| `SyntaxError` | `'SYNTAX()'` | Quote syntax strings |
| Missing technology | All 7 required | PySpark is required too |
| `null` syntax | `'FUNCTION()'` | Syntax cannot be null |
| PascalCase ids | `kebab_case_ids` | Convention matters |
| `notes: false` | `notes: 'text'` | Use strings, not boolean |

---

## File Size Reference

- Numeric Math (18 functions): ~400 lines
- String/Text (48 functions): ~1000 lines (est)
- Date/Time (52 functions): ~1100 lines (est)
- Type Conversion (18 functions): ~400 lines (est)

**Rule of thumb:** ~20 lines per function

---

## Quick Links

- **Markdown Sources:** `Docs/function-matrix-part[1-3].md`
- **Type Definitions:** `FunctionMatrixTypes.ts`
- **Service:** `FunctionMatrixService.ts`
- **Example:** `config/functions_numeric_math.ts` (18 functions, complete)
- **Dev Tools:** `FunctionMatrixDevTools.ts`
- **React Panel:** `FunctionMatrixControlPanel.tsx`
- **Full Guide:** `CATEGORY_IMPLEMENTATION_GUIDE.md`

---

## IDE Snippets

### VS Code Snippet (functions_template.code-snippets)
```json
{
  "Function Entry": {
    "prefix": "fn_entry",
    "body": [
      "functionEntry(",
      "  '${1:function_id}',",
      "  '${2:Display Label}',",
      "  FunctionCategory.${3:CATEGORY},",
      "  '${4:Description}',",
      "  {",
      "    [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, '${5:SYNTAX}'),",
      "    [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, '${6:SYNTAX}'),",
      "    [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, '${7:SYNTAX}'),",
      "    [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, '${8:SYNTAX}'),",
      "    [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, '${9:SYNTAX}'),",
      "    [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, '${10:SYNTAX}'),",
      "    [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, '${11:pyspark_syntax}'),",
      "  },",
      "  { priority: 'high' }",
      "),"
    ]
  }
}
```

---

## Performance Notes

- Loading 300+ functions: ~5ms (lazy loaded)
- Query by ID: O(1) — instant
- Query by category: O(n) where n = ~20-50 functions
- Memory: ~100KB for complete matrix
- Feature flag change: Clears cache, rebuilds on next query

---

## Next: String & Text Functions

Ready to start? Follow this checklist:

- [ ] Read STRING_TEXT section in function-matrix-part1.md (lines 115-325)
- [ ] Create `functions_string_text.ts`
- [ ] Add all 48 functions following template
- [ ] Update FunctionMatrixService imports
- [ ] Enable feature flag
- [ ] Run validation in browser
- [ ] All validations pass? Commit!

**Estimated Time:** 2-3 hours

