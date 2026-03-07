/**
 * Function Matrix Configuration Loader & Service
 * 
 * Loads function matrix configuration from distributed files and provides
 * efficient querying, caching, and enable/disable management.
 */

import { FunctionEntry, FunctionCategory, SourceTechnology, SupportLevel, FunctionMatrixConfig } from './FunctionMatrixTypes';
import { numericMathFunctions } from './config/functions_numeric_math';

/**
 * Feature flag configuration
 * Controls which function categories are enabled during development
 */
export interface FeatureFlagConfig {
  /** Enable/disable by category */
  byCategory: {
    [key in FunctionCategory]?: boolean;
  };
  /** Enable/disable by individual function ID */
  byFunction: {
    [key: string]: boolean;
  };
  /** Global enable/disable for all functions */
  global: boolean;
}

/**
 * Default development configuration
 * Adjust these to test specific categories
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  byCategory: {
    [FunctionCategory.NUMERIC_MATH]: true,
    // Add more categories as they're implemented
    [FunctionCategory.STRING_TEXT]: false, // Placeholder - not yet loaded
    [FunctionCategory.DATE_TIME]: false,
    [FunctionCategory.TYPE_CONVERSION]: false,
    [FunctionCategory.CONDITIONAL_LOGIC]: false,
    [FunctionCategory.NULL_HANDLING]: false,
    [FunctionCategory.AGGREGATE]: false,
    [FunctionCategory.WINDOW_ANALYTICAL]: false,
    [FunctionCategory.RANKING]: false,
    [FunctionCategory.CONCATENATION]: false,
    [FunctionCategory.REGEX]: false,
    [FunctionCategory.HIERARCHICAL_RECURSIVE]: false,
    [FunctionCategory.ARRAY_COLLECTION]: false,
    [FunctionCategory.JSON]: false,
    [FunctionCategory.ENCODING_HASHING]: false,
    [FunctionCategory.STATISTICAL]: false,
    [FunctionCategory.TECHNOLOGY_SPECIFIC]: false,
  },
  byFunction: {},
  global: true,
};

/**
 * Function Matrix Loader & Service
 * 
 * Manages loading, caching, querying, and feature flagging of function matrix
 */
export class FunctionMatrixService {
  private static instance: FunctionMatrixService;
  
  private functions: FunctionEntry[] = [];
  private functionMap: Map<string, FunctionEntry> = new Map();
  private categoryMap: Map<FunctionCategory, FunctionEntry[]> = new Map();
  private featureFlags: FeatureFlagConfig;
  private cache: Map<string, any> = new Map();
  private isLoaded = false;

