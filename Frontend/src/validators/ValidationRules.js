/**
 * Validation Rules Framework
 *
 * Defines validation rules for different editors, components, and node types.
 * All validators return { valid: boolean, errors: ValidationError[] }
 */
// ============================================================================
// NODE VALIDATION
// ============================================================================
export const nodeValidations = {
    name: {
        required: (value) => {
            if (!value?.trim()) {
                return {
                    valid: false,
                    errors: [{ field: 'name', message: 'Node name is required', code: 'NODE-001' }],
                };
            }
            return { valid: true, errors: [] };
        },
        length: (value) => {
            if (value?.length > 255) {
                return {
                    valid: false,
                    errors: [{ field: 'name', message: 'Node name must not exceed 255 characters', code: 'NODE-002' }],
                };
            }
            return { valid: true, errors: [] };
        },
        pattern: (value) => {
            const isValid = /^[a-zA-Z0-9_\-\s]+$/.test(value);
            if (!isValid) {
                return {
                    valid: false,
                    errors: [{ field: 'name', message: 'Node name can only contain alphanumeric characters, underscores, hyphens, and spaces', code: 'NODE-003' }],
                };
            }
            return { valid: true, errors: [] };
        },
    },
};
// ============================================================================
// SOURCE NODE VALIDATION
// ============================================================================
export const sourceNodeValidations = {
    connection: (connId) => {
        if (!connId) {
            return {
                valid: false,
                errors: [{ field: 'connection', message: 'Connection is required for source nodes', code: 'SOURCE-001' }],
            };
        }
        return { valid: true, errors: [] };
    },
    schema: (schema) => {
        if (!schema?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'schema', message: 'Schema is required for source nodes', code: 'SOURCE-002' }],
            };
        }
        return { valid: true, errors: [] };
    },
    table: (table) => {
        if (!table?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'table', message: 'Table is required for source nodes', code: 'SOURCE-003' }],
            };
        }
        return { valid: true, errors: [] };
    },
};
// ============================================================================
// TRANSFORM NODE VALIDATION
// ============================================================================
export const transformNodeValidations = {
    expression: (expr) => {
        if (!expr?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'expression', message: 'Transform expression is required', code: 'TRANSFORM-001' }],
            };
        }
        return { valid: true, errors: [] };
    },
    sqlSyntax: (expr) => {
        // Basic SQL syntax check (can be enhanced with full parser)
        const reservedWords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'HAVING'];
        const hasReserved = reservedWords.some(word => expr.toUpperCase().includes(word));
        if (!hasReserved && expr.trim()) {
            return {
                valid: false,
                errors: [{ field: 'expression', message: 'Expression must contain valid SQL', code: 'TRANSFORM-002' }],
            };
        }
        return { valid: true, errors: [] };
    },
    columnMapping: (mappings) => {
        if (!mappings || mappings.length === 0) {
            return {
                valid: false,
                errors: [{ field: 'columnMapping', message: 'At least one column mapping is required', code: 'TRANSFORM-003' }],
            };
        }
        const errors = [];
        const targets = new Set();
        mappings.forEach((m, idx) => {
            if (!m.source?.trim()) {
                errors.push({
                    field: `mapping[${idx}].source`,
                    message: 'Source column cannot be empty',
                    code: 'TRANSFORM-004',
                });
            }
            if (!m.target?.trim()) {
                errors.push({
                    field: `mapping[${idx}].target`,
                    message: 'Target column cannot be empty',
                    code: 'TRANSFORM-005',
                });
            }
            if (targets.has(m.target)) {
                errors.push({
                    field: `mapping[${idx}].target`,
                    message: `Duplicate target column: ${m.target}`,
                    code: 'TRANSFORM-006',
                });
            }
            targets.add(m.target);
        });
        return {
            valid: errors.length === 0,
            errors,
        };
    },
};
// ============================================================================
// TARGET NODE VALIDATION
// ============================================================================
export const targetNodeValidations = {
    connection: (connId) => {
        if (!connId) {
            return {
                valid: false,
                errors: [{ field: 'connection', message: 'Connection is required for target nodes', code: 'TARGET-001' }],
            };
        }
        return { valid: true, errors: [] };
    },
    table: (table) => {
        if (!table?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'table', message: 'Target table name is required', code: 'TARGET-002' }],
            };
        }
        return { valid: true, errors: [] };
    },
    writeMode: (mode) => {
        if (!['OVERWRITE', 'APPEND', 'MERGE'].includes(mode || '')) {
            return {
                valid: false,
                errors: [{ field: 'writeMode', message: 'Write mode must be OVERWRITE, APPEND, or MERGE', code: 'TARGET-003' }],
            };
        }
        return { valid: true, errors: [] };
    },
};
// ============================================================================
// FORM FIELD VALIDATION
// ============================================================================
export const fieldValidations = {
    email: (email) => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValid) {
            return {
                valid: false,
                errors: [{ field: 'email', message: 'Invalid email format', code: 'FIELD-001' }],
            };
        }
        return { valid: true, errors: [] };
    },
    url: (url) => {
        try {
            new URL(url);
            return { valid: true, errors: [] };
        }
        catch {
            return {
                valid: false,
                errors: [{ field: 'url', message: 'Invalid URL format', code: 'FIELD-002' }],
            };
        }
    },
    port: (port) => {
        const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return {
                valid: false,
                errors: [{ field: 'port', message: 'Port must be between 1 and 65535', code: 'FIELD-003' }],
            };
        }
        return { valid: true, errors: [] };
    },
    required: (value) => {
        if (!value?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'field', message: 'This field is required', code: 'FIELD-004' }],
            };
        }
        return { valid: true, errors: [] };
    },
    minLength: (value, minLen) => {
        if (value.length < minLen) {
            return {
                valid: false,
                errors: [{ field: 'field', message: `Minimum length is ${minLen} characters`, code: 'FIELD-005' }],
            };
        }
        return { valid: true, errors: [] };
    },
    maxLength: (value, maxLen) => {
        if (value.length > maxLen) {
            return {
                valid: false,
                errors: [{ field: 'field', message: `Maximum length is ${maxLen} characters`, code: 'FIELD-006' }],
            };
        }
        return { valid: true, errors: [] };
    },
    regex: (value, pattern, message) => {
        if (!pattern.test(value)) {
            return {
                valid: false,
                errors: [{ field: 'field', message, code: 'FIELD-007' }],
            };
        }
        return { valid: true, errors: [] };
    },
};
// ============================================================================
// PIPELINE VALIDATION
// ============================================================================
export const pipelineValidations = {
    name: (name) => {
        if (!name?.trim()) {
            return {
                valid: false,
                errors: [{ field: 'name', message: 'Pipeline name is required', code: 'PIPE-001' }],
            };
        }
        if (name.length > 255) {
            return {
                valid: false,
                errors: [{ field: 'name', message: 'Pipeline name must not exceed 255 characters', code: 'PIPE-002' }],
            };
        }
        return { valid: true, errors: [] };
    },
    hasSourceAndTarget: (nodes) => {
        if (!nodes || nodes.length === 0) {
            return {
                valid: false,
                errors: [{ field: 'nodes', message: 'Pipeline must have at least one node', code: 'PIPE-003' }],
            };
        }
        const hasSource = nodes.some(n => n.type === 'source');
        const hasTarget = nodes.some(n => n.type === 'target');
        const errors = [];
        if (!hasSource) {
            errors.push({ field: 'nodes', message: 'Pipeline must have at least one source node', code: 'PIPE-004' });
        }
        if (!hasTarget) {
            errors.push({ field: 'nodes', message: 'Pipeline must have at least one target node', code: 'PIPE-005' });
        }
        return { valid: errors.length === 0, errors };
    },
    isConnected: (nodes, edges) => {
        if (!nodes || !edges || edges.length === 0) {
            return {
                valid: false,
                errors: [{ field: 'edges', message: 'Pipeline nodes must be connected', code: 'PIPE-006' }],
            };
        }
        const nodeIds = new Set(nodes.map(n => n.id));
        const connectedNodes = new Set();
        edges.forEach(edge => {
            if (nodeIds.has(edge.source))
                connectedNodes.add(edge.source);
            if (nodeIds.has(edge.target))
                connectedNodes.add(edge.target);
        });
        if (connectedNodes.size !== nodeIds.size) {
            return {
                valid: false,
                errors: [{ field: 'edges', message: 'All nodes must be connected in the pipeline', code: 'PIPE-007' }],
            };
        }
        return { valid: true, errors: [] };
    },
};
