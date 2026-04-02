/**
 * Transform Primitive Registry — F-31 expanded to 35 primitives
 *
 * Original 13: to_number, to_date, cast, substring, trim, trim_timestamp, date_add,
 *              round, floor, ceil, regex_extract, coalesce, null_if, custom_sql
 * Added 22:    ltrim, rtrim, upper, lower, title_case, length, concat, pad_left, pad_right, replace,
 *              to_timestamp, date_format, date_diff,
 *              abs, mod, power,
 *              replace_regex, matches_regex,
 *              case_when
 */

export type TransformCategory =
  | 'convert'
  | 'text'
  | 'datetime'
  | 'numeric'
  | 'regex'
  | 'conditional'
  | 'aggregation'
  | 'custom';

export type ErrorPolicy = 'FAIL' | 'RETURN_NULL' | 'USE_DEFAULT' | 'SKIP_STEP';

export type ParameterType = 'text' | 'number' | 'select' | 'toggle' | 'date' | 'expression' | 'list';

export interface ParameterDef {
  id: string;
  label: string;
  description: string;
  type: ParameterType;
  required: boolean;
  default?: any;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  validation?: (value: any) => { valid: boolean; error?: string };
}

export interface TransformPrimitive {
  id: string;
  label: string;
  description: string;
  category: TransformCategory;
  icon: string;
  parameters: ParameterDef[];
  engineSupport: {
    spark: 'native' | 'join' | 'custom' | 'unsupported';
    postgresql: 'native' | 'join' | 'custom' | 'unsupported';
    redshift: 'native' | 'join' | 'custom' | 'unsupported';
  };
  codeGenTemplate: {
    spark?: (params: Record<string, any>, inputExpr: string) => string;
    postgresql?: (params: Record<string, any>, inputExpr: string) => string;
    redshift?: (params: Record<string, any>, inputExpr: string) => string;
  };
  sample: { input: string | number | null; output: string | number | null };
  meta: { exampleInputs?: string[]; exampleFormats?: string[]; relatedTransforms?: string[] };
}

