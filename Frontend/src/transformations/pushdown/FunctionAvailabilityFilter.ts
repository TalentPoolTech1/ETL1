/**
 * Function Availability Filter
 * 
 * Determines which transformations are available for:
 * - Current execution point (source DB vs PySpark)
 * - Source technology (Oracle, PostgreSQL, etc.)
 * - Returns available, alternative, and unavailable functions
 */

import {
  SourceTechnology,
  getCapability,
  isNativeFunctionSupport,
  hasAlternative,
  getUnsupportedFunctions,
  getNativeFunctions,
  getAvailableFunctions,
  FunctionCapability,
} from './CapabilityMatrix';

/**
 * Categorized function availability result
 */
export interface FunctionAvailabilityResult {
  functionId: string;
  label: string;
  availability: 'available' | 'alternative' | 'unavailable';
  canAdd: boolean;
  message?: string;
  alternativeSuggestion?: {
    alternativeId: string;
    alternativeLabel: string;
    reason: string;
  };
  sourceImplementation?: {
    sourceTech: SourceTechnology;
    implementation: string;
    notes?: string;
  };
}

/**
 * Filtered function palette for current context
 */
export interface FunctionPalette {
  available: FunctionAvailabilityResult[];
  alternatives: FunctionAvailabilityResult[];
  unavailable: FunctionAvailabilityResult[];
  allFunctions: FunctionAvailabilityResult[];
  sourceTechnology: SourceTechnology;
  executionPoint: 'source' | 'pyspark' | 'forced_pyspark';
}

/**
 * Function metadata (simple registry)
 */
interface FunctionMetadata {
  id: string;
  label: string;
  category: 'string' | 'numeric' | 'date' | 'conditional' | 'aggregate' | 'custom';
  description: string;
  pysparkAlways?: true; // Functions that can ONLY run in PySpark
}

/**
 * Built-in function registry
 */
const FUNCTION_REGISTRY: Record<string, FunctionMetadata> = {
  to_number: { id: 'to_number', label: 'To Number', category: 'numeric', description: 'Convert value to numeric' },
  to_date: { id: 'to_date', label: 'To Date', category: 'date', description: 'Convert value to date' },
  cast: { id: 'cast', label: 'Cast', category: 'numeric', description: 'Cast to specific type' },
  substring: { id: 'substring', label: 'Substring', category: 'string', description: 'Extract substring' },
  trim: { id: 'trim', label: 'Trim', category: 'string', description: 'Trim whitespace' },
  trim_timestamp: { id: 'trim_timestamp', label: 'Trim Timestamp', category: 'date', description: 'Trim timestamp to date' },
  date_add: { id: 'date_add', label: 'Date Add', category: 'date', description: 'Add days to date' },
  date_sub: { id: 'date_sub', label: 'Date Subtract', category: 'date', description: 'Subtract days from date' },
  round: { id: 'round', label: 'Round', category: 'numeric', description: 'Round to decimal places' },
  floor: { id: 'floor', label: 'Floor', category: 'numeric', description: 'Round down' },
  ceil: { id: 'ceil', label: 'Ceiling', category: 'numeric', description: 'Round up' },
  regex_extract: { id: 'regex_extract', label: 'Regex Extract', category: 'string', description: 'Extract with regex', pysparkAlways: true },
  regex_replace: { id: 'regex_replace', label: 'Regex Replace', category: 'string', description: 'Replace with regex', pysparkAlways: true },
  if_else: { id: 'if_else', label: 'If/Else', category: 'conditional', description: 'Conditional logic' },
  case_when: { id: 'case_when', label: 'Case/When', category: 'conditional', description: 'Multi-way conditional' },
  coalesce: { id: 'coalesce', label: 'Coalesce', category: 'conditional', description: 'Return first non-null' },
  null_if: { id: 'null_if', label: 'Null If', category: 'conditional', description: 'Return null if condition' },
  map_lookup: { id: 'map_lookup', label: 'Map Lookup', category: 'custom', description: 'Look up in map', pysparkAlways: true },
  list_agg: { id: 'list_agg', label: 'List Aggregate', category: 'aggregate', description: 'Aggregate values into list' },
  custom_sql: { id: 'custom_sql', label: 'Custom SQL', category: 'custom', description: 'Write custom SQL' },
};

