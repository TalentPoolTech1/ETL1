# Function Matrix - Category Implementation Guide

## Overview

This document guides developers through implementing remaining function categories in the configuration-driven function matrix system.

**Status:**
- ✅ Phase 1 Complete: Foundation (FunctionMatrixTypes, FunctionMatrixService)
- ✅ Phase 1 Complete: Numeric Math (18 functions)
- ✅ Phase 1 Complete: Development Tools (FunctionMatrixDevTools, ControlPanel)
- 🔄 Phase 2 In Progress: String, Date/Time, and TypeConversion categories
- 📋 Phase 3 Planned: Remaining 13 categories

## Quick Start

### 1. Enable a Category

To mark a category for implementation, update `FunctionMatrixService.ts`:

```typescript
const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  byCategory: {
    [FunctionCategory.NUMERIC_MATH]: true,        // ✓ Ready
    [FunctionCategory.STRING_TEXT]: true,         // NEW: Set to true
    [FunctionCategory.DATE_TIME]: true,           // NEW: Set to true
    [FunctionCategory.TYPE_CONVERSION]: true,     // NEW: Set to true
    // ...rest false until ready
  },
};
```

### 2. Create Configuration File

Create a new file: `src/transformations/pushdown/config/functions_<category>.ts`

Template:
```typescript
import { FunctionEntry, FunctionCategory, SourceTechnology, SupportLevel, capability, functionEntry } from '../FunctionMatrixTypes';

/**
 * <Category Name> Functions Configuration
 * [Number] functions across all supported technologies
 */
export const <categoryName>Functions: FunctionEntry[] = [
  functionEntry(
    'function_key_name',
    'User Facing Label',
    FunctionCategory.<CATEGORY>,
    'Description of what this function does',
    {
      [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_ORACLE', { notes: 'Oracle-specific notes' }),
      [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_POSTGRESQL'),
      [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_MYSQL'),
      [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_SQLSERVER'),
      [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_REDSHIFT'),
      [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'SYNTAX_IN_SNOWFLAKE'),
      [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'syntax_in_pyspark'),
    },
    {
      priority: 'high', // 'high' | 'medium' | 'low'
      notes: 'Cross-technology notes and gotchas',
      relatedFunctions: ['other_function_id'],
      tested: true,
    }
  ),
  // ... more functions
];
```

### 3. Import in Service

Update `FunctionMatrixService.ts` loadFunctions():

```typescript
private loadFunctions(): void {
  if (this.isLoaded) return;

  this.functions = [
    ...numericMathFunctions,
    ...stringTextFunctions,           // NEW
    ...dateTimeFunctions,             // NEW
    ...typeConversionFunctions,       // NEW
    // ...add others as created
  ];

  // ... rest of initialization
}
```

### 4. Verify via DevTools

Browser console:
```javascript
// Check what's loaded
window.functionMatrixDev.printCurrentState();

// List a category
window.functionMatrixDev.listCategory('string_text');

// Show a specific function
window.functionMatrixDev.showFunction('function_id');

// Generate reports
window.functionMatrixDev.generateMarkdownReport();
```

---

## Category Implementation Order

**Recommended priority based on complexity and impact:**

### Tier 1: High Priority (Implement First)
1. **String & Text** (48 functions)
   - Most transformations use string manipulation
   - Moderate syntax variance across DBs
   - ⏱️ Est: 2-3 hours

2. **Date & Time** (52 functions)
   - Critical for ETL pipelines
   - **Highest syntax variance** across databases
   - ⏱️ Est: 3-4 hours

3. **Type Conversion** (18 functions)
   - Essential for data pipeline validation
   - Relatively straightforward, consistent patterns
   - ⏱️ Est: 1-2 hours

### Tier 2: Medium Priority (Implement Second)
4. **Aggregate** (24 functions)
   - Common in reporting transforms
   - Good parity across databases
   - ⏱️ Est: 2 hours

