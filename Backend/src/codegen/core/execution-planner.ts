import {
  PipelineDefinition, PipelineNode,
  TransformationType, SourceType, SinkType,
  JdbcSourceConfig, JdbcSinkConfig,
} from './types/pipeline.types';
import { ValidationError, GenerationWarning } from './interfaces/engine.interfaces';

// ─── Execution Planner Types ──────────────────────────────────────────────────

export type ExecutionMode =
  | 'FULL_PYSPARK'
  | 'FULL_SQL_PUSHDOWN'
  | 'HYBRID'
  | 'STAGE_AND_LOAD'
  | 'VALIDATION_ERROR';

export interface ExecutionPlan {
  mode: ExecutionMode;
  errors: ValidationError[];
  warnings: GenerationWarning[];
  feasibilityNotes: string[];
}

// Transforms that can be pushed down to SQL
const SQL_COMPATIBLE_TRANSFORMS: Set<TransformationType> = new Set([
  'filter', 'select', 'rename', 'drop', 'cast',
  'join', 'union', 'aggregate', 'window',
  'derive', 'dedup', 'sort', 'limit',
  'fillna', 'dropna',
]);

// Transforms that require Spark (Python UDF, ML, complex ops)
const SPARK_ONLY_TRANSFORMS: Set<TransformationType> = new Set([
  'custom_udf', 'flatten', 'explode', 'data_quality', 'mask',
  'multi_transform_sequence', 'pivot', 'unpivot', 'sample',
  'cache', 'repartition', 'lookup', 'custom_sql',
  'scd_type1', 'scd_type2', 'surrogate_key',
]);

// Source types that are DB-backed (can push SQL to)
const DB_SOURCE_TYPES: Set<SourceType> = new Set([
  'jdbc', 'hive',
]);

// Source types that are file-backed
const FILE_SOURCE_TYPES: Set<SourceType> = new Set([
  'file', 's3', 'adls', 'gcs', 'hdfs',
]);

// Sink types that support MERGE (for SCD)
const MERGE_CAPABLE_SINK_TYPES: Set<SinkType> = new Set([
  'jdbc', 'delta', 'iceberg',
]);

// ─── Execution Planner ────────────────────────────────────────────────────────
// Sits between the validator and the code generator.
// Analyzes pipeline topology, validates execution feasibility, and determines
// the optimal execution mode.