/**
 * Function Availability Filter
 */
export class FunctionAvailabilityFilter {
  private registry: Map<string, FunctionMetadata>;

  constructor() {
    this.registry = new Map(Object.entries(FUNCTION_REGISTRY));
  }

  /**
   * Get available functions for a context
   */
  public filterFunctions(
    sourceTech: SourceTechnology,
    executionPoint: 'source' | 'pyspark' | 'forced_pyspark'
  ): FunctionPalette {
    const available: FunctionAvailabilityResult[] = [];
    const alternatives: FunctionAvailabilityResult[] = [];
    const unavailable: FunctionAvailabilityResult[] = [];
    const allFunctions: FunctionAvailabilityResult[] = [];

    for (const [functionId, metadata] of this.registry) {
      const result = this.checkFunctionAvailability(functionId, sourceTech, executionPoint, metadata);
      allFunctions.push(result);

      if (result.availability === 'available') {
        available.push(result);
      } else if (result.availability === 'alternative') {
        alternatives.push(result);
      } else {
        unavailable.push(result);
      }
    }

    return {
      available,
      alternatives,
      unavailable,
      allFunctions,
      sourceTechnology: sourceTech,
      executionPoint,
    };
  }

  /**
   * Check availability of a specific function
   */
  public checkFunctionAvailability(
    functionId: string,
    sourceTech: SourceTechnology,
    executionPoint: 'source' | 'pyspark' | 'forced_pyspark',
    metadata?: FunctionMetadata
  ): FunctionAvailabilityResult {
    const fnMeta = metadata || this.registry.get(functionId);
    if (!fnMeta) {
      return {
        functionId,
        label: functionId,
        availability: 'unavailable',
        canAdd: false,
        message: 'Function not found in registry',
      };
    }

    // If forced to PySpark, all functions work
    if (executionPoint === 'forced_pyspark') {
      return {
        functionId,
        label: fnMeta.label,
        availability: 'available',
        canAdd: true,
        message: 'Available in PySpark (execution locked)',
      };
    }

    // PySpark always works
    if (executionPoint === 'pyspark') {
      return {
        functionId,
        label: fnMeta.label,
        availability: 'available',
        canAdd: true,
        message: 'Available in PySpark',
      };
    }

    // Source DB execution: check capability matrix
    if (executionPoint === 'source') {
      // Some functions ONLY work in PySpark
      if (fnMeta.pysparkAlways) {
        return {
          functionId,
          label: fnMeta.label,
          availability: 'unavailable',
          canAdd: false,
          message: `${fnMeta.label} is only available in PySpark`,
          alternativeSuggestion: {
            alternativeId: 'pyspark',
            alternativeLabel: 'PySpark Execution',
            reason: `${fnMeta.label} requires PySpark engine`,
          },
        };
      }

      // Check capability matrix
      const capability = getCapability(functionId, sourceTech);
      if (!capability) {
        return {
          functionId,
          label: fnMeta.label,
          availability: 'unavailable',
          canAdd: false,
          message: `${fnMeta.label} not supported in ${sourceTech}`,
        };
      }

      if (capability.availability === 'native') {
        return {
          functionId,
          label: fnMeta.label,
          availability: 'available',
          canAdd: true,
          sourceImplementation: {
            sourceTech,
            implementation: capability.sourceFunction || functionId,
            notes: capability.notes,
          },
        };
      }

      if (capability.availability === 'alternative') {
        return {
          functionId,
          label: fnMeta.label,
          availability: 'alternative',
          canAdd: true, // Can still add; will use alternative
          message: `${fnMeta.label} not natively supported in ${sourceTech} — will use ${capability.alternativePrimitive}`,
          alternativeSuggestion: {
            alternativeId: capability.alternativePrimitive || 'pyspark',
            alternativeLabel: capability.alternativePrimitive || 'PySpark',
            reason: capability.alternativeNote || 'Alternative implementation available',
          },
          sourceImplementation: {
            sourceTech,
            implementation: capability.sourceFunction || capability.alternativePrimitive || functionId,
            notes: capability.notes,
          },
        };
      }

      // availability === 'none'
      return {
        functionId,
        label: fnMeta.label,
        availability: 'unavailable',
        canAdd: false,
        message: `${fnMeta.label} is not supported in ${sourceTech}. Switch to PySpark or use alternative.`,
        alternativeSuggestion: {
          alternativeId: 'pyspark',
          alternativeLabel: 'PySpark Execution',
          reason: 'Switch this segment to PySpark to enable this function',
        },
      };
    }

    return {
      functionId,
      label: fnMeta.label,
      availability: 'unavailable',
      canAdd: false,
      message: 'Unable to determine availability',
    };
  }