5. **Window & Analytical** (22 functions)
   - Advanced transforms, Redshift limited
   - Complex syntax variations
   - ⏱️ Est: 2-3 hours

6. **Conditional Logic** (10 functions)
   - Essential building blocks
   - Very consistent across DBs
   - ⏱️ Est: 1 hour

7. **NULL Handling** (8 functions)
   - Common in data cleaning
   - Consistent patterns
   - ⏱️ Est: 0.5 hours

### Tier 3: Advanced (Implement Last)
8. **Regular Expression** (10 functions)
   - SQL Server has limitations
   - MySQL/PostgreSQL/Oracle differences
   - ⏱️ Est: 1.5 hours

9. **Array & Collection** (22 functions)
   - Modern databases (Snowflake, Redshift)
   - Limited in traditional SQL
   - ⏱️ Est: 2 hours

10. **JSON** (16 functions)
    - Cloud DB specific
    - Snowflake/Redshift strong, MySQL weak
    - ⏱️ Est: 2 hours

11. **Ranking** (8 functions)
    - Window function variants
    - Good parity
    - ⏱️ Est: 1 hour

12. **Concatenation** (8 functions)
    - Simple but varied syntax
    - ⏱️ Est: 0.5 hours

13. **Encoding & Hashing** (12 functions)
    - Security-sensitive
    - Moderate variance
    - ⏱️ Est: 1 hour

14. **Hierarchical & Recursive** (8 functions)
    - Advanced, Oracle-specific features
    - ⏱️ Est: 1.5 hours

15. **Statistical** (14 functions)
    - Advanced analytics
    - ⏱️ Est: 1.5 hours

16. **Technology-Specific** (varies)
    - Last, after core functions
    - ⏱️ Est: 2 hours

---

## Implementation Pattern

Every function entry follows this structure:

```typescript
functionEntry(
  id,              // kebab-case identifier
  label,           // User-facing display name
  category,        // FunctionCategory enum
  description,     // What the function does
  capabilities,    // Per-technology support map
  metadata,        // Priority, notes, test status
)
```

### Capability Object Format

```typescript
{
  [SourceTechnology.ORACLE]: capability(
    SupportLevel.NATIVE,      // or ALTERNATIVE, PARTIAL, NONE, PYSPARK_ONLY, UDF_REQUIRED
    'ROUND(n,d)',             // Exact SQL syntax
    {
      notes: 'Optional context notes',
      example: 'SELECT ROUND(3.14159, 2)',  // Usage example
      alternative: 'Can use TRUNC instead',
      minVersion: '12.1',    // DB version requirement
      disablePushdown: false, // Force evaluation in PySpark
      uiBehavior: 'Show warning badge for MySQL',  // UI hints
    }
  ),
}
```

### Support Levels

| Level | Meaning | Use When |
|-------|---------|----------|
| `NATIVE` | Direct syntax support | Function works natively in DB |
| `ALTERNATIVE` | Can use different function | e.g., MOD() vs % operator |
| `PARTIAL` | Works with limitations | e.g., no ORDER BY in subquery |
| `NONE` | Not supported | Must execute in PySpark |
| `PYSPARK_ONLY` | Only in PySpark | No DB equivalent |
| `UDF_REQUIRED` | Needs custom UDF | Advanced/rare functions |

---

## Validation Checklist

Before marking a category complete:

- [ ] All functions from markdown matrix are listed
- [ ] Each function has all 7 technologies covered
- [ ] Syntax strings are exact (copy from official docs if possible)
- [ ] Alternative/notes are set for non-NATIVE cases
- [ ] Priority is assigned (high/medium/low)
- [ ] `tested: true` only if actually tested
- [ ] Related functions linked in metadata
- [ ] No duplicate IDs across all files
- [ ] Feature flag is enabled in FunctionMatrixService
- [ ] DevTools report shows expected counts

### Running Validation