export class ExecutionPlanner {
  /**
   * Analyze a pipeline and determine the optimal execution mode.
   * Returns an ExecutionPlan with mode, errors, warnings, and notes.
   */
  static plan(pipeline: PipelineDefinition): ExecutionPlan {
    const errors: ValidationError[] = [];
    const warnings: GenerationWarning[] = [];
    const notes: string[] = [];

    const sources = pipeline.nodes.filter(n => n.type === 'source');
    const transforms = pipeline.nodes.filter(n => n.type === 'transformation');
    const sinks = pipeline.nodes.filter(n => n.type === 'sink');
    const userPref = pipeline.environment.technology;

    // ─── Source Analysis ────────────────────────────────────────────────
    const sourceTypes = sources.map(s => s.sourceType).filter(Boolean) as SourceType[];
    const dbSources = sources.filter(s => DB_SOURCE_TYPES.has(s.sourceType!));
    const fileSources = sources.filter(s => FILE_SOURCE_TYPES.has(s.sourceType!));
    const hasDbSources = dbSources.length > 0;
    const hasFileSources = fileSources.length > 0;
    const isHeterogeneous = this.areSourcesHeterogeneous(dbSources);

    notes.push(`Sources: ${sourceTypes.join(', ')} (${dbSources.length} DB, ${fileSources.length} file)`);

    // ─── Transform Analysis ────────────────────────────────────────────
    const transformTypes = transforms.map(t => t.transformationType).filter(Boolean) as TransformationType[];
    const allSqlCompatible = transformTypes.every(t => SQL_COMPATIBLE_TRANSFORMS.has(t));
    const hasSparkOnly = transformTypes.some(t => SPARK_ONLY_TRANSFORMS.has(t));
    const hasScd = transformTypes.some(t => t === 'scd_type1' || t === 'scd_type2');

    notes.push(`Transforms: ${transformTypes.length} total, SQL-compatible: ${allSqlCompatible}, Spark-only: ${hasSparkOnly}`);

    // ─── Sink Analysis ─────────────────────────────────────────────────
    const sinkTypes = sinks.map(s => s.sinkType).filter(Boolean) as SinkType[];
    const hasFileSinks = sinkTypes.some(t => t === 'file' || t === 's3' || t === 'adls' || t === 'gcs' || t === 'hdfs');
    const hasMergeCapableSink = sinkTypes.some(t => MERGE_CAPABLE_SINK_TYPES.has(t));

    notes.push(`Sinks: ${sinkTypes.join(', ')}`);

    // ─── Validation Rule 1: SCD on file target ─────────────────────────
    if (hasScd && hasFileSinks && !hasMergeCapableSink) {
      errors.push({
        code: 'SCD_FILE_TARGET',
        message: 'SCD Type 1/2 requires a merge-capable target (JDBC, Delta, or Iceberg). File sinks do not support MERGE operations.',
      });
    }

    // ─── Validation Rule 2: SCD without merge-capable sink ─────────────
    if (hasScd && !hasMergeCapableSink) {
      errors.push({
        code: 'SCD_NO_MERGE_SINK',
        message: 'SCD transformations require a merge-capable sink (JDBC, Delta Lake, or Iceberg).',
      });
    }

    // ─── Decision Matrix ───────────────────────────────────────────────

    // User explicitly wants SQL pushdown
    if (userPref === 'sql') {
      return this.evaluateSqlPushdown(
        pipeline, errors, warnings, notes,
        { hasDbSources, hasFileSources, isHeterogeneous, allSqlCompatible, hasSparkOnly, hasScd, dbSources, sinks }
      );
    }

    // User explicitly wants PySpark
    if (userPref === 'pyspark' || userPref === 'scala-spark') {
      notes.push(`User preference: ${userPref} — using Spark execution.`);
      if (errors.length > 0) {
        return { mode: 'VALIDATION_ERROR', errors, warnings, feasibilityNotes: notes };
      }
      return { mode: 'FULL_PYSPARK', errors, warnings, feasibilityNotes: notes };
    }

    // Auto-detect mode (no explicit preference or unknown)
    return this.autoDetectMode(
      pipeline, errors, warnings, notes,
      { hasDbSources, hasFileSources, isHeterogeneous, allSqlCompatible, hasSparkOnly, hasScd, dbSources, sinks }
    );
  }

  /**
   * Evaluate whether SQL pushdown is feasible when user explicitly selects it.
   */
  private static evaluateSqlPushdown(
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: GenerationWarning[],
    notes: string[],
    ctx: AnalysisContext,
  ): ExecutionPlan {

    // Rule 3: Heterogeneous DB sources + SQL pref
    if (ctx.isHeterogeneous) {
      errors.push({
        code: 'SQL_HETEROGENEOUS_SOURCES',
        message: 'SQL pushdown requires all sources to be from the same database instance. Detected heterogeneous JDBC sources with different URLs.',
      });
    }

    // Rule 4: File source + SQL pref
    if (ctx.hasFileSources) {
      errors.push({
        code: 'SQL_FILE_SOURCE',
        message: 'SQL pushdown is not compatible with file-based sources. Use PySpark or Hybrid mode instead.',
      });
    }

    // Rule 5: Non-SQL transforms + SQL pref
    if (ctx.hasSparkOnly) {
      errors.push({
        code: 'SQL_UNSUPPORTED_TRANSFORMS',
        message: 'One or more transformations (UDF, flatten, explode, mask, data quality, etc.) are not SQL-compatible. Use PySpark or Hybrid mode.',
      });
    }

    // Rule 6: SCD + SQL pref — SCD generates Spark-specific code
    if (ctx.hasScd) {
      errors.push({
        code: 'SQL_SCD_INCOMPATIBLE',
        message: 'SCD transformations generate Spark-specific merge operations and cannot run in pure SQL mode.',
      });
    }

    // Rule 7: Source DB ≠ Target DB
    if (!ctx.isHeterogeneous && ctx.hasDbSources && !ctx.hasFileSources) {
      const sourceDbs = this.extractJdbcUrls(ctx.dbSources);
      const sinkDbs = this.extractSinkJdbcUrls(ctx.sinks);
      if (sourceDbs.length > 0 && sinkDbs.length > 0) {
        const mismatch = sinkDbs.some(su => !sourceDbs.includes(su));
        if (mismatch) {
          errors.push({
            code: 'SQL_SOURCE_SINK_MISMATCH',
            message: 'SQL pushdown requires source and target to be the same database. Source and sink JDBC URLs do not match.',
          });
        }
      }
    }

    // Rule: No SQL engine registered
    if (errors.length === 0) {
      warnings.push({
        code: 'SQL_ENGINE_NOT_AVAILABLE',
        message: 'SQL pushdown engine is not yet implemented. Falling back to PySpark. Your pipeline is SQL-compatible and would benefit from a SQL engine once available.',
        severity: 'warn',
      });
      notes.push('SQL pushdown feasible but engine not available — falling back to PySpark.');
      return { mode: 'FULL_PYSPARK', errors: [], warnings, feasibilityNotes: notes };
    }

    notes.push(`SQL pushdown rejected: ${errors.length} feasibility errors.`);
    return { mode: 'VALIDATION_ERROR', errors, warnings, feasibilityNotes: notes };
  }

