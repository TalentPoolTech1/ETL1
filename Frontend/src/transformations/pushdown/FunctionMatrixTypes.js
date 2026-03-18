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
export var SupportLevel;
(function (SupportLevel) {
    /** Fully supported, direct syntax available */
    SupportLevel["NATIVE"] = "native";
    /** Equivalent achievable with different syntax (e.g., CASE WHEN instead of IF_ELSE) */
    SupportLevel["ALTERNATIVE"] = "alternative";
    /** Supported but with limitations (noted in details) */
    SupportLevel["PARTIAL"] = "partial";
    /** Not supported — no equivalent possible at pushdown level */
    SupportLevel["NONE"] = "none";
    /** Only available in PySpark/Spark SQL, not in source DB pushdown */
    SupportLevel["PYSPARK_ONLY"] = "pyspark_only";
    /** Requires custom user-defined function */
    SupportLevel["UDF_REQUIRED"] = "udf_required";
})(SupportLevel || (SupportLevel = {}));
/**
 * Source technology identifier
 */
export var SourceTechnology;
(function (SourceTechnology) {
    SourceTechnology["ORACLE"] = "oracle";
    SourceTechnology["POSTGRESQL"] = "postgresql";
    SourceTechnology["MYSQL"] = "mysql";
    SourceTechnology["SQLSERVER"] = "sqlserver";
    SourceTechnology["REDSHIFT"] = "redshift";
    SourceTechnology["SNOWFLAKE"] = "snowflake";
    SourceTechnology["PYSPARK"] = "pyspark";
})(SourceTechnology || (SourceTechnology = {}));
/**
 * Function category
 */
export var FunctionCategory;
(function (FunctionCategory) {
    FunctionCategory["NUMERIC_MATH"] = "numeric_math";
    FunctionCategory["STRING_TEXT"] = "string_text";
    FunctionCategory["DATE_TIME"] = "date_time";
    FunctionCategory["TYPE_CONVERSION"] = "type_conversion";
    FunctionCategory["CONDITIONAL_LOGIC"] = "conditional_logic";
    FunctionCategory["NULL_HANDLING"] = "null_handling";
    FunctionCategory["AGGREGATE"] = "aggregate";
    FunctionCategory["WINDOW_ANALYTICAL"] = "window_analytical";
    FunctionCategory["RANKING"] = "ranking";
    FunctionCategory["CONCATENATION"] = "concatenation";
    FunctionCategory["REGEX"] = "regex";
    FunctionCategory["HIERARCHICAL_RECURSIVE"] = "hierarchical_recursive";
    FunctionCategory["ARRAY_COLLECTION"] = "array_collection";
    FunctionCategory["JSON"] = "json";
    FunctionCategory["ENCODING_HASHING"] = "encoding_hashing";
    FunctionCategory["STATISTICAL"] = "statistical";
    FunctionCategory["TECHNOLOGY_SPECIFIC"] = "technology_specific";
})(FunctionCategory || (FunctionCategory = {}));
/**
 * Helper to build a capability entry
 */
export function capability(support, syntax, options) {
    return {
        support,
        syntax,
        ...options,
    };
}
/**
 * Helper to create a function entry
 */
export function functionEntry(id, label, category, description, capabilities, options) {
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
