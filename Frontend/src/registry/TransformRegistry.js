/**
 * Transform Primitive Registry
 *
 * Centralized catalog of all available transformations with metadata,
 * parameter definitions, validation rules, and code generation templates.
 *
 * This is the single source of truth for all transform types.
 */
/**
 * Transform Registry — the master catalog
 */
export const TRANSFORM_REGISTRY = {
    // ========== CONVERT DATA TYPE ==========
    to_number: {
        id: 'to_number',
        label: 'Convert Text to Number',
        description: "Turns a text value like '1,200.50' into a real number the system can do maths with.",
        category: 'convert',
        icon: '🔢',
        parameters: [
            {
                id: 'format',
                label: 'Number format',
                description: 'e.g., #,##0.00 (with tooltip explaining symbols)',
                type: 'text',
                required: true,
                placeholder: '#,##0.00',
                default: '#,##0.00',
            },
            {
                id: 'locale',
                label: 'Locale',
                description: 'Regional number format',
                type: 'select',
                required: true,
                default: 'en_US',
                options: [
                    { label: 'English (US)', value: 'en_US' },
                    { label: 'English (UK)', value: 'en_GB' },
                    { label: 'French', value: 'fr_FR' },
                    { label: 'German', value: 'de_DE' },
                ],
            },
            {
                id: 'onFail',
                label: 'If it cannot convert',
                description: 'What to do if the value is not a valid number',
                type: 'select',
                required: true,
                default: 'RETURN_NULL',
                options: [
                    { label: 'Use blank (null)', value: 'RETURN_NULL' },
                    { label: 'Fail the pipeline', value: 'FAIL' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `CAST(REGEXP_REPLACE(${input}, '[^0-9.]', '') AS DECIMAL)`,
            postgresql: (params, input) => `CAST(${input} AS NUMERIC)`,
            redshift: (params, input) => `CAST(${input} AS NUMERIC)`,
        },
        sample: {
            input: '"1,200.50"',
            output: 1200.50,
        },
        meta: {
            exampleInputs: ['"1,200.50"', '"1200"', '"$1,234.56"'],
        },
    },
    to_date: {
        id: 'to_date',
        label: 'Convert Text to Date',
        description: "Converts a text value that looks like a date (e.g., '15-Jun-2024') into a proper date.",
        category: 'convert',
        icon: '📅',
        parameters: [
            {
                id: 'format',
                label: 'Date format',
                description: 'What does your date text look like?',
                type: 'text',
                required: true,
                placeholder: 'dd-MMM-yyyy',
                default: 'dd-MMM-yyyy',
            },
            {
                id: 'timezone',
                label: 'Timezone',
                description: 'IANA timezone identifier',
                type: 'select',
                required: false,
                default: 'UTC',
                options: [
                    { label: 'UTC', value: 'UTC' },
                    { label: 'America/New_York', value: 'America/New_York' },
                    { label: 'Europe/London', value: 'Europe/London' },
                ],
            },
            {
                id: 'strictMode',
                label: 'Strict matching',
                description: 'Fail on partial matches',
                type: 'toggle',
                required: false,
                default: false,
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `TO_DATE(${input}, '${params.format}')`,
            postgresql: (params, input) => `TO_DATE(${input}, '${params.format}')`,
            redshift: (params, input) => `TO_DATE(${input}, '${params.format}')`,
        },
        sample: {
            input: '"15-Jun-2024"',
            output: '"2024-06-15"',
        },
        meta: {
            exampleFormats: ['dd-MMM-yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'],
        },
    },
    cast: {
        id: 'cast',
        label: 'Change Data Type',
        description: 'Directly changes the data type of this column value.',
        category: 'convert',
        icon: '🔄',
        parameters: [
            {
                id: 'targetType',
                label: 'Convert to',
                description: 'Select the new data type',
                type: 'select',
                required: true,
                default: 'TEXT',
                options: [
                    { label: 'Text', value: 'TEXT' },
                    { label: 'Whole Number (Integer)', value: 'INTEGER' },
                    { label: 'Decimal Number', value: 'DECIMAL' },
                    { label: 'Date', value: 'DATE' },
                    { label: 'Timestamp', value: 'TIMESTAMP' },
                    { label: 'Boolean', value: 'BOOLEAN' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `CAST(${input} AS ${params.targetType})`,
            postgresql: (params, input) => `CAST(${input} AS ${params.targetType})`,
            redshift: (params, input) => `CAST(${input} AS ${params.targetType})`,
        },
        sample: {
            input: 1200.75,
            output: 1200,
        },
        meta: {},
    },
    // ========== WORK WITH TEXT ==========
    substring: {
        id: 'substring',
        label: 'Extract Part of Text',
        description: 'Pulls out a piece of text from a specific position.',
        category: 'text',
        icon: '✂️',
        parameters: [
            {
                id: 'startPos',
                label: 'Start at position',
                description: '1 = first character',
                type: 'number',
                required: true,
                default: 1,
            },
            {
                id: 'length',
                label: 'How many characters',
                description: 'Length of substring',
                type: 'number',
                required: true,
                default: 1,
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `SUBSTRING(${input}, ${params.startPos}, ${params.length})`,
            postgresql: (params, input) => `SUBSTRING(${input}, ${params.startPos}, ${params.length})`,
            redshift: (params, input) => `SUBSTRING(${input}, ${params.startPos}, ${params.length})`,
        },
        sample: {
            input: '"ORDER-20240615"',
            output: '"20240615"',
        },
        meta: {},
    },
    trim: {
        id: 'trim',
        label: 'Trim Whitespace',
        description: 'Removes leading and trailing spaces from text.',
        category: 'text',
        icon: '✨',
        parameters: [
            {
                id: 'sides',
                label: 'Trim from',
                description: 'Which side to trim',
                type: 'select',
                required: true,
                default: 'BOTH',
                options: [
                    { label: 'Both sides', value: 'BOTH' },
                    { label: 'Left side only', value: 'LEFT' },
                    { label: 'Right side only', value: 'RIGHT' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `TRIM(${input})`,
            postgresql: (params, input) => `TRIM(${input})`,
            redshift: (params, input) => `TRIM(${input})`,
        },
        sample: {
            input: '"  Hello World  "',
            output: '"Hello World"',
        },
        meta: {},
    },
    // ========== WORK WITH DATES ==========
    trim_timestamp: {
        id: 'trim_timestamp',
        label: 'Remove Time from Date',
        description: "Keeps only the date part and removes the time. Useful for grouping by day without time variation.",
        category: 'datetime',
        icon: '📅',
        parameters: [
            {
                id: 'unit',
                label: 'Round down to',
                description: 'Precision level',
                type: 'select',
                required: true,
                default: 'DAY',
                options: [
                    { label: 'Day', value: 'DAY' },
                    { label: 'Month', value: 'MONTH' },
                    { label: 'Year', value: 'YEAR' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `TRUNC(${input}, '${params.unit}')`,
            postgresql: (params, input) => `DATE_TRUNC('${params.unit.toLowerCase()}', ${input})`,
            redshift: (params, input) => `DATE_TRUNC('${params.unit.toLowerCase()}', ${input})`,
        },
        sample: {
            input: '"2024-06-15 14:32:00"',
            output: '"2024-06-15"',
        },
        meta: {},
    },
    date_add: {
        id: 'date_add',
        label: 'Add Time to a Date',
        description: 'Adds days, months, or years to a date value.',
        category: 'datetime',
        icon: '➕',
        parameters: [
            {
                id: 'amount',
                label: 'Add',
                description: 'Number of units to add',
                type: 'number',
                required: true,
                default: 1,
            },
            {
                id: 'unit',
                label: 'Unit',
                description: 'Days, months, or years',
                type: 'select',
                required: true,
                default: 'DAY',
                options: [
                    { label: 'Days', value: 'DAY' },
                    { label: 'Months', value: 'MONTH' },
                    { label: 'Years', value: 'YEAR' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => params.unit === 'MONTH' ? `ADD_MONTHS(${input}, ${params.amount})` : `DATE_ADD(${input}, ${params.amount})`,
            postgresql: (params, input) => `${input} + INTERVAL '${params.amount} ${params.unit.toLowerCase()}'`,
            redshift: (params, input) => `DATEADD(${params.unit.toLowerCase()}, ${params.amount}, ${input})`,
        },
        sample: {
            input: '"2024-06-15"',
            output: '"2024-07-15"',
        },
        meta: {},
    },
    // ========== WORK WITH NUMBERS ==========
    round: {
        id: 'round',
        label: 'Round a Number',
        description: 'Rounds a decimal to a set number of decimal places.',
        category: 'numeric',
        icon: '🔢',
        parameters: [
            {
                id: 'places',
                label: 'Decimal places',
                description: 'Number of decimal places (0–10)',
                type: 'number',
                required: true,
                default: 2,
            },
            {
                id: 'mode',
                label: 'Rounding mode',
                description: 'How to round',
                type: 'select',
                required: true,
                default: 'HALF_UP',
                options: [
                    { label: 'Standard (half-up)', value: 'HALF_UP' },
                    { label: 'Always round up (ceiling)', value: 'UP' },
                    { label: 'Always round down (floor)', value: 'DOWN' },
                ],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `ROUND(${input}, ${params.places})`,
            postgresql: (params, input) => `ROUND(${input}::NUMERIC, ${params.places})`,
            redshift: (params, input) => `ROUND(${input}, ${params.places})`,
        },
        sample: {
            input: 1200.567,
            output: 1200.57,
        },
        meta: {},
    },
    floor: {
        id: 'floor',
        label: 'Round Down to Whole Number',
        description: 'Always rounds down to the nearest whole number.',
        category: 'numeric',
        icon: '⬇️',
        parameters: [],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `FLOOR(${input})`,
            postgresql: (params, input) => `FLOOR(${input})`,
            redshift: (params, input) => `FLOOR(${input})`,
        },
        sample: {
            input: 1200.99,
            output: 1200,
        },
        meta: {},
    },
    ceil: {
        id: 'ceil',
        label: 'Round Up to Whole Number',
        description: 'Always rounds up to the nearest whole number.',
        category: 'numeric',
        icon: '⬆️',
        parameters: [],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `CEIL(${input})`,
            postgresql: (params, input) => `CEIL(${input})`,
            redshift: (params, input) => `CEIL(${input})`,
        },
        sample: {
            input: 1200.01,
            output: 1201,
        },
        meta: {},
    },
    // ========== REGEX ==========
    regex_extract: {
        id: 'regex_extract',
        label: 'Pull Text Using a Pattern',
        description: 'Finds text matching a pattern. Use pattern wizard to build and test.',
        category: 'regex',
        icon: '🔍',
        parameters: [
            {
                id: 'pattern',
                label: 'Pattern',
                description: 'Regular expression pattern',
                type: 'expression',
                required: true,
                placeholder: 'ORD-(\\d{4}-\\d{3})',
            },
            {
                id: 'group',
                label: 'Which match to use',
                description: 'Group number (1 = first group)',
                type: 'number',
                required: true,
                default: 1,
            },
            {
                id: 'caseInsensitive',
                label: 'Case insensitive',
                description: 'Ignore case',
                type: 'toggle',
                required: false,
                default: false,
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `REGEXP_EXTRACT(${input}, '${params.pattern}', ${params.group})`,
            postgresql: (params, input) => `(regexp_matches(${input}, '${params.pattern}'))[${params.group}]`,
            redshift: (params, input) => `REGEXP_SUBSTR(${input}, '${params.pattern}', 1, 1, 'c', ${params.group})`,
        },
        sample: {
            input: '"REF: ORD-2024-001"',
            output: '"2024-001"',
        },
        meta: {},
    },
    // ========== AGGREGATION / NULL HANDLING ==========
    coalesce: {
        id: 'coalesce',
        label: 'Use First Available Value',
        description: 'Checks values in order and uses the first non-blank one.',
        category: 'aggregation',
        icon: '❓',
        parameters: [
            {
                id: 'fallbacks',
                label: 'Check in order',
                description: 'List of values or column references',
                type: 'list',
                required: true,
                default: [],
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `COALESCE(${input}, ${params.fallbacks.join(', ')})`,
            postgresql: (params, input) => `COALESCE(${input}, ${params.fallbacks.join(', ')})`,
            redshift: (params, input) => `COALESCE(${input}, ${params.fallbacks.join(', ')})`,
        },
        sample: {
            input: null,
            output: '"Unknown"',
        },
        meta: {},
    },
    null_if: {
        id: 'null_if',
        label: 'Blank Out a Specific Value',
        description: 'If value equals something specific, treat it as blank (null).',
        category: 'aggregation',
        icon: '🚫',
        parameters: [
            {
                id: 'value',
                label: 'If equals',
                description: 'The value to treat as null',
                type: 'text',
                required: true,
                placeholder: 'N/A',
            },
        ],
        engineSupport: {
            spark: 'native',
            postgresql: 'native',
            redshift: 'native',
        },
        codeGenTemplate: {
            spark: (params, input) => `NULLIF(${input}, '${params.value}')`,
            postgresql: (params, input) => `NULLIF(${input}, '${params.value}')`,
            redshift: (params, input) => `NULLIF(${input}, '${params.value}')`,
        },
        sample: {
            input: '"N/A"',
            output: null,
        },
        meta: {},
    },
    // ========== CUSTOM ==========
    custom_sql: {
        id: 'custom_sql',
        label: 'Custom Expression',
        description: 'Write your own expression for advanced use cases.',
        category: 'custom',
        icon: '⚙️',
        parameters: [
            {
                id: 'expression',
                label: 'Expression',
                description: 'Write SQL for this engine',
                type: 'expression',
                required: true,
                placeholder: 'CAST(column AS VARCHAR)',
            },
        ],
        engineSupport: {
            spark: 'custom',
            postgresql: 'custom',
            redshift: 'custom',
        },
        codeGenTemplate: {
            spark: (params, input) => params.expression,
            postgresql: (params, input) => params.expression,
            redshift: (params, input) => params.expression,
        },
        sample: {
            input: 'any',
            output: 'depends on expression',
        },
        meta: {},
    },
};
/**
 * Get transform by technical ID
 */
export function getTransform(id) {
    return TRANSFORM_REGISTRY[id] || null;
}
/**
 * Get all transforms in a category
 */
export function getTransformsInCategory(category) {
    return Object.values(TRANSFORM_REGISTRY).filter(t => t.category === category);
}
/**
 * Get all supported transforms for an engine
 */
export function getSupportedTransforms(engine) {
    return Object.values(TRANSFORM_REGISTRY).filter(t => t.engineSupport[engine] !== 'unsupported');
}
/**
 * Check if a transform is natively supported on an engine
 */
export function isNativelySupported(transformId, engine) {
    const transform = getTransform(transformId);
    if (!transform)
        return false;
    return transform.engineSupport[engine] === 'native';
}