```javascript
// In browser console:
const report = window.functionMatrixDev.validateMatrix();
console.log(report);

// Should show:
// {
//   isValid: true,
//   errors: [],
//   warnings: [],
//   stats: { ... }
// }
```

---

## String & Text Functions (Category: STRING_TEXT)

**Count:** 48 functions
**Status:** Ready for implementation
**Markdown Source:** function-matrix-part1.md (lines 115-325)

### Key Implementation Notes:

1. **Case Conversion** (UPPER, LOWER, INITCAP)
   - Relatively consistent across all DBs
   - Snowflake has different behavior with multi-byte characters

2. **Trimming Functions** (LTRIM, RTRIM, TRIM)
   - SQL Server uses LTRIM/RTRIM, others have TRIM
   - Which characters to trim varies by DB

3. **Substring/Extract**
   - Use SUBSTR in Oracle/MySQL, SUBSTRING in PostgreSQL/SQLSERVER
   - PySpark uses substring()

4. **String Concatenation**
   - Oracle: ||
   - SQL Server: + or CONCAT
   - MySQL/PostgreSQL: || or CONCAT
   - Snowflake: ||
   - PySpark: concat() function

5. **LIKE Pattern Matching**
   - Generally consistent but case sensitivity differs
   - Some DBs support LIKE with ESCAPE clause

6. **REPLACE/TRANSLATE**
   - REPLACE is standard
   - TRANSLATE is Oracle-specific for character-by-character replacement

### Template Entry

```typescript
functionEntry(
  'upper_case',
  'Convert to Uppercase',
  FunctionCategory.STRING_TEXT,
  'Converts all characters in string to uppercase',
  {
    [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'UPPER(str)'),
    [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'upper(col)'),
  },
  {
    priority: 'high',
    tested: true,
    relatedFunctions: ['lower_case', 'initcap'],
  }
)
```

---

## Date & Time Functions (Category: DATE_TIME)

**Count:** 52 functions
**Status:** Ready for implementation
**Markdown Source:** function-matrix-part1.md (lines 326-450)
**CRITICAL PRIORITY** — Highest variance across databases

### Key Implementation Notes:

1. **Date Extraction** (DAY, MONTH, YEAR, etc.)
   - Oracle: Extract from DATE
   - PostgreSQL: Extract from TIMESTAMP
   - MySQL: DAYNAME, MONTHNAME, YEAR functions
   - SQL Server: Year(), Month(), Day(), etc.
   - Snowflake: DATEPART, EXTRACT
   - PySpark: year(), month(), day() from column functions

2. **Date Arithmetic**
   - Oracle: DATE + INTERVAL
   - PostgreSQL: TIMESTAMP + INTERVAL, or + INTEGER days
   - MySQL: DATE_ADD, DATE_SUB
   - SQL Server: DATEADD
   - Snowflake: DATEADD
   - PySpark: date_add(), date_sub()

3. **Date Formatting**
   - Oracle: TO_CHAR with format string
   - PostgreSQL: TO_CHAR with format string
   - MySQL: DATE_FORMAT (different format string)
   - SQL Server: FORMAT or CONVERT with style codes
   - Snowflake: TO_CHAR, TO_VARCHAR
   - PySpark: date_format()

4. **Date Parsing**
   - Oracle: TO_DATE
   - PostgreSQL: TO_TIMESTAMP
   - MySQL: STR_TO_DATE
   - SQL Server: CONVERT, PARSE, TRY_CONVERT
   - Snowflake: TO_TIMESTAMP, TO_DATE
   - PySpark: to_date(), to_timestamp()

5. **Current Date/Time**
   - Oracle: SYSDATE, SYSTIMESTAMP
   - PostgreSQL: NOW(), CURRENT_DATE, CURRENT_TIMESTAMP
   - MySQL: NOW(), CURDATE(), CURTIME()
   - SQL Server: GETDATE(), SYSDATETIME()
   - Snowflake: CURRENT_DATE(), CURRENT_TIMESTAMP()
   - PySpark: current_date(), current_timestamp()

