import { INodeGenerator, GeneratedNodeCode, GenerationContext, GenerationWarning } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, ScdType1Config, ScdType2Config, SurrogateKeyConfig
} from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInputVar(node: PipelineNode, context: GenerationContext): string {
  const inputId = node.inputs[0];
  return context.resolvedNodes.get(inputId)?.varName ?? 'MISSING_INPUT';
}

// ─── SCD Type 1 (Upsert / Merge) ─────────────────────────────────────────────
//
// SCD Type 1 overwrites existing records with new values — no history is kept.
// Generated code uses Delta Lake MERGE INTO:
//
//   target.merge(source, "target.key = source.key")
//     .whenMatchedUpdate(set={...})
//     .whenNotMatchedInsert(values={...})
//     .execute()
//
// Requires: Delta Lake enabled, target must be a Delta table.

export class PySparkScdType1Generator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'scd_type1';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'scd_type1';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as ScdType1Config;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: GenerationWarning[] = [];

    if (context.options.includeComments) {
      b.line(`# SCD Type 1: ${node.name} (Upsert — overwrite matched records)`);
      b.line(`# Merge keys: ${cfg.mergeKeys.join(', ')}`);
    }

    if (cfg.mergeKeys.length === 0) {
      warnings.push({
        nodeId: node.id,
        code: 'SCD1_NO_MERGE_KEYS',
        message: `SCD Type 1 node "${node.name}" has no merge keys — MERGE will fail.`,
        severity: 'error',
      });
    }

    // Import DeltaTable
    b.line(`from delta.tables import DeltaTable`);
    b.blank();

    // The node receives the source DataFrame from its input.
    // The target Delta table path/name must be resolved from the downstream sink node.
    // For flexibility, we generate a helper function that accepts the target table.
    b.line(`# SCD Type 1 MERGE — source DataFrame: ${inputVar}`);
    b.line(`# Target table will be provided by the downstream Delta/JDBC sink`);
    b.line(`# This node prepares the MERGE operation as a reusable function`);
    b.blank();

    const mergeCondition = cfg.mergeKeys
      .map(k => `target.${k} = source.${k}`)
      .join(' AND ');

    const fnName = `_scd1_merge_${varName}`;

    b.line(`def ${fnName}(spark, target_table_path: str, source_df):`);
    b.line(`    """SCD Type 1 MERGE: overwrites matched records, inserts new."""`);
    b.line(`    delta_target = DeltaTable.forPath(spark, target_table_path)`);
    b.blank();

    if (cfg.updateColumns.length > 0) {
      // Update specific columns only
      const updateSet = cfg.updateColumns
        .map(col => `${pyStringLiteral(col)}: f"source.${col}"`)
        .join(', ');
      b.line(`    (delta_target.alias("target")`);
      b.line(`        .merge(`);
      b.line(`            source_df.alias("source"),`);
      b.line(`            ${pyStringLiteral(mergeCondition)}`);
      b.line(`        )`);
      b.line(`        .whenMatchedUpdate(set={${updateSet}})`);
      b.line(`        .whenNotMatchedInsertAll()`);
      b.line(`        .execute()`);
      b.line(`    )`);
    } else {
      // Update all columns
      b.line(`    (delta_target.alias("target")`);
      b.line(`        .merge(`);
      b.line(`            source_df.alias("source"),`);
      b.line(`            ${pyStringLiteral(mergeCondition)}`);
      b.line(`        )`);
      b.line(`        .whenMatchedUpdateAll()`);
      b.line(`        .whenNotMatchedInsertAll()`);
      b.line(`        .execute()`);
      b.line(`    )`);
    }

    b.blank();

    if (context.options.includeLogging) {
      b.line(`    logger.info(f"SCD Type 1 MERGE completed for '${node.name}'")`);
    }

    b.blank();

    // The variable passed downstream is still the source DataFrame
    b.line(`${varName} = ${inputVar}`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}

// ─── SCD Type 2 (History-Preserving) ──────────────────────────────────────────
//
// SCD Type 2 preserves history by closing active records and inserting new ones.
//
// Algorithm:
//   1. Hash tracking columns in both source and target for change detection
//   2. Join source → target on business keys WHERE target.is_current = true
//   3. Identify CHANGED rows (hash differs) and NEW rows (no match)
//   4. Close changed records: end_date = current_date, is_current = false
//   5. Insert new/changed rows: effective_date = current_date, end_date = '9999-12-31', is_current = true

