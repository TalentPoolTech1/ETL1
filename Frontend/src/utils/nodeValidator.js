/**
 * Node Configuration Validator
 *
 * Validates node configurations based on node type.
 * Returns structured validation results per node field.
 */
import { nodeValidations, sourceNodeValidations, transformNodeValidations, targetNodeValidations, pipelineValidations, } from '../validators/ValidationRules';
/**
 * Validates a single node configuration
 */
export function validateNode(node) {
    const fieldErrors = {};
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
export function validatePipeline(nodes, edges) {
    const nodeErrors = {};
    const globalErrors = [];
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
export function getFieldError(fieldErrors, fieldName) {
    const errors = fieldErrors[fieldName];
    if (!errors || errors.length === 0)
        return '';
    return errors[0].message;
}
/**
 * Gets all validation errors as an array
 */
export function getAllFieldErrors(fieldErrors) {
    const allErrors = [];
    Object.values(fieldErrors).forEach(errors => {
        allErrors.push(...errors);
    });
    return allErrors;
}
/**
 * Checks if a specific field has errors
 */
export function hasFieldError(fieldErrors, fieldName) {
    return (fieldErrors[fieldName]?.length || 0) > 0;
}
/**
 * Groups validation errors by code for analytics/logging
 */
export function groupErrorsByCode(errors) {
    return errors.reduce((acc, error) => {
        if (!acc[error.code]) {
            acc[error.code] = [];
        }
        acc[error.code].push(error);
        return acc;
    }, {});
}
/**
 * Formats validation error for display
 */
export function formatValidationError(error) {
    return `${error.message} (${error.code})`;
}
/**
 * Checks if node is ready for execution (all required fields valid)
 */
export function isNodeExecutionReady(node) {
    const result = validateNode(node);
    return result.isValid;
}
/**
 * Gets a summary of validation issues for UI display
 */
export function getValidationSummary(result) {
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
