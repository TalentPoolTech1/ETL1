/**
 * Node Configuration Validator
 * 
 * Validates node configurations based on node type.
 * Returns structured validation results per node field.
 */

import {
  ValidationError,
  ValidationResult,
  nodeValidations,
  sourceNodeValidations,
  transformNodeValidations,
  targetNodeValidations,
  pipelineValidations,
} from '../validators/ValidationRules';

export interface NodeConfig {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'target';
  x: number;
  y: number;
  config: Record<string, any>;
}

export interface NodeValidationResult {
  isValid: boolean;
  fieldErrors: Record<string, ValidationError[]>;
  summary: string;
}

export interface PipelineValidationResult {
  isValid: boolean;
  nodeErrors: Record<string, ValidationError[]>;
  globalErrors: ValidationError[];
  summary: string;
}

/**
 * Validates a single node configuration
 */
export function validateNode(node: NodeConfig): NodeValidationResult {
  const fieldErrors: Record<string, ValidationError[]> = {};
  let hasErrors = false;

  // Common validations
  const nameResult = nodeValidations.name.required(node.name);
  if (!nameResult.valid) {
    fieldErrors['name'] = nameResult.errors;
    hasErrors = true;
  }

  const nameLengthResult = nodeValidations.name.length(node.name);
  if (!nameLengthResult.valid) {
    fieldErrors['name'] = [...(fieldErrors['name'] || []), ...nameLengthResult.errors];
    hasErrors = true;
  }

  const namePatternResult = nodeValidations.name.pattern(node.name);
  if (!namePatternResult.valid) {
    fieldErrors['name'] = [...(fieldErrors['name'] || []), ...namePatternResult.errors];
    hasErrors = true;
  }

  // Type-specific validations
  switch (node.type) {
    case 'source': {
      const connResult = sourceNodeValidations.connection(node.config.connectionId);
      if (!connResult.valid) {
        fieldErrors['connectionId'] = connResult.errors;
        hasErrors = true;
      }

      const schemaResult = sourceNodeValidations.schema(node.config.schema);
      if (!schemaResult.valid) {
        fieldErrors['schema'] = schemaResult.errors;
        hasErrors = true;
      }

      const tableResult = sourceNodeValidations.table(node.config.table);
      if (!tableResult.valid) {
        fieldErrors['table'] = tableResult.errors;
        hasErrors = true;
      }
      break;
    }

    case 'transform': {
      const exprResult = transformNodeValidations.expression(node.config.expression);
      if (!exprResult.valid) {
        fieldErrors['expression'] = exprResult.errors;
        hasErrors = true;
      }

      if (node.config.expression) {
        const syntaxResult = transformNodeValidations.sqlSyntax(node.config.expression);
        if (!syntaxResult.valid) {
          fieldErrors['expression'] = [...(fieldErrors['expression'] || []), ...syntaxResult.errors];
          hasErrors = true;
        }
      }

      if (node.config.columnMappings) {
        const mappingResult = transformNodeValidations.columnMapping(node.config.columnMappings);
        if (!mappingResult.valid) {
          fieldErrors['columnMappings'] = mappingResult.errors;
          hasErrors = true;
        }
      }
      break;
    }

    case 'target': {
      const connResult = targetNodeValidations.connection(node.config.connectionId);
      if (!connResult.valid) {
        fieldErrors['connectionId'] = connResult.errors;
        hasErrors = true;
      }

      const tableResult = targetNodeValidations.table(node.config.table);
      if (!tableResult.valid) {
        fieldErrors['table'] = tableResult.errors;
        hasErrors = true;
      }

      const modeResult = targetNodeValidations.writeMode(node.config.writeMode);
      if (!modeResult.valid) {
        fieldErrors['writeMode'] = modeResult.errors;
        hasErrors = true;
      }
      break;
    }
  }

  return {
    isValid: !hasErrors,
    fieldErrors,
    summary: hasErrors ? `Node "${node.name}" has ${Object.keys(fieldErrors).length} validation error(s)` : `Node "${node.name}" is valid`,
  };
}

/**
 * Validates multiple nodes and checks pipeline connectivity
 */
export function validatePipeline(
  nodes: NodeConfig[],
  edges: Array<{ source: string; target: string }>
): PipelineValidationResult {
  const nodeErrors: Record<string, ValidationError[]> = {};
  const globalErrors: ValidationError[] = [];
  let hasErrors = false;

  // Validate individual nodes
  nodes.forEach(node => {
    const result = validateNode(node);
    if (!result.isValid) {
      nodeErrors[node.id] = Object.values(result.fieldErrors).flat();
      hasErrors = true;
    }
  });

  // Pipeline-level validations
  const nameResult = pipelineValidations.hasSourceAndTarget(nodes);
  if (!nameResult.valid) {
    globalErrors.push(...nameResult.errors);
    hasErrors = true;
  }

  const connectionResult = pipelineValidations.isConnected(nodes, edges);
  if (!connectionResult.valid) {
    globalErrors.push(...connectionResult.errors);
    hasErrors = true;
  }

  return {
    isValid: !hasErrors,
    nodeErrors,
    globalErrors,
    summary: hasErrors
      ? `Pipeline has ${Object.keys(nodeErrors).length} node error(s) and ${globalErrors.length} global error(s)`
      : 'Pipeline is valid',
  };
}

/**
 * Gets validation error for a specific field
 */
export function getFieldError(fieldErrors: Record<string, ValidationError[]>, fieldName: string): string {
  const errors = fieldErrors[fieldName];
  if (!errors || errors.length === 0) return '';
  return errors[0].message;
}

/**
 * Gets all validation errors as an array
 */
export function getAllFieldErrors(fieldErrors: Record<string, ValidationError[]>): ValidationError[] {
  const allErrors: ValidationError[] = [];
  Object.values(fieldErrors).forEach(errors => {
    allErrors.push(...errors);
  });
  return allErrors;
}

/**
 * Checks if a specific field has errors
 */
export function hasFieldError(fieldErrors: Record<string, ValidationError[]>, fieldName: string): boolean {
  return (fieldErrors[fieldName]?.length || 0) > 0;
}

/**
 * Groups validation errors by code for analytics/logging
 */
export function groupErrorsByCode(errors: ValidationError[]): Record<string, ValidationError[]> {
  return errors.reduce((acc, error) => {
    if (!acc[error.code]) {
      acc[error.code] = [];
    }
    acc[error.code].push(error);
    return acc;
  }, {} as Record<string, ValidationError[]>);
}

/**
 * Formats validation error for display
 */
export function formatValidationError(error: ValidationError): string {
  return `${error.message} (${error.code})`;
}

/**
 * Checks if node is ready for execution (all required fields valid)
 */
export function isNodeExecutionReady(node: NodeConfig): boolean {
  const result = validateNode(node);
  return result.isValid;
}

/**
 * Gets a summary of validation issues for UI display
 */
export function getValidationSummary(result: NodeValidationResult | PipelineValidationResult): {
  count: number;
  first?: ValidationError;
} {
  if ('fieldErrors' in result) {
    const errors = getAllFieldErrors(result.fieldErrors);
    return {
      count: errors.length,
      first: errors[0],
    };
  }

  const allErrors = [...result.globalErrors, ...Object.values(result.nodeErrors).flat()];
  return {
    count: allErrors.length,
    first: allErrors[0],
  };
}
