/**
 * Capability Matrix
 * 
 * Defines which transformation primitives are natively supported for pushdown
 * to each source technology. Master configuration for function eligibility.
 */

export type SourceTechnology = 'oracle' | 'postgresql' | 'mysql' | 'sql_server' | 'redshift' | 'snowflake' | 'pyspark';

export type FunctionAvailability = 'native' | 'alternative' | 'none';

export interface FunctionCapability {
  sourceFunction?: string;        // Native function name in this technology (e.g., 'TO_NUMBER' for Oracle)
  availability: FunctionAvailability;
  notes?: string;                 // Additional context (version-specific, syntax notes, etc.)
  alternativePrimitive?: string;  // If availability is 'alternative', which primitive to suggest
  alternativeNote?: string;       // Why the alternative is needed
}

/**
 * Complete capability matrix — transformPrimitiveId → { technology → capability }
 */
export const CAPABILITY_MATRIX: Record<string, Record<SourceTechnology, FunctionCapability>> = {
  // ========== CONVERT DATA TYPE ==========

  to_number: {
    oracle: { sourceFunction: 'TO_NUMBER', availability: 'native' },
    postgresql: { sourceFunction: 'CAST', availability: 'native' },
    mysql: { sourceFunction: 'CAST', availability: 'native' },
    sql_server: { sourceFunction: 'CAST', availability: 'native' },
    redshift: { sourceFunction: 'TO_NUMBER', availability: 'native' },
    snowflake: { sourceFunction: 'TO_NUMBER', availability: 'native' },
    pyspark: { sourceFunction: 'CAST', availability: 'native' },
  },

  to_date: {
    oracle: { sourceFunction: 'TO_DATE', availability: 'native' },
    postgresql: { sourceFunction: 'TO_DATE', availability: 'native' },
    mysql: { sourceFunction: 'STR_TO_DATE', availability: 'native' },
    sql_server: { sourceFunction: 'CONVERT', availability: 'native' },
    redshift: { sourceFunction: 'TO_DATE', availability: 'native' },
    snowflake: { sourceFunction: 'TO_DATE', availability: 'native' },
    pyspark: { sourceFunction: 'to_date', availability: 'native' },
  },

  cast: {
    oracle: { sourceFunction: 'CAST', availability: 'native' },
    postgresql: { sourceFunction: 'CAST', availability: 'native' },
    mysql: { sourceFunction: 'CAST', availability: 'native' },
    sql_server: { sourceFunction: 'CAST', availability: 'native' },
    redshift: { sourceFunction: 'CAST', availability: 'native' },
    snowflake: { sourceFunction: 'CAST', availability: 'native' },
    pyspark: { sourceFunction: 'cast', availability: 'native' },
  },

  // ========== WORK WITH TEXT ==========

  substring: {
    oracle: { sourceFunction: 'SUBSTR', availability: 'native' },
    postgresql: { sourceFunction: 'SUBSTRING', availability: 'native' },
    mysql: { sourceFunction: 'SUBSTRING', availability: 'native' },
    sql_server: { sourceFunction: 'SUBSTRING', availability: 'native' },
    redshift: { sourceFunction: 'SUBSTRING', availability: 'native' },
    snowflake: { sourceFunction: 'SUBSTRING', availability: 'native' },
    pyspark: { sourceFunction: 'substring', availability: 'native' },
  },

  trim: {
    oracle: { sourceFunction: 'TRIM', availability: 'native' },
    postgresql: { sourceFunction: 'TRIM', availability: 'native' },
    mysql: { sourceFunction: 'TRIM', availability: 'native' },
    sql_server: { sourceFunction: 'TRIM', availability: 'native' },
    redshift: { sourceFunction: 'TRIM', availability: 'native' },
    snowflake: { sourceFunction: 'TRIM', availability: 'native' },
    pyspark: { sourceFunction: 'trim', availability: 'native' },
  },

  // ========== WORK WITH DATES ==========

  trim_timestamp: {
    oracle: { sourceFunction: 'TRUNC', availability: 'native' },
    postgresql: { sourceFunction: 'DATE_TRUNC', availability: 'native' },
    mysql: {
      sourceFunction: 'DATE()',
      availability: 'alternative',
      alternativePrimitive: 'cast',
      alternativeNote: 'MySQL DATE() truncates to day only. Use CAST for other precisions.',
    },
    sql_server: { sourceFunction: 'CAST AS DATE', availability: 'native' },
    redshift: { sourceFunction: 'DATE_TRUNC', availability: 'native' },
    snowflake: { sourceFunction: 'DATE_TRUNC', availability: 'native' },
    pyspark: { sourceFunction: 'trunc', availability: 'native' },
  },

  date_add: {
    oracle: { sourceFunction: '+ INTERVAL', availability: 'native' },
    postgresql: { sourceFunction: '+ INTERVAL', availability: 'native' },
    mysql: { sourceFunction: 'DATE_ADD', availability: 'native' },
    sql_server: { sourceFunction: 'DATEADD', availability: 'native' },
    redshift: { sourceFunction: 'DATEADD', availability: 'native' },
    snowflake: { sourceFunction: 'DATEADD', availability: 'native' },
    pyspark: { sourceFunction: 'date_add', availability: 'native' },
  },

  date_sub: {
    oracle: { sourceFunction: '- INTERVAL', availability: 'native' },
    postgresql: { sourceFunction: '- INTERVAL', availability: 'native' },
    mysql: { sourceFunction: 'DATE_SUB', availability: 'native' },
    sql_server: { sourceFunction: 'DATEADD', availability: 'native' },
    redshift: { sourceFunction: 'DATEADD', availability: 'native' },
    snowflake: { sourceFunction: 'DATEADD', availability: 'native' },
    pyspark: { sourceFunction: 'date_sub', availability: 'native' },
  },

  // ========== WORK WITH NUMBERS ==========

  round: {
    oracle: { sourceFunction: 'ROUND', availability: 'native' },
    postgresql: { sourceFunction: 'ROUND', availability: 'native' },
    mysql: { sourceFunction: 'ROUND', availability: 'native' },
    sql_server: { sourceFunction: 'ROUND', availability: 'native' },
    redshift: { sourceFunction: 'ROUND', availability: 'native' },
    snowflake: { sourceFunction: 'ROUND', availability: 'native' },
    pyspark: { sourceFunction: 'round', availability: 'native' },
  },

  floor: {
    oracle: { sourceFunction: 'FLOOR', availability: 'native' },
    postgresql: { sourceFunction: 'FLOOR', availability: 'native' },
    mysql: { sourceFunction: 'FLOOR', availability: 'native' },
    sql_server: { sourceFunction: 'FLOOR', availability: 'native' },
    redshift: { sourceFunction: 'FLOOR', availability: 'native' },
    snowflake: { sourceFunction: 'FLOOR', availability: 'native' },
    pyspark: { sourceFunction: 'floor', availability: 'native' },
  },

  ceil: {
    oracle: { sourceFunction: 'CEIL', availability: 'native' },
    postgresql: { sourceFunction: 'CEIL', availability: 'native' },
    mysql: { sourceFunction: 'CEIL', availability: 'native' },
    sql_server: { sourceFunction: 'CEILING', availability: 'native' },
    redshift: { sourceFunction: 'CEILING', availability: 'native' },
    snowflake: { sourceFunction: 'CEIL', availability: 'native' },
    pyspark: { sourceFunction: 'ceil', availability: 'native' },
  },

  // ========== REGEX ==========

  regex_extract: {
    oracle: { sourceFunction: 'REGEXP_SUBSTR', availability: 'native' },
    postgresql: { sourceFunction: 'REGEXP_MATCHES', availability: 'native' },
    mysql: { sourceFunction: 'REGEXP_SUBSTR', availability: 'native' },
    sql_server: {
      sourceFunction: 'LIKE',
      availability: 'alternative',
      alternativeNote: 'SQL Server has limited regex. Use LIKE patterns or switch to PySpark.',
      alternativePrimitive: 'custom_sql',
    },
    redshift: { sourceFunction: 'REGEXP_SUBSTR', availability: 'native' },
    snowflake: { sourceFunction: 'REGEXP_SUBSTR', availability: 'native' },
    pyspark: { sourceFunction: 'regexp_extract', availability: 'native' },
  },

  regex_replace: {
    oracle: { sourceFunction: 'REGEXP_REPLACE', availability: 'native' },
    postgresql: { sourceFunction: 'REGEXP_REPLACE', availability: 'native' },
    mysql: { sourceFunction: 'REGEXP_REPLACE', availability: 'native' },
    sql_server: {
      sourceFunction: 'N/A',
      availability: 'alternative',
      alternativeNote: 'SQL Server has limited regex. Switch to PySpark for full regex support.',
      alternativePrimitive: 'custom_sql',
    },
    redshift: { sourceFunction: 'REGEXP_REPLACE', availability: 'native' },
    snowflake: { sourceFunction: 'REGEXP_REPLACE', availability: 'native' },
    pyspark: { sourceFunction: 'regexp_replace', availability: 'native' },
  },

  // ========== CONDITIONAL LOGIC ==========

  if_else: {
    oracle: {
      sourceFunction: 'CASE WHEN',
      availability: 'alternative',
      alternativePrimitive: 'case_when',
      alternativeNote: 'Oracle requires CASE WHEN syntax instead of if_else.',
    },
    postgresql: { sourceFunction: 'CASE WHEN', availability: 'native' },
    mysql: { sourceFunction: 'IF() or CASE', availability: 'native' },
    sql_server: { sourceFunction: 'CASE WHEN', availability: 'native' },
    redshift: { sourceFunction: 'CASE WHEN', availability: 'native' },
    snowflake: { sourceFunction: 'IFF() or CASE', availability: 'native' },
    pyspark: { sourceFunction: 'when/otherwise', availability: 'native' },
  },

  case_when: {
    oracle: { sourceFunction: 'CASE WHEN', availability: 'native' },
    postgresql: { sourceFunction: 'CASE WHEN', availability: 'native' },
    mysql: { sourceFunction: 'CASE WHEN', availability: 'native' },
    sql_server: { sourceFunction: 'CASE WHEN', availability: 'native' },
    redshift: { sourceFunction: 'CASE WHEN', availability: 'native' },
    snowflake: { sourceFunction: 'CASE WHEN', availability: 'native' },
    pyspark: { sourceFunction: 'when/otherwise', availability: 'native' },
  },

  // ========== AGGREGATION / NULL HANDLING ==========

  coalesce: {
    oracle: { sourceFunction: 'COALESCE', availability: 'native' },
    postgresql: { sourceFunction: 'COALESCE', availability: 'native' },
    mysql: { sourceFunction: 'COALESCE', availability: 'native' },
    sql_server: { sourceFunction: 'COALESCE', availability: 'native' },
    redshift: { sourceFunction: 'COALESCE', availability: 'native' },
    snowflake: { sourceFunction: 'COALESCE', availability: 'native' },
    pyspark: { sourceFunction: 'coalesce', availability: 'native' },
  },

  null_if: {
    oracle: { sourceFunction: 'NULLIF', availability: 'native' },
    postgresql: { sourceFunction: 'NULLIF', availability: 'native' },
    mysql: { sourceFunction: 'NULLIF', availability: 'native' },
    sql_server: { sourceFunction: 'NULLIF', availability: 'native' },
    redshift: { sourceFunction: 'NULLIF', availability: 'native' },
    snowflake: { sourceFunction: 'NULLIF', availability: 'native' },
    pyspark: { sourceFunction: 'when', availability: 'native' },
  },

  map_lookup: {
    oracle: {
      sourceFunction: 'DECODE / JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via DECODE or JOIN; consider PySpark for complex lookups.',
    },
    postgresql: {
      sourceFunction: 'JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via JOIN to lookup table; PySpark offers better UX for this.',
    },
    mysql: {
      sourceFunction: 'JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via JOIN; consider PySpark for simplicity.',
    },
    sql_server: {
      sourceFunction: 'JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via JOIN; consider PySpark.',
    },
    redshift: {
      sourceFunction: 'JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via JOIN; consider PySpark.',
    },
    snowflake: {
      sourceFunction: 'JOIN',
      availability: 'alternative',
      alternativeNote: 'Implement via JOIN; consider PySpark.',
    },
    pyspark: { sourceFunction: 'when/otherwise with map', availability: 'native' },
  },

  list_agg: {
    oracle: { sourceFunction: 'LISTAGG', availability: 'native' },
    postgresql: {
      sourceFunction: 'None',
      availability: 'none',
      alternativeNote: 'PostgreSQL has STRING_AGG but with different syntax and behavior. Use PySpark collect_list().',
    },
    mysql: {
      sourceFunction: 'None',
      availability: 'none',
      alternativeNote: 'MySQL has GROUP_CONCAT but with different behavior. Use PySpark collect_list().',
    },
    sql_server: { sourceFunction: 'STRING_AGG', availability: 'native' },
    redshift: { sourceFunction: 'LISTAGG', availability: 'native' },
    snowflake: { sourceFunction: 'LISTAGG', availability: 'native' },
    pyspark: { sourceFunction: 'collect_list / collect_set', availability: 'native' },
  },

  custom_sql: {
    oracle: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match Oracle dialect.',
    },
    postgresql: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match PostgreSQL dialect.',
    },
    mysql: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match MySQL dialect.',
    },
    sql_server: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match T-SQL dialect.',
    },
    redshift: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match Redshift dialect.',
    },
    snowflake: {
      sourceFunction: 'User-defined',
      availability: 'alternative',
      alternativeNote: 'Be careful with custom SQL in pushdown. Syntax must match Snowflake dialect.',
    },
    pyspark: { sourceFunction: 'User-defined', availability: 'alternative' },
  },
};