  /**
   * Get recommended alternative for a function
   */
  public getAlternative(
    functionId: string,
    sourceTech: SourceTechnology
  ): FunctionAvailabilityResult | null {
    const capability = getCapability(functionId, sourceTech);
    if (!capability || !capability.alternativePrimitive) {
      return null;
    }

    const altMeta = this.registry.get(capability.alternativePrimitive);
    if (!altMeta) {
      return null;
    }

    return {
      functionId: capability.alternativePrimitive,
      label: altMeta.label,
      availability: 'available',
      canAdd: true,
      message: `Use ${altMeta.label} instead of ${FUNCTION_REGISTRY[functionId]?.label || functionId}`,
      sourceImplementation: {
        sourceTech,
        implementation: capability.sourceFunction || capability.alternativePrimitive,
        notes: capability.alternativeNote,
      },
    };
  }

  /**
   * Get all functions that work in a source technology
   */
  public getNativeSupport(sourceTech: SourceTechnology): string[] {
    return getNativeFunctions(sourceTech);
  }

  /**
   * Get unsupported functions for a source technology
   */
  public getUnsupported(sourceTech: SourceTechnology): string[] {
    return getUnsupportedFunctions(sourceTech);
  }

  /**
   * Filter by category
   */
  public filterByCategory(
    palette: FunctionPalette,
    categories: string[]
  ): FunctionPalette {
    const allFunctions = palette.allFunctions.filter(f => {
      const meta = this.registry.get(f.functionId);
      return meta && categories.includes(meta.category);
    });

    return {
      ...palette,
      available: allFunctions.filter(f => f.availability === 'available'),
      alternatives: allFunctions.filter(f => f.availability === 'alternative'),
      unavailable: allFunctions.filter(f => f.availability === 'unavailable'),
      allFunctions,
    };
  }

  /**
   * Validate a set of functions for a segment
   */
  public validateSegmentFunctions(
    functionIds: string[],
    sourceTech: SourceTechnology,
    executionPoint: 'source' | 'pyspark' | 'forced_pyspark'
  ): {
    valid: boolean;
    incompatible: FunctionAvailabilityResult[];
    warnings: string[];
  } {
    const incompatible: FunctionAvailabilityResult[] = [];
    const warnings: string[] = [];

    for (const funcId of functionIds) {
      const result = this.checkFunctionAvailability(funcId, sourceTech, executionPoint);
      if (!result.canAdd && executionPoint === 'source') {
        incompatible.push(result);
      } else if (result.availability === 'alternative') {
        warnings.push(`${result.label}: ${result.message}`);
      }
    }

    return {
      valid: incompatible.length === 0,
      incompatible,
      warnings,
    };
  }

  /**
   * Register a custom function (for extensions)
   */
  public registerFunction(id: string, metadata: FunctionMetadata): void {
    this.registry.set(id, metadata);
  }

  /**
   * Get function metadata
   */
  public getFunctionMetadata(functionId: string): FunctionMetadata | null {
    return this.registry.get(functionId) || null;
  }

  /**
   * List all registered functions
   */
  public listAllFunctions(): FunctionMetadata[] {
    return Array.from(this.registry.values());
  }
}

/**
 * Helper function to create filter
 */
export function createFunctionAvailabilityFilter(): FunctionAvailabilityFilter {
  return new FunctionAvailabilityFilter();
}
