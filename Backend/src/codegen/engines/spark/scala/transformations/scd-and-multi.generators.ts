import { INodeGenerator, GeneratedNodeCode, GenerationContext, GenerationWarning } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, ScdType1Config, ScdType2Config, SurrogateKeyConfig
} from '../../../../core/types/pipeline.types';
import { ScalaCodeBuilder, toScalaVal, scalaString } from '../scala.utils';

// ─── SCD Type 1 (Upsert / Merge) ─────────────────────────────────────────────

export class ScalaScdType1Generator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'scd_type1';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'scd_type1';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as ScdType1Config;
    const inputVar = context.resolvedNodes.get(node.inputs[0])?.varName ?? 'missingInput';
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();
    const warnings: GenerationWarning[] = [];

    if (context.options.includeComments) {
      b.comment(`SCD Type 1: ${node.name} (Upsert)`);
    }

    if (cfg.mergeKeys.length === 0) {
      warnings.push({
        nodeId: node.id,
        code: 'SCD1_NO_MERGE_KEYS',
        message: `SCD Type 1 node "${node.name}" has no merge keys.`,
        severity: 'error',
      });
    }

    // Scala Delta implementation
    b.line(`import io.delta.tables._`);
    b.blank();
    
    const mergeCondition = cfg.mergeKeys
      .map(k => `target.${k} === source.${k}`)
      .join(' && ');

    b.line(`// SCD Type 1 MERGE helper`);
    b.line(`def performScd1Merge(targetPath: String, sourceDf: DataFrame): Unit = {`);
    b.indent(b2 => {
      b2.line(`val targetTable = DeltaTable.forPath(spark, targetPath)`);
      b2.line(`targetTable.as("target")`);
      b2.indent(b3 => {
        b3.line(`.merge(sourceDf.as("source"), ${scalaString(mergeCondition)})`);
        if (cfg.updateColumns.length > 0) {
          const updateMap = cfg.updateColumns
            .map(c => `${scalaString(c)} -> col("source.${c}")`)
            .join(', ');
          b3.line(`.whenMatched().updateExpr(Map(${updateMap}))`);
        } else {
          b3.line(`.whenMatched().updateAll()`);
        }
        b3.line(`.whenNotMatched().insertAll()`);
        b3.line(`.execute()`);
      });
    });
    b.line(`}`);
    b.blank();
    b.line(`val ${varName} = ${inputVar}`);

    return { varName, code: b.build(), imports: ['import org.apache.spark.sql.functions._', 'import io.delta.tables._'], warnings };
  }
}

// ─── SCD Type 2 (History) ────────────────────────────────────────────────────

export class ScalaScdType2Generator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'scd_type2';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'scd_type2';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as ScdType2Config;
    const inputVar = context.resolvedNodes.get(node.inputs[0])?.varName ?? 'missingInput';
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();
    const warnings: GenerationWarning[] = [];

    if (context.options.includeComments) {
      b.comment(`SCD Type 2: ${node.name} (History)`);
    }

    // Implementation skeleton for Scala
    b.line(`// SCD Type 2 Implementation`);
    b.line(`def performScd2Merge(targetPath: String, sourceDf: DataFrame): Unit = {`);
    b.indent(b2 => {
      // 1. Hash tracking columns
      const hashCols = cfg.trackingColumns.map(c => `col(${scalaString(c)}).cast("string")`).join(', ');
      b2.line(`val sourceWithHash = sourceDf.withColumn("_scd2_hash", md5(concat_ws("|", ${hashCols})))`);
      
      // 2. Load target active records
      b2.line(`val targetTable = DeltaTable.forPath(spark, targetPath)`);
      b2.line(`val targetActive = targetTable.toDF.filter(col(${scalaString(cfg.currentFlagColumn)}) === lit(true))`);
      b2.line(`val targetWithHash = targetActive.withColumn("_scd2_hash", md5(concat_ws("|", ${hashCols})))`);

      // 3. Find changes
      b2.line(`val joined = sourceWithHash.as("src")`);
      b2.indent(b3 => {
        const joinCond = cfg.businessKeys.map(k => `col(s"src.$k") === col(s"tgt.$k")`).join(' && ');
        b3.line(`.join(targetWithHash.as("tgt"), ${joinCond}, "left")`);
      });
      
      b2.line(`val changedKeys = joined.filter(col("tgt._scd2_hash").isNotNull && col("src._scd2_hash") !== col("tgt._scd2_hash"))`);
      b2.indent(b3 => {
        b3.line(`.select(${cfg.businessKeys.map(k => `col(s"src.$k")`).join(', ')})`);
      });

      // 4. Close expired records
      const mergeCond = cfg.businessKeys.map(k => `t.$k === e.$k`).join(' && ') + ` && t.${cfg.currentFlagColumn} === true`;
      b2.line(`if (!changedKeys.isEmpty) {`);
      b2.indent(b3 => {
        b3.line(`targetTable.as("t").merge(changedKeys.as("e"), ${scalaString(mergeCond)})`);
        b3.indent(b4 => {
          b4.line(`.whenMatched().updateExpr(Map(`);
          b4.line(`  ${scalaString(cfg.endDateColumn)} -> "current_date()",`);
          b4.line(`  ${scalaString(cfg.currentFlagColumn)} -> "lit(false)"`);
          b4.line(`)).execute()`);
        });
      });
      b2.line(`}`);

      // 5. Insert new/changed
      b2.line(`val newRows = joined.filter(col("tgt._scd2_hash").isNull).select("src.*")`);
      b2.line(`val changedRows = sourceWithHash.as("s").join(changedKeys.as("c"), ${cfg.businessKeys.map(k => `col(s"s.$k") === col(s"c.$k")`).join(' && ')}).select("s.*")`);
      b2.line(`val toInsert = newRows.unionByName(changedRows, allowMissingColumns = true)`);
      b2.indent(b3 => {
        b3.line(`.drop("_scd2_hash")`);
        b3.line(`.withColumn(${scalaString(cfg.effectiveDateColumn)}, current_date())`);
        b3.line(`.withColumn(${scalaString(cfg.endDateColumn)}, to_date(lit(${scalaString(cfg.endDateDefaultValue ?? "9999-12-31")})))`);
        b3.line(`.withColumn(${scalaString(cfg.currentFlagColumn)}, lit(true))`);
        if (cfg.surrogateKeyColumn) {
          b3.line(`.withColumn(${scalaString(cfg.surrogateKeyColumn)}, monotonically_increasing_id())`);
        }
        b3.line(`.write.format("delta").mode("append").save(targetPath)`);
      });
    });
    b.line(`}`);
    b.blank();
    b.line(`val ${varName} = ${inputVar}`);

    return { varName, code: b.build(), imports: ['import org.apache.spark.sql.functions._', 'import io.delta.tables._'], warnings };
  }
}