### Template Entry (Complex Date Example)

```typescript
functionEntry(
  'date_add_days',
  'Add Days to Date',
  FunctionCategory.DATE_TIME,
  'Adds specified number of days to a date',
  {
    [SourceTechnology.ORACLE]: capability(
      SupportLevel.ALTERNATIVE,
      'date_col + n',  // or 'DATE \'YYYY-MM-DD\' + n'
      {
        notes: 'Use integer + INTERVAL DAY(n) for explicit typing',
        example: 'SELECT date_col + 7 FROM table1',
        minVersion: '9.0',
      }
    ),
    [SourceTechnology.POSTGRESQL]: capability(
      SupportLevel.NATIVE,
      'date_col + INTERVAL \'n days\'',
      {
        notes: 'Can also use: date_col + (n || \' days\')::interval',
        example: 'SELECT date_col + INTERVAL \'7 days\' FROM table1',
      }
    ),
    [SourceTechnology.MYSQL]: capability(
      SupportLevel.NATIVE,
      'DATE_ADD(date_col, INTERVAL n DAY)',
      {
        example: 'SELECT DATE_ADD(date_col, INTERVAL 7 DAY) FROM table1',
      }
    ),
    [SourceTechnology.SQLSERVER]: capability(
      SupportLevel.NATIVE,
      'DATEADD(DAY, n, date_col)',
      {
        example: 'SELECT DATEADD(DAY, 7, date_col) FROM table1',
      }
    ),
    [SourceTechnology.REDSHIFT]: capability(
      SupportLevel.NATIVE,
      'date_col + (n || \' days\')::INTERVAL',
      {
        notes: 'Redshift uses PostgreSQL date arithmetic',
      }
    ),
    [SourceTechnology.SNOWFLAKE]: capability(
      SupportLevel.NATIVE,
      'DATEADD(\'day\', n, date_col)',
      {
        example: 'SELECT DATEADD(\'day\', 7, date_col) FROM table1',
      }
    ),
    [SourceTechnology.PYSPARK]: capability(
      SupportLevel.NATIVE,
      'date_add(col, n)',
      {
        example: 'df.select(date_add(col(\'date_col\'), 7))',
      }
    ),
  },
  {
    priority: 'high',
    notes: 'Critical for time-based filtering and aggregations',
    relatedFunctions: ['date_subtract', 'days_between', 'datediff'],
    tested: false,  // Will test after implementation
  }
)
```

---

## Type Conversion Functions (Category: TYPE_CONVERSION)

**Count:** 18 functions
**Status:** Ready for implementation
**Markdown Source:** function-matrix-part1.md (lines 451-550)

### Key Implementation Notes:

1. **String Conversions**
   - Oracle: TO_CHAR, TO_VARCHAR
   - PostgreSQL: CAST, ::type
   - MySQL: CAST
   - SQL Server: CAST, CONVERT
   - Snowflake: CAST, TRY_CAST
   - PySpark: cast(), astype()

2. **Numeric Conversions**
   - Most use CAST or TO_NUMBER
   - Oracle: TO_NUMBER
   - SQL Server: CONVERT with style codes
   - Snowflake: TRY_CAST for safe conversion

3. **Boolean/Bit Conversions**
   - Varies significantly by DB
   - Some don't have native boolean type
   - Often mapped to 0/1 or true/false strings

4. **Date Conversion**
   - Each DB has its own approach
   - See DATE_TIME section for details

### Template Entry