export const TRANSFORM_REGISTRY: Record<string, TransformPrimitive> = {

  // ─── CONVERT ──────────────────────────────────────────────────────────────

  to_number: {
    id: 'to_number', label: 'Convert Text to Number', category: 'convert', icon: '🔢',
    description: "Turns a text value like '1,200.50' into a real number.",
    parameters: [
      { id: 'format', label: 'Number format', type: 'text', required: true, placeholder: '#,##0.00', default: '#,##0.00', description: 'e.g. #,##0.00' },
      { id: 'locale', label: 'Locale', type: 'select', required: true, default: 'en_US', description: 'Regional format',
        options: [{ label: 'English (US)', value: 'en_US' }, { label: 'English (UK)', value: 'en_GB' }, { label: 'French', value: 'fr_FR' }, { label: 'German', value: 'de_DE' }] },
      { id: 'onFail', label: 'If it cannot convert', type: 'select', required: true, default: 'RETURN_NULL', description: 'On error behaviour',
        options: [{ label: 'Use blank (null)', value: 'RETURN_NULL' }, { label: 'Fail the pipeline', value: 'FAIL' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `CAST(REGEXP_REPLACE(${i}, '[^0-9.]', '') AS DECIMAL)`,
      postgresql: (p, i) => `CAST(${i} AS NUMERIC)`,
      redshift: (p, i) => `CAST(${i} AS NUMERIC)`,
    },
    sample: { input: '"1,200.50"', output: 1200.50 },
    meta: { exampleInputs: ['"1,200.50"', '"1200"', '"$1,234.56"'] },
  },

  to_date: {
    id: 'to_date', label: 'Convert Text to Date', category: 'convert', icon: '📅',
    description: "Converts a text value that looks like a date into a proper date.",
    parameters: [
      { id: 'format', label: 'Date format', type: 'text', required: true, placeholder: 'dd-MMM-yyyy', default: 'dd-MMM-yyyy', description: 'Date format string' },
      { id: 'timezone', label: 'Timezone', type: 'select', required: false, default: 'UTC', description: 'IANA timezone',
        options: [{ label: 'UTC', value: 'UTC' }, { label: 'America/New_York', value: 'America/New_York' }, { label: 'Europe/London', value: 'Europe/London' }] },
      { id: 'strictMode', label: 'Strict matching', type: 'toggle', required: false, default: false, description: 'Fail on partial matches' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `TO_DATE(${i}, '${p.format}')`,
      postgresql: (p, i) => `TO_DATE(${i}, '${p.format}')`,
      redshift: (p, i) => `TO_DATE(${i}, '${p.format}')`,
    },
    sample: { input: '"15-Jun-2024"', output: '"2024-06-15"' },
    meta: { exampleFormats: ['dd-MMM-yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] },
  },

  cast: {
    id: 'cast', label: 'Change Data Type', category: 'convert', icon: '🔄',
    description: 'Directly changes the data type of this column value.',
    parameters: [
      { id: 'targetType', label: 'Convert to', type: 'select', required: true, default: 'TEXT', description: 'New data type',
        options: [{ label: 'Text', value: 'TEXT' }, { label: 'Whole Number (Integer)', value: 'INTEGER' }, { label: 'Decimal Number', value: 'DECIMAL' }, { label: 'Date', value: 'DATE' }, { label: 'Timestamp', value: 'TIMESTAMP' }, { label: 'Boolean', value: 'BOOLEAN' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `CAST(${i} AS ${p.targetType})`,
      postgresql: (p, i) => `CAST(${i} AS ${p.targetType})`,
      redshift: (p, i) => `CAST(${i} AS ${p.targetType})`,
    },
    sample: { input: 1200.75, output: 1200 },
    meta: {},
  },

  // ─── TEXT ─────────────────────────────────────────────────────────────────

  substring: {
    id: 'substring', label: 'Extract Part of Text', category: 'text', icon: '✂️',
    description: 'Pulls out a piece of text from a specific position.',
    parameters: [
      { id: 'startPos', label: 'Start at position', type: 'number', required: true, default: 1, description: '1 = first character' },
      { id: 'length', label: 'How many characters', type: 'number', required: true, default: 1, description: 'Length of substring' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `SUBSTRING(${i}, ${p.startPos}, ${p.length})`,
      postgresql: (p, i) => `SUBSTRING(${i}, ${p.startPos}, ${p.length})`,
      redshift: (p, i) => `SUBSTRING(${i}, ${p.startPos}, ${p.length})`,
    },
    sample: { input: '"ORDER-20240615"', output: '"20240615"' },
    meta: {},
  },

  trim: {
    id: 'trim', label: 'Trim Whitespace', category: 'text', icon: '✨',
    description: 'Removes leading and trailing spaces from text.',
    parameters: [
      { id: 'sides', label: 'Trim from', type: 'select', required: true, default: 'BOTH', description: 'Which side',
        options: [{ label: 'Both sides', value: 'BOTH' }, { label: 'Left side only', value: 'LEFT' }, { label: 'Right side only', value: 'RIGHT' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `TRIM(${i})`,
      postgresql: (p, i) => `TRIM(${i})`,
      redshift: (p, i) => `TRIM(${i})`,
    },
    sample: { input: '"  Hello World  "', output: '"Hello World"' },
    meta: {},
  },

  ltrim: {
    id: 'ltrim', label: 'Trim Left Whitespace', category: 'text', icon: '⇤',
    description: 'Removes leading spaces from the left side of text.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `LTRIM(${i})`,
      postgresql: (p, i) => `LTRIM(${i})`,
      redshift: (p, i) => `LTRIM(${i})`,
    },
    sample: { input: '"  Hello"', output: '"Hello"' },
    meta: { relatedTransforms: ['rtrim', 'trim'] },
  },

  rtrim: {
    id: 'rtrim', label: 'Trim Right Whitespace', category: 'text', icon: '⇥',
    description: 'Removes trailing spaces from the right side of text.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `RTRIM(${i})`,
      postgresql: (p, i) => `RTRIM(${i})`,
      redshift: (p, i) => `RTRIM(${i})`,
    },
    sample: { input: '"Hello  "', output: '"Hello"' },
    meta: { relatedTransforms: ['ltrim', 'trim'] },
  },

  upper: {
    id: 'upper', label: 'Convert to UPPERCASE', category: 'text', icon: 'A',
    description: 'Converts all characters in the text to uppercase.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `UPPER(${i})`,
      postgresql: (p, i) => `UPPER(${i})`,
      redshift: (p, i) => `UPPER(${i})`,
    },
    sample: { input: '"hello world"', output: '"HELLO WORLD"' },
    meta: { relatedTransforms: ['lower', 'title_case'] },
  },

  lower: {
    id: 'lower', label: 'Convert to lowercase', category: 'text', icon: 'a',
    description: 'Converts all characters in the text to lowercase.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `LOWER(${i})`,
      postgresql: (p, i) => `LOWER(${i})`,
      redshift: (p, i) => `LOWER(${i})`,
    },
    sample: { input: '"HELLO WORLD"', output: '"hello world"' },
    meta: { relatedTransforms: ['upper', 'title_case'] },
  },

  title_case: {
    id: 'title_case', label: 'Convert to Title Case', category: 'text', icon: 'Aa',
    description: 'Capitalizes the first letter of each word.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'custom', redshift: 'custom' },
    codeGenTemplate: {
      spark: (p, i) => `INITCAP(${i})`,
      postgresql: (p, i) => `INITCAP(${i})`,
      redshift: (p, i) => `INITCAP(${i})`,
    },
    sample: { input: '"hello world"', output: '"Hello World"' },
    meta: { relatedTransforms: ['upper', 'lower'] },
  },

  length: {
    id: 'length', label: 'Get Text Length', category: 'text', icon: '📏',
    description: 'Returns the number of characters in the text.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `LENGTH(${i})`,
      postgresql: (p, i) => `LENGTH(${i})`,
      redshift: (p, i) => `LEN(${i})`,
    },
    sample: { input: '"Hello"', output: 5 },
    meta: {},
  },

  concat: {
    id: 'concat', label: 'Join Text Together', category: 'text', icon: '🔗',
    description: 'Combines this value with additional text or columns.',
    parameters: [
      { id: 'values', label: 'Values to append', type: 'list', required: true, default: [], description: 'Text literals or column names', placeholder: '"suffix", other_col' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `CONCAT(${i}, ${(p.values ?? []).join(', ')})`,
      postgresql: (p, i) => `CONCAT(${i}, ${(p.values ?? []).join(', ')})`,
      redshift: (p, i) => `${i} || ${(p.values ?? []).join(' || ')}`,
    },
    sample: { input: '"Hello"', output: '"Hello World"' },
    meta: {},
  },

  pad_left: {
    id: 'pad_left', label: 'Pad Text on Left', category: 'text', icon: '⬅',
    description: 'Adds characters to the left until the text reaches a desired length.',
    parameters: [
      { id: 'length', label: 'Target length', type: 'number', required: true, default: 10, description: 'Total character length after padding' },
      { id: 'padChar', label: 'Pad character', type: 'text', required: true, default: '0', placeholder: '0', description: 'Character to pad with' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `LPAD(${i}, ${p.length}, '${p.padChar}')`,
      postgresql: (p, i) => `LPAD(${i}, ${p.length}, '${p.padChar}')`,
      redshift: (p, i) => `LPAD(${i}, ${p.length}, '${p.padChar}')`,
    },
    sample: { input: '"42"', output: '"0000000042"' },
    meta: { relatedTransforms: ['pad_right'] },
  },

  pad_right: {
    id: 'pad_right', label: 'Pad Text on Right', category: 'text', icon: '➡',
    description: 'Adds characters to the right until the text reaches a desired length.',
    parameters: [
      { id: 'length', label: 'Target length', type: 'number', required: true, default: 10, description: 'Total character length after padding' },
      { id: 'padChar', label: 'Pad character', type: 'text', required: true, default: ' ', placeholder: ' ', description: 'Character to pad with' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `RPAD(${i}, ${p.length}, '${p.padChar}')`,
      postgresql: (p, i) => `RPAD(${i}, ${p.length}, '${p.padChar}')`,
      redshift: (p, i) => `RPAD(${i}, ${p.length}, '${p.padChar}')`,
    },
    sample: { input: '"Hi"', output: '"Hi        "' },
    meta: { relatedTransforms: ['pad_left'] },
  },

  replace: {
    id: 'replace', label: 'Replace Text', category: 'text', icon: '🔁',
    description: 'Replaces all occurrences of a search string with a replacement.',
    parameters: [
      { id: 'search',  label: 'Find',         type: 'text', required: true,  placeholder: 'old text', description: 'Text to find' },
      { id: 'replace', label: 'Replace with', type: 'text', required: false, placeholder: 'new text', default: '', description: 'Replacement text (blank to remove)' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `REPLACE(${i}, '${p.search}', '${p.replace ?? ''}')`,
      postgresql: (p, i) => `REPLACE(${i}, '${p.search}', '${p.replace ?? ''}')`,
      redshift: (p, i) => `REPLACE(${i}, '${p.search}', '${p.replace ?? ''}')`,
    },
    sample: { input: '"Hello, World!"', output: '"Hello, Planet!"' },
    meta: { relatedTransforms: ['replace_regex'] },
  },

  // ─── DATETIME ─────────────────────────────────────────────────────────────

  trim_timestamp: {
    id: 'trim_timestamp', label: 'Remove Time from Date', category: 'datetime', icon: '📅',
    description: 'Keeps only the date part and removes the time.',
    parameters: [
      { id: 'unit', label: 'Round down to', type: 'select', required: true, default: 'DAY', description: 'Precision level',
        options: [{ label: 'Day', value: 'DAY' }, { label: 'Month', value: 'MONTH' }, { label: 'Year', value: 'YEAR' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `TRUNC(${i}, '${p.unit}')`,
      postgresql: (p, i) => `DATE_TRUNC('${p.unit.toLowerCase()}', ${i})`,
      redshift: (p, i) => `DATE_TRUNC('${p.unit.toLowerCase()}', ${i})`,
    },
    sample: { input: '"2024-06-15 14:32:00"', output: '"2024-06-15"' },
    meta: {},
  },

  date_add: {
    id: 'date_add', label: 'Add Time to a Date', category: 'datetime', icon: '➕',
    description: 'Adds days, months, or years to a date value.',
    parameters: [
      { id: 'amount', label: 'Add', type: 'number', required: true, default: 1, description: 'Number of units to add' },
      { id: 'unit', label: 'Unit', type: 'select', required: true, default: 'DAY', description: 'Unit',
        options: [{ label: 'Days', value: 'DAY' }, { label: 'Months', value: 'MONTH' }, { label: 'Years', value: 'YEAR' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => p.unit === 'MONTH' ? `ADD_MONTHS(${i}, ${p.amount})` : `DATE_ADD(${i}, ${p.amount})`,
      postgresql: (p, i) => `${i} + INTERVAL '${p.amount} ${p.unit.toLowerCase()}'`,
      redshift: (p, i) => `DATEADD(${p.unit.toLowerCase()}, ${p.amount}, ${i})`,
    },
    sample: { input: '"2024-06-15"', output: '"2024-07-15"' },
    meta: {},
  },

  to_timestamp: {
    id: 'to_timestamp', label: 'Convert Text to Timestamp', category: 'datetime', icon: '🕐',
    description: 'Converts a text value to a date+time timestamp.',
    parameters: [
      { id: 'format', label: 'Timestamp format', type: 'text', required: true, default: 'yyyy-MM-dd HH:mm:ss', placeholder: 'yyyy-MM-dd HH:mm:ss', description: 'Java/Spark datetime format string' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `TO_TIMESTAMP(${i}, '${p.format}')`,
      postgresql: (p, i) => `TO_TIMESTAMP(${i}, '${p.format}')`,
      redshift: (p, i) => `TO_TIMESTAMP(${i}, '${p.format}')`,
    },
    sample: { input: '"2024-06-15 14:30:00"', output: '2024-06-15T14:30:00' },
    meta: { relatedTransforms: ['to_date', 'date_format'] },
  },

  date_format: {
    id: 'date_format', label: 'Format a Date as Text', category: 'datetime', icon: '📋',
    description: 'Converts a date/timestamp to a formatted text string.',
    parameters: [
      { id: 'format', label: 'Output format', type: 'text', required: true, default: 'yyyy-MM-dd', placeholder: 'dd/MM/yyyy', description: 'Java/Spark datetime format string' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `DATE_FORMAT(${i}, '${p.format}')`,
      postgresql: (p, i) => `TO_CHAR(${i}, '${p.format}')`,
      redshift: (p, i) => `TO_CHAR(${i}, '${p.format}')`,
    },
    sample: { input: '2024-06-15', output: '"15/06/2024"' },
    meta: { relatedTransforms: ['to_date', 'to_timestamp'] },
  },

  extract_date_part: {
    id: 'extract_date_part', label: 'Extract Date Part', category: 'datetime', icon: '🗓',
    description: 'Pulls out one part of a date or timestamp, such as month, year, or day.',
    parameters: [
      {
        id: 'part',
        label: 'Date part',
        type: 'select',
        required: true,
        default: 'MONTH',
        description: 'Which part to extract',
        options: [
          { label: 'Year', value: 'YEAR' },
          { label: 'Month', value: 'MONTH' },
          { label: 'Day', value: 'DAY' },
          { label: 'Hour', value: 'HOUR' },
          { label: 'Minute', value: 'MINUTE' },
          { label: 'Second', value: 'SECOND' },
        ],
      },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `EXTRACT(${p.part ?? 'MONTH'} FROM ${i})`,
      postgresql: (p, i) => `EXTRACT(${String(p.part ?? 'MONTH').toLowerCase()} FROM ${i})`,
      redshift: (p, i) => `EXTRACT(${String(p.part ?? 'MONTH').toLowerCase()} FROM ${i})`,
    },
    sample: { input: '"2024-06-15"', output: 6 },
    meta: { relatedTransforms: ['date_format', 'to_date', 'to_timestamp'] },
  },

  date_diff: {
    id: 'date_diff', label: 'Calculate Date Difference', category: 'datetime', icon: '📐',
    description: 'Computes the number of days (or other units) between two dates.',
    parameters: [
      { id: 'endDate', label: 'End date column', type: 'text', required: true, placeholder: 'end_date', description: 'Column or literal for the end date' },
      { id: 'unit', label: 'Unit', type: 'select', required: true, default: 'DAY', description: 'Unit of difference',
        options: [{ label: 'Days', value: 'DAY' }, { label: 'Months', value: 'MONTH' }, { label: 'Years', value: 'YEAR' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) =>
        p.unit === 'DAY'   ? `DATEDIFF(${p.endDate}, ${i})`
        : p.unit === 'MONTH' ? `MONTHS_BETWEEN(${p.endDate}, ${i})`
        : `(YEAR(${p.endDate}) - YEAR(${i}))`,
      postgresql: (p, i) =>
        p.unit === 'DAY'   ? `DATE_PART('day', ${p.endDate}::timestamp - ${i}::timestamp)`
        : p.unit === 'MONTH' ? `DATE_PART('month', AGE(${p.endDate}, ${i}))`
        : `DATE_PART('year', AGE(${p.endDate}, ${i}))`,
      redshift: (p, i) => `DATEDIFF(${p.unit.toLowerCase()}, ${i}, ${p.endDate})`,
    },
    sample: { input: '2024-01-01', output: 180 },
    meta: { relatedTransforms: ['date_add', 'trim_timestamp'] },
  },

  // ─── NUMERIC ──────────────────────────────────────────────────────────────

  round: {
    id: 'round', label: 'Round a Number', category: 'numeric', icon: '🔢',
    description: 'Rounds a decimal to a set number of decimal places.',
    parameters: [
      { id: 'places', label: 'Decimal places', type: 'number', required: true, default: 2, description: 'Number of decimal places (0-10)' },
      { id: 'mode', label: 'Rounding mode', type: 'select', required: true, default: 'HALF_UP', description: 'How to round',
        options: [{ label: 'Standard (half-up)', value: 'HALF_UP' }, { label: 'Always round up', value: 'UP' }, { label: 'Always round down', value: 'DOWN' }] },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `ROUND(${i}, ${p.places})`,
      postgresql: (p, i) => `ROUND(${i}::NUMERIC, ${p.places})`,
      redshift: (p, i) => `ROUND(${i}, ${p.places})`,
    },
    sample: { input: 1200.567, output: 1200.57 },
    meta: {},
  },

  floor: {
    id: 'floor', label: 'Round Down to Whole Number', category: 'numeric', icon: '⬇️',
    description: 'Always rounds down to the nearest whole number.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `FLOOR(${i})`,
      postgresql: (p, i) => `FLOOR(${i})`,
      redshift: (p, i) => `FLOOR(${i})`,
    },
    sample: { input: 1200.99, output: 1200 },
    meta: {},
  },

  ceil: {
    id: 'ceil', label: 'Round Up to Whole Number', category: 'numeric', icon: '⬆️',
    description: 'Always rounds up to the nearest whole number.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `CEIL(${i})`,
      postgresql: (p, i) => `CEIL(${i})`,
      redshift: (p, i) => `CEIL(${i})`,
    },
    sample: { input: 1200.01, output: 1201 },
    meta: {},
  },

  abs: {
    id: 'abs', label: 'Absolute Value', category: 'numeric', icon: '|x|',
    description: 'Returns the absolute (non-negative) value of a number.',
    parameters: [],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `ABS(${i})`,
      postgresql: (p, i) => `ABS(${i})`,
      redshift: (p, i) => `ABS(${i})`,
    },
    sample: { input: -42.5, output: 42.5 },
    meta: { relatedTransforms: ['round', 'floor', 'ceil'] },
  },

  mod: {
    id: 'mod', label: 'Modulo (Remainder)', category: 'numeric', icon: '%',
    description: 'Returns the remainder after dividing by a number.',
    parameters: [
      { id: 'divisor', label: 'Divide by', type: 'number', required: true, default: 2, description: 'The divisor' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `MOD(${i}, ${p.divisor})`,
      postgresql: (p, i) => `MOD(${i}, ${p.divisor})`,
      redshift: (p, i) => `${i} % ${p.divisor}`,
    },
    sample: { input: 17, output: 1 },
    meta: {},
  },

  power: {
    id: 'power', label: 'Raise to Power', category: 'numeric', icon: 'xn',
    description: 'Raises a number to an exponent.',
    parameters: [
      { id: 'exponent', label: 'Exponent', type: 'number', required: true, default: 2, description: 'The power to raise to' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `POWER(${i}, ${p.exponent})`,
      postgresql: (p, i) => `POWER(${i}, ${p.exponent})`,
      redshift: (p, i) => `POWER(${i}, ${p.exponent})`,
    },
    sample: { input: 3, output: 9 },
    meta: {},
  },

  // ─── REGEX ────────────────────────────────────────────────────────────────

  regex_extract: {
    id: 'regex_extract', label: 'Pull Text Using a Pattern', category: 'regex', icon: '🔍',
    description: 'Finds text matching a regex pattern.',
    parameters: [
      { id: 'pattern', label: 'Pattern', type: 'expression', required: true, placeholder: 'ORD-(\\d{4}-\\d{3})', description: 'Regular expression pattern' },
      { id: 'group', label: 'Which match to use', type: 'number', required: true, default: 1, description: 'Group number (1 = first group)' },
      { id: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', required: false, default: false, description: 'Ignore case' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `REGEXP_EXTRACT(${i}, '${p.pattern}', ${p.group})`,
      postgresql: (p, i) => `(regexp_matches(${i}, '${p.pattern}'))[${p.group}]`,
      redshift: (p, i) => `REGEXP_SUBSTR(${i}, '${p.pattern}', 1, 1, 'c', ${p.group})`,
    },
    sample: { input: '"REF: ORD-2024-001"', output: '"2024-001"' },
    meta: {},
  },

  replace_regex: {
    id: 'replace_regex', label: 'Replace Text Using a Pattern', category: 'regex', icon: '🔄',
    description: 'Finds text matching a regex pattern and replaces it.',
    parameters: [
      { id: 'pattern',     label: 'Pattern',          type: 'expression', required: true,  placeholder: '[^a-zA-Z0-9]', description: 'Regular expression to match' },
      { id: 'replacement', label: 'Replace with',     type: 'text',       required: false, default: '',  placeholder: '',  description: 'Replacement string (blank to remove)' },
      { id: 'replaceAll',  label: 'Replace all',      type: 'toggle',     required: false, default: true, description: 'Replace every match vs. only the first' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `REGEXP_REPLACE(${i}, '${p.pattern}', '${p.replacement ?? ''}')`,
      postgresql: (p, i) => `REGEXP_REPLACE(${i}, '${p.pattern}', '${p.replacement ?? ''}', '${p.replaceAll ? 'g' : ''}')`,
      redshift: (p, i) => `REGEXP_REPLACE(${i}, '${p.pattern}', '${p.replacement ?? ''}')`,
    },
    sample: { input: '"Hello, World!"', output: '"HelloWorld"' },
    meta: { relatedTransforms: ['regex_extract', 'matches_regex'] },
  },

  matches_regex: {
    id: 'matches_regex', label: 'Check if Text Matches Pattern', category: 'regex', icon: '✅',
    description: 'Returns true/false based on whether the text matches a regex pattern.',
    parameters: [
      { id: 'pattern',         label: 'Pattern',          type: 'expression', required: true,  placeholder: '^[A-Z0-9]+$', description: 'Regex pattern to test against' },
      { id: 'caseInsensitive', label: 'Case insensitive', type: 'toggle',     required: false, default: false, description: 'Ignore case when matching' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `(${i} RLIKE '${p.pattern}')`,
      postgresql: (p, i) => `(${i} ~ '${p.caseInsensitive ? '(?i)' : ''}${p.pattern}')`,
      redshift: (p, i) => `(CASE WHEN ${i} ~ '${p.pattern}' THEN TRUE ELSE FALSE END)`,
    },
    sample: { input: '"ORD-1234"', output: 'true' },
    meta: { relatedTransforms: ['regex_extract', 'replace_regex'] },
  },

  // ─── AGGREGATION / NULL HANDLING ──────────────────────────────────────────

  coalesce: {
    id: 'coalesce', label: 'Use First Available Value', category: 'aggregation', icon: '❓',
    description: 'Checks values in order and uses the first non-blank one.',
    parameters: [
      { id: 'fallbacks', label: 'Check in order', type: 'list', required: true, default: [], description: 'List of values or column references' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `COALESCE(${i}, ${(p.fallbacks ?? []).join(', ')})`,
      postgresql: (p, i) => `COALESCE(${i}, ${(p.fallbacks ?? []).join(', ')})`,
      redshift: (p, i) => `COALESCE(${i}, ${(p.fallbacks ?? []).join(', ')})`,
    },
    sample: { input: null, output: '"Unknown"' },
    meta: {},
  },

  null_if: {
    id: 'null_if', label: 'Blank Out a Specific Value', category: 'aggregation', icon: '🚫',
    description: 'If value equals something specific, treat it as blank (null).',
    parameters: [
      { id: 'value', label: 'If equals', type: 'text', required: true, placeholder: 'N/A', description: 'The value to treat as null' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => `NULLIF(${i}, '${p.value}')`,
      postgresql: (p, i) => `NULLIF(${i}, '${p.value}')`,
      redshift: (p, i) => `NULLIF(${i}, '${p.value}')`,
    },
    sample: { input: '"N/A"', output: null },
    meta: {},
  },

  // ─── CONDITIONAL ──────────────────────────────────────────────────────────

  case_when: {
    id: 'case_when', label: 'If/Then/Else (CASE WHEN)', category: 'conditional', icon: '🔀',
    description: 'Returns different values based on conditions — like an Excel IF() with multiple branches.',
    parameters: [
      { id: 'branches', label: 'Conditions', type: 'list', required: true, default: [{ when: '', then: '' }], description: 'List of {when, then} pairs' },
      { id: 'else', label: 'Otherwise (ELSE)', type: 'text', required: false, default: 'NULL', placeholder: 'NULL', description: 'Value if no condition matches' },
    ],
    engineSupport: { spark: 'native', postgresql: 'native', redshift: 'native' },
    codeGenTemplate: {
      spark: (p, i) => {
        const branches = (p.branches ?? []).filter((b: any) => b.when && b.then);
        const cases = branches.map((b: any) => `WHEN ${b.when} THEN ${b.then}`).join(' ');
        return `CASE ${cases} ELSE ${p.else ?? 'NULL'} END`;
      },
      postgresql: (p, i) => {
        const branches = (p.branches ?? []).filter((b: any) => b.when && b.then);
        const cases = branches.map((b: any) => `WHEN ${b.when} THEN ${b.then}`).join(' ');
        return `CASE ${cases} ELSE ${p.else ?? 'NULL'} END`;
      },
      redshift: (p, i) => {
        const branches = (p.branches ?? []).filter((b: any) => b.when && b.then);
        const cases = branches.map((b: any) => `WHEN ${b.when} THEN ${b.then}`).join(' ');
        return `CASE ${cases} ELSE ${p.else ?? 'NULL'} END`;
      },
    },
    sample: { input: '"ACTIVE"', output: '"Active Customer"' },
    meta: { relatedTransforms: ['coalesce', 'null_if'] },
  },

  // ─── CUSTOM ───────────────────────────────────────────────────────────────

  custom_sql: {
    id: 'custom_sql', label: 'Custom Expression', category: 'custom', icon: '⚙️',
    description: 'Write your own expression for advanced use cases.',
    parameters: [
      { id: 'expression', label: 'Expression', type: 'expression', required: true, placeholder: 'CAST(column AS VARCHAR)', description: 'Write SQL for this engine' },
    ],
    engineSupport: { spark: 'custom', postgresql: 'custom', redshift: 'custom' },
    codeGenTemplate: {
      spark: (p, i) => p.expression,
      postgresql: (p, i) => p.expression,
      redshift: (p, i) => p.expression,
    },
    sample: { input: 'any', output: 'depends on expression' },
    meta: {},
  },
};

export function getTransform(id: string): TransformPrimitive | null {
  return TRANSFORM_REGISTRY[id] || null;
}

export function getTransformsInCategory(category: TransformCategory): TransformPrimitive[] {
  return Object.values(TRANSFORM_REGISTRY).filter(t => t.category === category);
}

export function getSupportedTransforms(engine: 'spark' | 'postgresql' | 'redshift'): TransformPrimitive[] {
  return Object.values(TRANSFORM_REGISTRY).filter(t => t.engineSupport[engine] !== 'unsupported');
}

export function isNativelySupported(transformId: string, engine: 'spark' | 'postgresql' | 'redshift'): boolean {
  const transform = getTransform(transformId);
  if (!transform) return false;
  return transform.engineSupport[engine] === 'native';
}

/** Total count for audit tracking */
export const REGISTRY_SIZE = Object.keys(TRANSFORM_REGISTRY).length;
