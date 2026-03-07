# Validation Framework Implementation

## Overview

A comprehensive validation system has been implemented for the ETL1 Frontend that provides:
- Node configuration validation (source, transform, target)
- Field-level validators for individual inputs
- Form-level validation hooks
- Real-time error display with visual feedback
- Integration with Properties Panel and components

## Architecture

### Validation Layers

```
ValidationRules.ts (Core Validators)
    ↓
nodeValidator.ts (Node-specific validation)
    ↓
useFormValidation.ts (React hooks)
    ↓
Components (Input, Select, PropertiesPanel)
```

## Files Created

### 1. `src/validators/ValidationRules.ts`
Core validation rules for all entity types.

**Exports:**
- `ValidationError`: Error structure with field, message, and code
- `ValidationResult`: Result from validator with valid flag and errors array
- `nodeValidations`: Required name, length, pattern checks
- `sourceNodeValidations`: Connection, schema, table validators
- `transformNodeValidations`: Expression, SQL syntax, column mapping validators
- `targetNodeValidations`: Connection, table, write mode validators
- `fieldValidations`: Email, URL, port, required, minLength, maxLength, regex
- `pipelineValidations`: Pipeline-level checks (source+target, connectivity)

**Error Codes:**
- `NODE-001` to `NODE-003`: Node name validation
- `SOURCE-001` to `SOURCE-003`: Source node config
- `TRANSFORM-001` to `TRANSFORM-006`: Transform node config
- `TARGET-001` to `TARGET-003`: Target node config
- `FIELD-001` to `FIELD-007`: Form field validation
- `PIPE-001` to `PIPE-007`: Pipeline-level validation

### 2. `src/utils/nodeValidator.ts`
High-level node and pipeline validation utilities.

**Key Functions:**
- `validateNode(config)`: Validates single node, returns field errors
- `validatePipeline(nodes, edges)`: Validates entire pipeline
- `getFieldError(fieldErrors, fieldName)`: Gets first error for field
- `getAllFieldErrors(fieldErrors)`: Flattens all errors
- `hasFieldError(fieldErrors, fieldName)`: Boolean check
- `isNodeExecutionReady(node)`: Checks if node can execute
- `getValidationSummary(result)`: Format for UI display

**Validation Result Structure:**
```typescript
{
  isValid: boolean;
  fieldErrors: Record<string, ValidationError[]>;
  summary: string;
}
```

### 3. `src/hooks/useFormValidation.ts`
React hooks for managing form validation state.

**Hooks:**

#### `useFormValidation(initialValues, options)`
Complete form validation with multi-field support.

```typescript
const form = useFormValidation(
  { email: '', name: '' },
  { mode: 'onBlur', revalidateMode: 'onBlur' }
);

form.values        // Current field values
form.errors        // Field errors by field name
form.touched       // Which fields have been touched
form.isDirty       // If any field has changed
form.getFieldProps(fieldName, validator) // Props for input
form.validateField(fieldName, validator) // Validate single field
form.validateForm(validators)    // Validate all fields
form.reset()       // Reset to initial values
```

#### `useFieldValidation(initialValue, validator, options)`
Single field validation.

```typescript
const email = useFieldValidation(
  '',
  fieldValidations.email,
  { mode: 'onChange' }
);

email.value        // Current value
email.errors       // Validation errors
email.touched      // Has field been touched
email.bind         // { value, onChange, onBlur } for input
email.validate()   // Trigger validation
```

#### `useAsyncFieldValidation(initialValue, asyncValidator, options)`
Async validation (e.g., checking name uniqueness).

```typescript
const username = useAsyncFieldValidation(
  '',
  async (value) => {
    const exists = await checkUsernameExists(value);
    return {
      valid: !exists,
      errors: exists ? [{ ... }] : []
    };
  },
  { debounceMs: 300 }
);

username.isValidating  // Currently validating
username.bind          // { value, onChange }
```

#### `useCompositeValidation(initialValue, validators, options)`
Multiple validators on one field.

```typescript
const password = useCompositeValidation(
  '',
  [
    (val) => fieldValidations.required(val),
    (val) => fieldValidations.minLength(val, 8),
    (val) => customPasswordStrength(val)
  ]
);

password.errors  // Combined errors from all validators
```

## Usage Examples

### Example 1: Validating a Source Node

```typescript
import { validateNode } from '@/utils/nodeValidator';

const node = {
  id: 'node-1',
  name: 'Read Customers',
  type: 'source' as const,
  x: 100,
  y: 100,
  config: {
    connectionId: 'pg-1',
    schema: 'public',
    table: 'customers'
  }
};

const result = validateNode(node);

if (!result.isValid) {
  result.fieldErrors['table'] // Array of ValidationError
  result.summary // "Node "Read Customers" has 0 validation error(s)"
}
```

### Example 2: Form with Multiple Fields