export class PySparkScdType2Generator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'scd_type2';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'scd_type2';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as ScdType2Config;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: GenerationWarning[] = [];

    const effDate = cfg.effectiveDateColumn;
    const endDate = cfg.endDateColumn;
    const currentFlag = cfg.currentFlagColumn;
    const endDateDefault = cfg.endDateDefaultValue ?? '9999-12-31';
    const bKeys = cfg.businessKeys;
    const trackCols = cfg.trackingColumns;

    if (context.options.includeComments) {
      b.line(`# SCD Type 2: ${node.name} (History-Preserving Dimension)`);
      b.line(`# Business keys: ${bKeys.join(', ')}`);
      b.line(`# Tracking columns: ${trackCols.join(', ')}`);
    }

    if (bKeys.length === 0) {
      warnings.push({
        nodeId: node.id,
        code: 'SCD2_NO_BUSINESS_KEYS',
        message: `SCD Type 2 node "${node.name}" has no business keys — cannot merge.`,
        severity: 'error',
      });
    }

    if (trackCols.length === 0) {
      warnings.push({
        nodeId: node.id,
        code: 'SCD2_NO_TRACKING_COLUMNS',
        message: `SCD Type 2 node "${node.name}" has no tracking columns — cannot detect changes.`,
        severity: 'warn',
      });
    }

    b.line(`from delta.tables import DeltaTable`);
    b.blank();

    const fnName = `_scd2_merge_${varName}`;
    const hashExpr = trackCols.map(c => `F.col(${pyStringLiteral(c)}).cast("string")`).join(', ');
    const joinCond = bKeys.map(k => `F.col(f"source.${k}") == F.col(f"target.${k}")`).join(' & ');

    b.line(`def ${fnName}(spark, target_table_path: str, source_df):`);
    b.line(`    """SCD Type 2: close expired records and insert new/changed rows."""`);
    b.blank();
    b.line(`    # Step 1: Add change hash to source`);
    b.line(`    source_hashed = source_df.withColumn(`);
    b.line(`        "_scd2_hash", F.md5(F.concat_ws("|", ${hashExpr}))`);
    b.line(`    )`);
    b.blank();
    b.line(`    # Step 2: Read current target dimension (only active records)`);
    b.line(`    delta_target = DeltaTable.forPath(spark, target_table_path)`);
    b.line(`    target_df = delta_target.toDF().filter(F.col(${pyStringLiteral(currentFlag)}) == True)`);
    b.blank();
    b.line(`    # Add hash to target for comparison`);
    b.line(`    target_hashed = target_df.withColumn(`);
    b.line(`        "_scd2_hash", F.md5(F.concat_ws("|", ${hashExpr}))`);
    b.line(`    )`);
    b.blank();
    b.line(`    # Step 3: Identify changed and new rows`);
    b.line(`    joined = (source_hashed.alias("source")`);
    b.line(`        .join(target_hashed.alias("target"),`);
    b.line(`            [${bKeys.map(k => `F.col(f"source.${k}") == F.col(f"target.${k}")`).join(', ')}],`);
    b.line(`            "left"`);
    b.line(`        )`);
    b.line(`    )`);
    b.blank();
    b.line(`    # Changed rows: match exists but hash differs`);
    b.line(`    changed_keys = (joined`);
    b.line(`        .filter(F.col("target._scd2_hash").isNotNull())`);
    b.line(`        .filter(F.col("source._scd2_hash") != F.col("target._scd2_hash"))`);
    b.line(`        .select(${bKeys.map(k => `F.col(f"source.${k}")`).join(', ')})`);
    b.line(`    )`);
    b.blank();
    b.line(`    # New rows: no match in target`);
    b.line(`    new_rows = (joined`);
    b.line(`        .filter(F.col("target._scd2_hash").isNull())`);
    b.line(`        .select("source.*")`);
    b.line(`    )`);
    b.blank();

    // Step 4: Close expired records using Delta MERGE
    const closeMerge = bKeys.map(k => `target.${k} = expire.${k}`).join(' AND ');
    b.line(`    # Step 4: Close expired records (set end_date, is_current=false)`);
    b.line(`    if changed_keys.count() > 0:`);
    b.line(`        (delta_target.alias("target")`);
    b.line(`            .merge(`);
    b.line(`                changed_keys.alias("expire"),`);
    b.line(`                ${pyStringLiteral(closeMerge + ` AND target.${currentFlag} = true`)}`);
    b.line(`            )`);
    b.line(`            .whenMatchedUpdate(set={`);
    b.line(`                ${pyStringLiteral(endDate)}: "F.current_date()",`);
    b.line(`                ${pyStringLiteral(currentFlag)}: "F.lit(False)"`);
    b.line(`            })`);
    b.line(`            .execute()`);
    b.line(`        )`);
    b.blank();

    // Step 5: Prepare new rows (new + changed) with SCD2 columns
    b.line(`    # Step 5: Insert new/changed rows with SCD2 metadata`);
    b.line(`    changed_source = (source_hashed.alias("src")`);
    b.line(`        .join(changed_keys.alias("ck"),`);
    b.line(`            [${bKeys.map(k => `F.col(f"src.${k}") == F.col(f"ck.${k}")`).join(', ')}],`);
    b.line(`            "inner"`);
    b.line(`        )`);
    b.line(`        .select("src.*")`);
    b.line(`    )`);
    b.blank();
    b.line(`    inserts = (changed_source.unionByName(new_rows, allowMissingColumns=True)`);
    b.line(`        .drop("_scd2_hash")`);
    b.line(`        .withColumn(${pyStringLiteral(effDate)}, F.current_date())`);
    b.line(`        .withColumn(${pyStringLiteral(endDate)}, F.to_date(F.lit(${pyStringLiteral(endDateDefault)})))`);
    b.line(`        .withColumn(${pyStringLiteral(currentFlag)}, F.lit(True))`);
    b.line(`    )`);

    if (cfg.surrogateKeyColumn) {
      b.line(`    inserts = inserts.withColumn(${pyStringLiteral(cfg.surrogateKeyColumn)}, F.monotonically_increasing_id())`);
    }

    b.blank();
    b.line(`    # Append new records to Delta table`);
    b.line(`    inserts.write.format("delta").mode("append").save(target_table_path)`);
    b.blank();

    if (context.options.includeLogging) {
      b.line(`    logger.info(f"SCD Type 2 completed for '${node.name}': {inserts.count()} rows inserted")`);
    }

    b.blank();
    b.line(`${varName} = ${inputVar}`);

    return {
      varName,
      code: b.build(),
      imports: [PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.WINDOW],
      warnings,
    };
  }
}