  private constructor(featureFlags?: FeatureFlagConfig) {
    this.featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(featureFlags?: FeatureFlagConfig): FunctionMatrixService {
    if (!FunctionMatrixService.instance) {
      FunctionMatrixService.instance = new FunctionMatrixService(featureFlags);
    }
    return FunctionMatrixService.instance;
  }

  /**
   * Load all function configurations
   * This is done lazily on first access
   */
  private loadFunctions(): void {
    if (this.isLoaded) return;

    // Load all category function files
    this.functions = [
      ...numericMathFunctions,
      // Add other categories here as they're created:
      // ...stringTextFunctions,
      // ...dateTimeFunctions,
      // ...typeConversionFunctions,
      // ...conditionalLogicFunctions,
      // ...nullHandlingFunctions,
      // ...aggregateFunctions,
      // ...windowAnalyticalFunctions,
      // ...rankingFunctions,
      // ...concatenationFunctions,
      // ...regexFunctions,
      // ...hierarchicalRecursiveFunctions,
      // ...arrayCollectionFunctions,
      // ...jsonFunctions,
      // ...encodingHashingFunctions,
      // ...statisticalFunctions,
    ];

    // Build indices
    this.buildIndices();
    this.isLoaded = true;
  }

  /**
   * Build lookup indices for efficient querying
   */
  private buildIndices(): void {
    this.functionMap.clear();
    this.categoryMap.clear();

    for (const fn of this.functions) {
      this.functionMap.set(fn.id, fn);

      if (!this.categoryMap.has(fn.category)) {
        this.categoryMap.set(fn.category, []);
      }
      this.categoryMap.get(fn.category)!.push(fn);
    }
  }

  /**
   * Check if a function is enabled (respects feature flags)
   */
  private isFunctionEnabled(fn: FunctionEntry): boolean {
    if (!this.featureFlags.global) {
      return false;
    }

    // Check individual function override
    if (fn.id in this.featureFlags.byFunction) {
      return this.featureFlags.byFunction[fn.id];
    }

    // Check category override
    if (fn.category in this.featureFlags.byCategory) {
      return this.featureFlags.byCategory[fn.category] ?? fn.enabled;
    }

    // Fall back to function's enabled flag
    return fn.enabled;
  }

  /**
   * Get a function by ID
   */
  getFunction(id: string): FunctionEntry | null {
    this.loadFunctions();
    const fn = this.functionMap.get(id);
    return fn && this.isFunctionEnabled(fn) ? fn : null;
  }

  /**
   * Get all functions in a category
   */
  getFunctionsByCategory(category: FunctionCategory): FunctionEntry[] {
    this.loadFunctions();
    const fns = this.categoryMap.get(category) ?? [];
    return fns.filter(fn => this.isFunctionEnabled(fn));
  }

  /**
   * Get all functions for a technology
   */
  getFunctionsByTechnology(tech: SourceTechnology): FunctionEntry[] {
    this.loadFunctions();
    return this.functions
      .filter(fn => this.isFunctionEnabled(fn) && fn.capabilities[tech])
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }

  /**
   * Get functions available in both a category AND for a technology
   */
  getFunctionsByCategoryAndTech(
    category: FunctionCategory,
    tech: SourceTechnology
  ): FunctionEntry[] {
    this.loadFunctions();
    const fns = this.categoryMap.get(category) ?? [];
    return fns
      .filter(fn => this.isFunctionEnabled(fn) && fn.capabilities[tech])
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }

  /**
   * Search functions by keyword
   */
  searchFunctions(keyword: string): FunctionEntry[] {
    this.loadFunctions();
    const lower = keyword.toLowerCase();
    return this.functions
      .filter(
        fn =>
          this.isFunctionEnabled(fn) &&
          (fn.id.includes(lower) ||
            (fn.label?.toLowerCase().includes(lower) ?? false) ||
            (fn.description?.toLowerCase().includes(lower) ?? false))
      )
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }

  /**
   * Get all unique categories present in loaded functions
   */
  getAllCategories(): FunctionCategory[] {
    this.loadFunctions();
    const cats = new Set(this.functions.map(fn => fn.category));
    return Array.from(cats).sort();
  }

  /**
   * Get all unique technologies
   */
  getAllTechnologies(): SourceTechnology[] {
    return Object.values(SourceTechnology).filter(t => t !== SourceTechnology.PYSPARK);
  }

  /**
   * Get all technologies
   */
  getAllPlusPySpark(): SourceTechnology[] {
    return Object.values(SourceTechnology);
  }

  /**
   * Check if a function is supported in a specific technology
   */
  isFunctionSupportedIn(functionId: string, tech: SourceTechnology): boolean {
    const fn = this.getFunction(functionId);
    if (!fn) return false;
    const cap = fn.capabilities[tech];
    return cap ? cap.support !== SupportLevel.NONE : false;
  }

  /**
   * Get support level for a function in a technology
   */
  getSupportLevel(functionId: string, tech: SourceTechnology): SupportLevel | null {
    const fn = this.getFunction(functionId);
    if (!fn) return null;
    return fn.capabilities[tech]?.support ?? null;
  }

  /**
   * Get native functions for a technology
   */
  getNativeFunctionsForTech(tech: SourceTechnology): FunctionEntry[] {
    this.loadFunctions();
    return this.functions
      .filter(
        fn =>
          this.isFunctionEnabled(fn) &&
          fn.capabilities[tech]?.support === SupportLevel.NATIVE
      )
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }

  /**
   * Update feature flags at runtime
   */
  setFeatureFlags(flags: Partial<FeatureFlagConfig>): void {
    this.featureFlags = {
      ...this.featureFlags,
      ...flags,
    };
    this.cache.clear(); // Invalidate cache
  }

  /**
   * Get current feature flags
   */
  getFeatureFlags(): FeatureFlagConfig {
    return { ...this.featureFlags };
  }

  /**
   * Enable a category
   */
  enableCategory(category: FunctionCategory): void {
    this.featureFlags.byCategory[category] = true;
    this.cache.clear();
  }

  /**
   * Disable a category
   */
  disableCategory(category: FunctionCategory): void {
    this.featureFlags.byCategory[category] = false;
    this.cache.clear();
  }

  /**
   * Enable a specific function
   */
  enableFunction(functionId: string): void {
    this.featureFlags.byFunction[functionId] = true;
    this.cache.clear();
  }

  /**
   * Disable a specific function
   */
  disableFunction(functionId: string): void {
    this.featureFlags.byFunction[functionId] = false;
    this.cache.clear();
  }

  /**
   * Get statistics about loaded functions
   */
  getStatistics(): {
    totalFunctions: number;
    enabledFunctions: number;
    totalCategories: number;
    functionsByCategory: { [key in FunctionCategory]?: number };
    supportByTech: { [key in SourceTechnology]?: number };
  } {
    this.loadFunctions();

    const enabledFunctions = this.functions.filter(fn => this.isFunctionEnabled(fn)).length;

    const functionsByCategory: { [key in FunctionCategory]?: number } = {};
    for (const cat of this.getAllCategories()) {
      functionsByCategory[cat] = this.getFunctionsByCategory(cat).length;
    }

    const supportByTech: { [key in SourceTechnology]?: number } = {};
    for (const tech of this.getAllTechnologies()) {
      supportByTech[tech] = this.getFunctionsByTechnology(tech).length;
    }

    return {
      totalFunctions: this.functions.length,
      enabledFunctions,
      totalCategories: this.getAllCategories().length,
      functionsByCategory,
      supportByTech,
    };
  }

  /**
   * Export configuration as matrix for code generation
   */
  exportMatrix(): FunctionMatrixConfig {
    this.loadFunctions();
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalFunctions: this.functions.filter(fn => this.isFunctionEnabled(fn)).length,
        categories: this.getAllCategories(),
        technologies: this.getAllTechnologies(),
      },
      functions: this.functions.filter(fn => this.isFunctionEnabled(fn)),
    };
  }

  /**
   * Reset to singleton state
   */
  static reset(): void {
    FunctionMatrixService.instance = undefined as any;
  }
}

/**
 * Export factory function for convenience
 */
export function createFunctionMatrixService(
  featureFlags?: FeatureFlagConfig
): FunctionMatrixService {
  return FunctionMatrixService.getInstance(featureFlags);
}

export default FunctionMatrixService;