// ─── Surrogate Key ───────────────────────────────────────────────────────────

export class ScalaSurrogateKeyGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'surrogate_key';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'surrogate_key';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SurrogateKeyConfig;
    const inputVar = context.resolvedNodes.get(node.inputs[0])?.varName ?? 'missingInput';
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();
    const imports = ['import org.apache.spark.sql.functions._'];

    if (context.options.includeComments) {
      b.comment(`Surrogate Key: ${node.name} (${cfg.strategy})`);
    }

    switch (cfg.strategy) {
      case 'monotonically_increasing':
        b.line(`val ${varName} = ${inputVar}.withColumn(${scalaString(cfg.outputColumn)}, monotonically_increasing_id())`);
        break;
      case 'uuid':
        b.line(`val ${varName} = ${inputVar}.withColumn(${scalaString(cfg.outputColumn)}, expr("uuid()"))`);
        break;
      case 'row_number':
        imports.push('import org.apache.spark.sql.expressions.Window');
        const part = cfg.partitionBy && cfg.partitionBy.length > 0 ? `.partitionBy(${cfg.partitionBy.map(c => `col(${scalaString(c)})`).join(', ')})` : '';
        const ord = cfg.orderBy && cfg.orderBy.length > 0 
          ? `.orderBy(${cfg.orderBy.map(o => `col(${scalaString(o.column)})${o.direction === 'desc' ? '.desc' : ''}`).join(', ')})` 
          : '.orderBy(monotonically_increasing_id())';
        b.line(`val ${varName} = ${inputVar}.withColumn(${scalaString(cfg.outputColumn)}, row_number().over(Window${part}${ord}))`);
        break;
      default:
        b.line(`val ${varName} = ${inputVar}.withColumn(${scalaString(cfg.outputColumn)}, monotonically_increasing_id())`);
    }

    return { varName, code: b.build(), imports, warnings: [] };
  }
}

// ─── Multi Transform Sequence ────────────────────────────────────────────────

export class ScalaMultiTransformGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'multi_transform_sequence';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'multi_transform_sequence';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { transformSequences: any[] };
    const inputVar = context.resolvedNodes.get(node.inputs[0])?.varName ?? 'missingInput';
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) {
      b.comment(`Multi-Transform Sequence: ${node.name}`);
    }

    b.line(`val ${varName} = ${inputVar}`);
    b.indent(b2 => {
      (cfg.transformSequences || []).forEach(seq => {
        if (seq.enabled === false) return;
        const sourceColumn = typeof seq.sourceColumn === 'string' && seq.sourceColumn.trim().length > 0
          ? seq.sourceColumn.trim()
          : seq.columnName;
        let colExpr = `col(${scalaString(sourceColumn)})`;
        seq.steps.filter((s: any) => s.enabled).forEach((step: any) => {
          colExpr = this.compileStep(step, colExpr);
        });
        b2.line(`.withColumn(${scalaString(seq.columnName)}, ${colExpr})`);
      });
    });

    return { varName, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }

  private compileStep(step: any, colExpr: string): string {
    const p = step.params || {};
    switch (step.type) {
      case 'to_number': return `col(${colExpr}).cast(${p.targetType === 'decimal' ? `DecimalType(${p.precision || 10}, ${p.scale || 2})` : scalaString(p.targetType || 'double')})`;
      case 'to_date': return `to_date(${colExpr}, ${scalaString(p.format || 'yyyy-MM-dd')})`;
      case 'trim_timestamp': return `date_trunc(${scalaString(p.granularity || 'day')}, ${colExpr})`; // FIX FROM AUDIT
      case 'extract_date_part': {
        const part = String(p.part || 'MONTH').toUpperCase();
        if (part === 'YEAR') return `year(${colExpr})`;
        if (part === 'MONTH') return `month(${colExpr})`;
        if (part === 'DAY') return `dayofmonth(${colExpr})`;
        if (part === 'HOUR') return `hour(${colExpr})`;
        if (part === 'MINUTE') return `minute(${colExpr})`;
        if (part === 'SECOND') return `second(${colExpr})`;
        return `month(${colExpr})`;
      }
      case 'substring': return `substring(${colExpr}, ${p.start || 1}, ${p.length || 10})`;
      case 'upper': return `upper(${colExpr})`;
      case 'lower': return `lower(${colExpr})`;
      case 'trim': return `trim(${colExpr})`;
      case 'round': return `round(${colExpr}, ${p.scale || 0})`;
      case 'coalesce': return `coalesce(${colExpr}, lit(${p.defaultValue}))`;
      default: return colExpr;
    }
  }
}