```typescript
functionEntry(
  'cast_to_integer',
  'Cast to Integer',
  FunctionCategory.TYPE_CONVERSION,
  'Converts a value to integer type',
  {
    [SourceTechnology.ORACLE]: capability(
      SupportLevel.NATIVE,
      'CAST(val AS INTEGER)',
      {
        notes: 'Can also use TO_NUMBER(val)',
      }
    ),
    [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'CAST(val AS INTEGER)'),
    [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'CAST(val AS INTEGER)'),
    [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'CAST(val AS INT)'),
    [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'CAST(val AS INTEGER)'),
    [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'CAST(val AS NUMBER)'),
    [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'col.cast(\'int\')'),
  },
  {
    priority: 'high',
    tested: true,
  }
)
```

---

## Testing & QA

### Manual Testing Checklist

After implementing each category:

```sql
-- For each database type and function:

-- 1. Test with NULL input
SELECT fn_function_name(NULL);

-- 2. Test with various edge cases
SELECT fn_function_name(edge_case_value);

-- 3. Verify syntax matches documentation
-- (copy query from function definition and run)

-- 4. Compare results across DBs for same input
-- (where logically comparable)
```

### Integration Testing

```typescript
// In test suite:
describe('StringTextFunctions', () => {
  it('should load string functions', () => {
    const service = FunctionMatrixService.getInstance();
    const functions = service.getFunctionsByCategory(FunctionCategory.STRING_TEXT);
    expect(functions.length).toBe(48);
  });

  it('should return syntax for all technologies', () => {
    const service = FunctionMatrixService.getInstance();
    const fn = service.getFunction('upper_case');
    expect(fn.capabilities[SourceTechnology.ORACLE]).toBeDefined();
    expect(fn.capabilities[SourceTechnology.ORACLE].syntax).toContain('UPPER');
  });
});
```

---

## Development Tips

### 1. Using Browser DevTools

```javascript
// In browser while app is running:

// Show everything
window.functionMatrixDev.printCurrentState();

// List a specific category
window.functionMatrixDev.listCategory('string_text');

// Show a function's details
window.functionMatrixDev.showFunction('upper_case');

// Toggle a category
window.functionMatrixDev.toggleCategory('date_time');

// Generate reports
console.log(window.functionMatrixDev.generateMarkdownReport());
console.log(window.functionMatrixDev.generateJSONReport());
```

### 2. Syntax Verification

When copying syntax from official docs:
- ✅ Use exact syntax including capitalization
- ✅ Include all required parameters
- ✅ Note optional parameters in comments
- ✅ Add examples that actually work
- ✅ Test before committing

### 3. Version Management

For version-specific functions:
```typescript
capability(
  SupportLevel.NATIVE,
  'FUNCTION_SYNTAX',
  {
    minVersion: '12.0',  // DB version requirement
    notes: 'Available in Oracle 12+ only',
  }
)
```

### 4. Alternative Functions

When exact equivalence doesn't exist:
```typescript
capability(
  SupportLevel.ALTERNATIVE,
  'RECOMMENDED_SYNTAX',
  {
    alternative: 'OTHER_FUNCTION()',
    notes: 'Use FIRST_FUNC() if SECOND_FUNC() not available',
  }
)
```

---

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| **Syntax typos** | Copy from official DB documentation |
| **Missing technologies** | Check all 7 sources before marking complete |
| **Inconsistent naming** | Use kebab-case for IDs, PascalCase for labels |
| **Vague descriptions** | Be specific about what function does |
| **No examples** | Add working SQL example in notes/metadata |
| **Outdated syntax** | Cross-check with latest DB version docs |
| **Missing alternatives** | Note when multiple syntaxes exist |

---

## Next Steps

1. **Immediately:** Implement String, Date, and TypeConversion categories (Tier 1)
2. **This week:** Implement Aggregate, Window, Conditional, NULL categories (Tier 2)
3. **Next week:** Implement remaining advanced categories (Tier 3)
4. **Before release:** Full test coverage and UI integration

---

## Questions?

- Check markdown source files: `Docs/function-matrix-part*.md`
- Review numeric_math.ts as a complete example
- Run devTools.validateMatrix() to catch issues early
- Consult database documentation for exact syntax