/**
 * Get capability of a function in a specific source technology
 */
export function getCapability(
  primitiveId: string,
  technology: SourceTechnology
): FunctionCapability | null {
  return CAPABILITY_MATRIX[primitiveId]?.[technology] || null;
}

/**
 * Check if a function is natively supported in a source technology
 */
export function isNativeFunctionSupport(primitiveId: string, technology: SourceTechnology): boolean {
  const cap = getCapability(primitiveId, technology);
  return cap?.availability === 'native';
}

/**
 * Check if a function has an alternative in a source technology
 */
export function hasAlternative(primitiveId: string, technology: SourceTechnology): boolean {
  const cap = getCapability(primitiveId, technology);
  return cap?.availability === 'alternative';
}

/**
 * Get all functions not supported in a source technology
 */
export function getUnsupportedFunctions(technology: SourceTechnology): string[] {
  return Object.keys(CAPABILITY_MATRIX).filter(
    primitiveId => getCapability(primitiveId, technology)?.availability === 'none'
  );
}

/**
 * Get all primitives available natively for a source technology
 */
export function getNativeFunctions(technology: SourceTechnology): string[] {
  return Object.keys(CAPABILITY_MATRIX).filter(
    primitiveId => getCapability(primitiveId, technology)?.availability === 'native'
  );
}

/**
 * Get all primitives that are available (native or alternative) for a source technology
 */
export function getAvailableFunctions(technology: SourceTechnology): string[] {
  return Object.keys(CAPABILITY_MATRIX).filter(
    primitiveId => getCapability(primitiveId, technology)?.availability !== 'none'
  );
}

/**
 * Get functions available only in PySpark (not in any source DB)
 */
export function getPySparkOnlyFunctions(): string[] {
  const sourceDbTechs: SourceTechnology[] = ['oracle', 'postgresql', 'mysql', 'sql_server', 'redshift', 'snowflake'];

  return Object.keys(CAPABILITY_MATRIX).filter(primitiveId => {
    const allUnsupported = sourceDbTechs.every(
      tech => getCapability(primitiveId, tech)?.availability === 'none'
    );
    return allUnsupported && getCapability(primitiveId, 'pyspark')?.availability === 'native';
  });
}