// ─── Surrogate Key Generator ──────────────────────────────────────────────────
//
// Adds a surrogate key column using one of three strategies:
//   - monotonically_increasing: F.monotonically_increasing_id()
//   - uuid: F.expr("uuid()")
//   - row_number: row_number() over a window (partitionBy + orderBy)

export class PySparkSurrogateKeyGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'surrogate_key';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'surrogate_key';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SurrogateKeyConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: GenerationWarning[] = [];
    const imports = [PYSPARK_IMPORTS.FUNCTIONS];

    if (context.options.includeComments) {
      b.line(`# Surrogate Key: ${node.name} (strategy: ${cfg.strategy})`);
    }

    switch (cfg.strategy) {
      case 'monotonically_increasing':
        b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(cfg.outputColumn)}, F.monotonically_increasing_id())`);
        warnings.push({
          nodeId: node.id,
          code: 'SURROGATE_KEY_NON_SEQUENTIAL',
          message: `monotonically_increasing_id() produces non-sequential 64-bit IDs. These are unique but not contiguous.`,
          severity: 'info',
        });
        break;

      case 'uuid':
        b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(cfg.outputColumn)}, F.expr("uuid()"))`);
        break;

      case 'row_number': {
        imports.push(PYSPARK_IMPORTS.WINDOW);

        const partCols = (cfg.partitionBy ?? []).map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
        const orderCols = (cfg.orderBy ?? []).map(o => {
          const col = `F.col(${pyStringLiteral(o.column)})`;
          return o.direction === 'desc' ? `${col}.desc()` : `${col}.asc()`;
        });

        if (orderCols.length === 0) {
          warnings.push({
            nodeId: node.id,
            code: 'SURROGATE_KEY_NO_ORDER',
            message: `row_number strategy requires orderBy to produce deterministic keys. Using F.monotonically_increasing_id() as fallback ordering.`,
            severity: 'warn',
          });
          orderCols.push('F.monotonically_increasing_id()');
        }

        const windowSpec = partCols
          ? `Window.partitionBy(${partCols}).orderBy(${orderCols.join(', ')})`
          : `Window.orderBy(${orderCols.join(', ')})`;

        b.line(`_sk_window = ${windowSpec}`);
        b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(cfg.outputColumn)}, F.row_number().over(_sk_window))`);
        break;
      }

      default:
        b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(cfg.outputColumn)}, F.monotonically_increasing_id())`);
        warnings.push({
          nodeId: node.id,
          code: 'SURROGATE_KEY_UNKNOWN_STRATEGY',
          message: `Unknown surrogate key strategy "${cfg.strategy}" — defaulting to monotonically_increasing_id().`,
          severity: 'warn',
        });
    }

    return { varName, code: b.build(), imports: [...new Set(imports)], warnings };
  }
}