```typescript
import { useFormValidation } from '@/hooks/useFormValidation';
import { fieldValidations } from '@/validators/ValidationRules';

function LoginForm() {
  const form = useFormValidation(
    { email: '', password: '' },
    { mode: 'onBlur' }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const isValid = form.validateForm({
      email: fieldValidations.email,
      password: (val) => fieldValidations.minLength(val, 8)
    });

    if (isValid) {
      // Submit form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        {...form.getFieldProps('email', fieldValidations.email)}
        placeholder="Email"
      />
      {form.errors.email?.[0] && (
        <span className="error">{form.errors.email[0].message}</span>
      )}

      <input
        {...form.getFieldProps('password', (val) => 
          fieldValidations.minLength(val, 8)
        )}
        type="password"
        placeholder="Password"
      />
      {form.errors.password?.[0] && (
        <span className="error">{form.errors.password[0].message}</span>
      )}

      <button type="submit">Login</button>
    </form>
  );
}
```

### Example 3: Properties Panel Integration

The PropertiesPanel now includes:

1. **Real-time validation** on node property changes
2. **Error badges** on tabs showing count of errors
3. **Red borders** on invalid fields
4. **Error messages** below fields
5. **Disabled Test button** until expression is valid

```tsx
// Validation result computed from selected node
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

// Display errors
{validationResult?.fieldErrors['name']?.[0] && (
  <p className="text-xs text-danger-600 mt-1">
    {validationResult.fieldErrors['name'][0].message}
  </p>
)}
```

## Validation Rules Reference

### Node Name Validation
- **Required**: Cannot be empty
- **Length**: Max 255 characters
- **Pattern**: Alphanumeric, underscores, hyphens, and spaces only

### Source Node
- **Connection**: Required
- **Schema**: Required, non-empty string
- **Table**: Required, non-empty string

### Transform Node
- **Expression**: Required, non-empty
- **SQL Syntax**: Must contain SELECT/FROM/WHERE/JOIN or valid SQL
- **Column Mappings**: At least one mapping; no duplicate targets

### Target Node
- **Connection**: Required
- **Table**: Required, non-empty string
- **Write Mode**: Must be OVERWRITE, APPEND, or MERGE

### Field Validators
- **email**: Standard email regex pattern
- **url**: Valid absolute URL
- **port**: Integer between 1-65535
- **required**: Non-empty, trimmed string
- **minLength**: Minimum character count
- **maxLength**: Maximum character count
- **regex**: Custom pattern matching

### Pipeline Validation
- **Has Source & Target**: Pipeline must have at least one of each
- **Connected**: All nodes must be connected via edges

## Error Handling

### Error Structure
```typescript
interface ValidationError {
  field: string;      // Field name for targeting in UI
  message: string;    // User-friendly error message
  code: string;       // Error code (e.g., 'NODE-001')
}
```

### Error Display Best Practices

1. **Show count in tabs/badges**
2. **Highlight fields with red border**
3. **Display message below field**
4. **Disable dependent actions** (e.g., Test Transform)
5. **Show global summary** at top of form

## Integration with Backend

When submitting validated nodes to backend:

1. Frontend performs local validation
2. Only submit if `validationResult.isValid === true`
3. Backend performs additional validation
4. Backend returns AppError if validation fails
5. Frontend displays backend error with code and message

```typescript
const handleSave = async () => {
  if (!validationResult?.isValid) {
    showAlert('Fix validation errors before saving');
    return;
  }

  try {
    await api.updateNode(selectedNode);
  } catch (error: any) {
    if (error.response?.data?.code) {
      // Backend validation error
      showAlert(error.response.data.userMessage);
    }
  }
};
```

## Performance Considerations

1. **Memoization**: Validation results are memoized with `useMemo`
2. **Debouncing**: Async validators debounce by default (300ms)
3. **Lazy validation**: Only validate touched fields in `onBlur` mode
4. **Efficient updates**: Field changes don't revalidate entire form

## Testing Validation

```typescript
import { validateNode } from '@/utils/nodeValidator';
import { fieldValidations } from '@/validators/ValidationRules';

// Test node validation
const result = validateNode(invalidNode);
expect(result.isValid).toBe(false);
expect(result.fieldErrors['name'].length).toBeGreaterThan(0);

// Test field validation
const emailResult = fieldValidations.email('invalid-email');
expect(emailResult.valid).toBe(false);

// Test hook
const { errors, validate } = renderHook(() =>
  useFieldValidation('', fieldValidations.required)
);
expect(errors.length).toBeGreaterThan(0);
```

## Future Enhancements

1. **Async validation**: Check if table/schema exists in database
2. **Cross-field validation**: E.g., target != source
3. **Custom validators**: Allow plugins to add validators
4. **Validation schemas**: JSON schema support
5. **i18n support**: Multi-language error messages
6. **Validation groups**: Validate subsets of fields
7. **Conditional validation**: Rules based on node type or other fields