  /**
   * Auto-detect the best execution mode based on pipeline topology.
   */
  private static autoDetectMode(
    _pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: GenerationWarning[],
    notes: string[],
    ctx: AnalysisContext,
  ): ExecutionPlan {
    if (errors.length > 0) {
      return { mode: 'VALIDATION_ERROR', errors, warnings, feasibilityNotes: notes };
    }

    // Pure DB-to-same-DB with SQL-compatible transforms → could be SQL pushdown
    if (ctx.hasDbSources && !ctx.hasFileSources && !ctx.isHeterogeneous && ctx.allSqlCompatible && !ctx.hasScd) {
      warnings.push({
        code: 'AUTO_DETECT_SQL_ELIGIBLE',
        message: 'Pipeline is eligible for SQL pushdown (same DB, SQL-compatible transforms). Using PySpark as SQL engine is not yet available.',
        severity: 'info',
      });
      notes.push('Auto-detected: SQL-eligible → using PySpark (SQL engine pending).');
    }

    // Mixed sources → must be Spark
    if (ctx.hasDbSources && ctx.hasFileSources) {
      notes.push('Auto-detected: Mixed sources (DB + File) → PySpark required.');
    }

    return { mode: 'FULL_PYSPARK', errors, warnings, feasibilityNotes: notes };
  }

  /**
   * Check if JDBC sources are heterogeneous (different DB instances/URLs).
   */
  private static areSourcesHeterogeneous(dbSources: PipelineNode[]): boolean {
    const urls = this.extractJdbcUrls(dbSources);
    if (urls.length <= 1) return false;
    // Normalize by extracting host:port/db to compare
    const normalized = urls.map(u => this.normalizeJdbcUrl(u));
    return new Set(normalized).size > 1;
  }

  private static extractJdbcUrls(nodes: PipelineNode[]): string[] {
    return nodes
      .filter(n => n.sourceType === 'jdbc')
      .map(n => (n.config as JdbcSourceConfig).url)
      .filter(Boolean);
  }

  private static extractSinkJdbcUrls(nodes: PipelineNode[]): string[] {
    return nodes
      .filter(n => n.sinkType === 'jdbc')
      .map(n => (n.config as JdbcSinkConfig).url)
      .filter(Boolean);
  }

  /**
   * Normalize a JDBC URL for comparison by extracting host:port/database.
   */
  private static normalizeJdbcUrl(url: string): string {
    // jdbc:postgresql://host:port/db → host:port/db
    const match = url.match(/:\/\/([^?]+)/);
    return match ? match[1].toLowerCase() : url.toLowerCase();
  }
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface AnalysisContext {
  hasDbSources: boolean;
  hasFileSources: boolean;
  isHeterogeneous: boolean;
  allSqlCompatible: boolean;
  hasSparkOnly: boolean;
  hasScd: boolean;
  dbSources: PipelineNode[];
  sinks: PipelineNode[];
}
