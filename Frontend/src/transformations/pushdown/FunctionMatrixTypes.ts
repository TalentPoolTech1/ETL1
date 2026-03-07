/**
 * Function Capability Matrix Configuration System
 * 
 * Comprehensive function support matrix for all source technologies.
 * This is the DEFINITIVE source for function availability, syntax, and UI behavior.
 * 
 * Configuration is organized in JSON for easy:
 * - Version control and diff tracking
 * - Manual editing and review
 * - Feature flag enabling/disabling during development
 * - Export to code gen services
 */

/**
 * Support level enumeration
 */
export enum SupportLevel {
  /** Fully supported, direct syntax available */
  NATIVE = 'native',
  
  /** Equivalent achievable with different syntax (e.g., CASE WHEN instead of IF_ELSE) */
  ALTERNATIVE = 'alternative',
  
  /** Supported but with limitations (noted in details) */
  PARTIAL = 'partial',
  
  /** Not supported — no equivalent possible at pushdown level */
  NONE = 'none',
  
  /** Only available in PySpark/Spark SQL, not in source DB pushdown */
  PYSPARK_ONLY = 'pyspark_only',
  
  /** Requires custom user-defined function */
  UDF_REQUIRED = 'udf_required',
}

/**
 * Source technology identifier
 */
export enum SourceTechnology {
  ORACLE = 'oracle',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLSERVER = 'sqlserver',
  REDSHIFT = 'redshift',
  SNOWFLAKE = 'snowflake',
  PYSPARK = 'pyspark',
}

/**
 * Function category
 */
export enum FunctionCategory {
  NUMERIC_MATH = 'numeric_math',
  STRING_TEXT = 'string_text',
  DATE_TIME = 'date_time',
  TYPE_CONVERSION = 'type_conversion',
  CONDITIONAL_LOGIC = 'conditional_logic',
  NULL_HANDLING = 'null_handling',
  AGGREGATE = 'aggregate',
  WINDOW_ANALYTICAL = 'window_analytical',
  RANKING = 'ranking',
  CONCATENATION = 'concatenation',
  REGEX = 'regex',
  HIERARCHICAL_RECURSIVE = 'hierarchical_recursive',
  ARRAY_COLLECTION = 'array_collection',
  JSON = 'json',
  ENCODING_HASHING = 'encoding_hashing',
  STATISTICAL = 'statistical',
  TECHNOLOGY_SPECIFIC = 'technology_specific',
}

/**
 * Technology-specific capability metadata
 */
export interface TechnologyCapability {
  /** Support level for this technology */
  support: SupportLevel;
  
  /** Native or alternative function name in this technology's syntax */
  syntax: string;
  
  /** Notes about limitations or special handling */
  notes?: string;
  
  /** Alternative function if support level is ALTERNATIVE */
  alternative?: {
    functionId: string;
    label: string;
    reason: string;
  };
  
  /** Implementation example in this technology's syntax */
  example?: string;
  
  /** Minimum version supporting this function */
  minVersion?: string;
  
  /** Whether to disable in UI for pushdown (force PySpark instead) */
  disablePushdown?: boolean;
  
  /** Custom UI behavior instructions */
  uiBehavior?: string;
}

/**
 * Complete function matrix entry
 */
export interface FunctionEntry {
  /** Unique identifier (lowercase, hyphenated) */
  id: string;
  
  /** User-friendly label shown in UI */
  label: string;
  
  /** Category for organization in palette */
  category: FunctionCategory;
  
  /** Description of what the function does */
  description: string;
  
  /** Standard SQL / logical name (canonical reference) */
  standardName?: string;
  
  /** Priority hint for implementation (critical, high, medium, low) */
  priority?: 'critical' | 'high' | 'medium' | 'low';
  
  /** Whether this function is actively enabled in current build */
  enabled: boolean;
  
  /** Dev/implementation status */
  status?: 'stable' | 'beta' | 'experimental' | 'deprecated';
  
  /** Technology-specific capabilities */
  capabilities: {
    [key in SourceTechnology]?: TechnologyCapability;
  };
  
  /** Notes on cross-technology differences, gotchas, or migration tips */
  notes?: string;
  
  /** Related functions (for suggestions) */
  relatedFunctions?: string[];
  
  /** Test coverage status */
  tested?: {
    [key in SourceTechnology]?: boolean;
  };
}

/**
 * Complete function capability matrix configuration
 */
export interface FunctionMatrixConfig {
  version: string;
  lastUpdated: string;
  metadata: {
    totalFunctions: number;
    categories: string[];
    technologies: string[];
  };
  functions: FunctionEntry[];
}

/**
 * Helper to build a capability entry
 */
export function capability(
  support: SupportLevel,
  syntax: string,
  options?: Partial<TechnologyCapability>
): TechnologyCapability {
  return {
    support,
    syntax,
    ...options,
  };
}

/**
 * Helper to create a function entry
 */
export function functionEntry(
  id: string,
  label: string,
  category: FunctionCategory,
  description: string,
  capabilities: FunctionEntry['capabilities'],
  options?: Partial<Omit<FunctionEntry, 'id' | 'label' | 'category' | 'description' | 'capabilities'>>
): FunctionEntry {
  return {
    id,
    label,
    category,
    description,
    capabilities,
    enabled: true,
    status: 'stable',
    ...options,
  };
}

export default {
  SupportLevel,
  SourceTechnology,
  FunctionCategory,
  capability,
  functionEntry,
};
