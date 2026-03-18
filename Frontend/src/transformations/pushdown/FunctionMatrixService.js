/**
 * Function Matrix Configuration Loader & Service
 *
 * Loads function matrix configuration from distributed files and provides
 * efficient querying, caching, and enable/disable management.
 */
import { FunctionCategory, SourceTechnology, SupportLevel } from './FunctionMatrixTypes';
import { numericMathFunctions } from './config/functions_numeric_math';
/**
 * Default development configuration
 * Adjust these to test specific categories
 */
const DEFAULT_FEATURE_FLAGS = {
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
    constructor(featureFlags) {
        Object.defineProperty(this, "functions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "functionMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "categoryMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "featureFlags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "isLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
    }
    /**
     * Get or create singleton instance
     */
    static getInstance(featureFlags) {
        if (!FunctionMatrixService.instance) {
            FunctionMatrixService.instance = new FunctionMatrixService(featureFlags);
        }
        return FunctionMatrixService.instance;
    }
    /**
     * Load all function configurations
     * This is done lazily on first access
     */
    loadFunctions() {
        if (this.isLoaded)
            return;
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
    buildIndices() {
        this.functionMap.clear();
        this.categoryMap.clear();
        for (const fn of this.functions) {
            this.functionMap.set(fn.id, fn);
            if (!this.categoryMap.has(fn.category)) {
                this.categoryMap.set(fn.category, []);
            }
            this.categoryMap.get(fn.category).push(fn);
        }
    }
    /**
     * Check if a function is enabled (respects feature flags)
     */
    isFunctionEnabled(fn) {
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
    getFunction(id) {
        this.loadFunctions();
        const fn = this.functionMap.get(id);
        return fn && this.isFunctionEnabled(fn) ? fn : null;
    }
    /**
     * Get all functions in a category
     */
    getFunctionsByCategory(category) {
        this.loadFunctions();
        const fns = this.categoryMap.get(category) ?? [];
        return fns.filter(fn => this.isFunctionEnabled(fn));
    }
    /**
     * Get all functions for a technology
     */
    getFunctionsByTechnology(tech) {
        this.loadFunctions();
        return this.functions
            .filter(fn => this.isFunctionEnabled(fn) && fn.capabilities[tech])
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }
    /**
     * Get functions available in both a category AND for a technology
     */
    getFunctionsByCategoryAndTech(category, tech) {
        this.loadFunctions();
        const fns = this.categoryMap.get(category) ?? [];
        return fns
            .filter(fn => this.isFunctionEnabled(fn) && fn.capabilities[tech])
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }
    /**
     * Search functions by keyword
     */
    searchFunctions(keyword) {
        this.loadFunctions();
        const lower = keyword.toLowerCase();
        return this.functions
            .filter(fn => this.isFunctionEnabled(fn) &&
            (fn.id.includes(lower) ||
                (fn.label?.toLowerCase().includes(lower) ?? false) ||
                (fn.description?.toLowerCase().includes(lower) ?? false)))
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }
    /**
     * Get all unique categories present in loaded functions
     */
    getAllCategories() {
        this.loadFunctions();
        const cats = new Set(this.functions.map(fn => fn.category));
        return Array.from(cats).sort();
    }
    /**
     * Get all unique technologies
     */
    getAllTechnologies() {
        return Object.values(SourceTechnology).filter(t => t !== SourceTechnology.PYSPARK);
    }
    /**
     * Get all technologies
     */
    getAllPlusPySpark() {
        return Object.values(SourceTechnology);
    }
    /**
     * Check if a function is supported in a specific technology
     */
    isFunctionSupportedIn(functionId, tech) {
        const fn = this.getFunction(functionId);
        if (!fn)
            return false;
        const cap = fn.capabilities[tech];
        return cap ? cap.support !== SupportLevel.NONE : false;
    }
    /**
     * Get support level for a function in a technology
     */
    getSupportLevel(functionId, tech) {
        const fn = this.getFunction(functionId);
        if (!fn)
            return null;
        return fn.capabilities[tech]?.support ?? null;
    }
    /**
     * Get native functions for a technology
     */
    getNativeFunctionsForTech(tech) {
        this.loadFunctions();
        return this.functions
            .filter(fn => this.isFunctionEnabled(fn) &&
            fn.capabilities[tech]?.support === SupportLevel.NATIVE)
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }
    /**
     * Update feature flags at runtime
     */
    setFeatureFlags(flags) {
        this.featureFlags = {
            ...this.featureFlags,
            ...flags,
        };
        this.cache.clear(); // Invalidate cache
    }
    /**
     * Get current feature flags
     */
    getFeatureFlags() {
        return { ...this.featureFlags };
    }
    /**
     * Enable a category
     */
    enableCategory(category) {
        this.featureFlags.byCategory[category] = true;
        this.cache.clear();
    }
    /**
     * Disable a category
     */
    disableCategory(category) {
        this.featureFlags.byCategory[category] = false;
        this.cache.clear();
    }
    /**
     * Enable a specific function
     */
    enableFunction(functionId) {
        this.featureFlags.byFunction[functionId] = true;
        this.cache.clear();
    }
    /**
     * Disable a specific function
     */
    disableFunction(functionId) {
        this.featureFlags.byFunction[functionId] = false;
        this.cache.clear();
    }
    /**
     * Get statistics about loaded functions
     */
    getStatistics() {
        this.loadFunctions();
        const enabledFunctions = this.functions.filter(fn => this.isFunctionEnabled(fn)).length;
        const functionsByCategory = {};
        for (const cat of this.getAllCategories()) {
            functionsByCategory[cat] = this.getFunctionsByCategory(cat).length;
        }
        const supportByTech = {};
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
    exportMatrix() {
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
    static reset() {
        FunctionMatrixService.instance = undefined;
    }
}
/**
 * Export factory function for convenience
 */
export function createFunctionMatrixService(featureFlags) {
    return FunctionMatrixService.getInstance(featureFlags);
}
export default FunctionMatrixService;
