import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, PivotConfig, UnpivotConfig, ExplodeConfig, FlattenConfig,
  CustomSqlConfig, CustomUdfConfig, DataQualityConfig, RepartitionConfig, MaskConfig, CacheConfig
} from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

function getInputVar(node: PipelineNode, context: GenerationContext, index = 0): string {
  const inputId = node.inputs[index];
  return context.resolvedNodes.get(inputId)?.varName ?? `MISSING_INPUT_${index}`;
}

// ─── Pivot ────────────────────────────────────────────────────────────────────

export class PySparkPivotGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'pivot';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'pivot';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as PivotConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Pivot)`);

    const groupCols = cfg.groupByColumns.map(c => pyStringLiteral(c)).join(', ');
    const pivotValues = cfg.pivotValues ? `[${cfg.pivotValues.map(v => pyStringLiteral(v)).join(', ')}]` : '';
    const aggExprs = cfg.aggregations.map(agg => {
      const fn = agg.function === 'sum' ? 'F.sum' : agg.function === 'count' ? 'F.count' : `F.${agg.function}`;
      return `${fn}(F.col(${pyStringLiteral(agg.column)})).alias(${pyStringLiteral(agg.alias)})`;
    }).join(', ');

    b.line(`${varName} = (`);
    b.indent(b2 => {
      b2.line(`${inputVar}`);
      b2.indent(b3 => {
        b3.line(`.groupBy(${groupCols})`);
        if (pivotValues) {
          b3.line(`.pivot(${pyStringLiteral(cfg.pivotColumn)}, ${pivotValues})`);
        } else {
          b3.line(`.pivot(${pyStringLiteral(cfg.pivotColumn)})`);
        }
        b3.line(`.agg(${aggExprs})`);
      });
    });
    b.line(')');

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Unpivot (stack) ──────────────────────────────────────────────────────────

export class PySparkUnpivotGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'unpivot';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'unpivot';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as UnpivotConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Unpivot via stack)`);

    const idCols = cfg.idColumns.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
    const n = cfg.valueColumns.length;
    const stackArgs = cfg.valueColumns.map(c => `${pyStringLiteral(c)}, F.col(${pyStringLiteral(c)})`).join(', ');
    const stackExpr = `F.expr("stack(${n}, ${cfg.valueColumns.map(c => `'${c}', \`${c}\``).join(', ')}) AS (${cfg.variableColumn}, ${cfg.valueColumn})")`;

    b.line(`${varName} = ${inputVar}.select(${idCols}, ${stackExpr})`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Explode ──────────────────────────────────────────────────────────────────

export class PySparkExplodeGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'explode';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'explode';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as ExplodeConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Explode)`);

    const fn = cfg.outer ? 'F.explode_outer' : 'F.explode';
    const alias = cfg.alias ?? cfg.column;
    b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(alias)}, ${fn}(F.col(${pyStringLiteral(cfg.column)})))`);

    if (!cfg.alias) {
      // Drop original column if alias same name
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Flatten ──────────────────────────────────────────────────────────────────

export class PySparkFlattenGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'flatten';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'flatten';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FlattenConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const sep = cfg.separator ?? '_';
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Flatten Structs)`);

    // Generate flatten helper inline
    b.line(`def _flatten_df(df, sep=${pyStringLiteral(sep)}, cols=None):`);
    b.indent(b2 => {
      b2.line(`from pyspark.sql.types import StructType`);
      b2.line(`flat_cols = []`);
      b2.line(`for field in df.schema:`);
      b2.indent(b3 => {
        b3.line(`if isinstance(field.dataType, StructType) and (cols is None or field.name in (cols or [])):`);
        b3.indent(b4 => {
          b4.line(`for nested in field.dataType:`);
          b4.indent(b5 => {
            b5.line(`flat_cols.append(F.col(f"{field.name}.{nested.name}").alias(f"{field.name}{sep}{nested.name}"))`);
          });
        });
        b3.line(`else:`);
        b3.indent(b4 => {
          b4.line(`flat_cols.append(F.col(field.name))`);
        });
      });
      b2.line(`return df.select(flat_cols)`);
    });
    b.blank();

    const colsArg = cfg.columns && cfg.columns.length > 0
      ? `cols=[${cfg.columns.map(c => pyStringLiteral(c)).join(', ')}]`
      : 'cols=None';
    b.line(`${varName} = _flatten_df(${inputVar}, sep=${pyStringLiteral(sep)}, ${colsArg})`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Custom SQL ───────────────────────────────────────────────────────────────

export class PySparkCustomSqlGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'custom_sql';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'custom_sql';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as CustomSqlConfig;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Custom SQL)`);

    // Register each input as a temp view
    node.inputs.forEach((inputId, i) => {
      const inputVar = context.resolvedNodes.get(inputId)?.varName ?? `MISSING_${i}`;
      const viewName = cfg.tempViewName ?? `_view_${inputVar}`;
      const actualView = i === 0 ? viewName : `${viewName}_${i}`;
      b.line(`${inputVar}.createOrReplaceTempView(${pyStringLiteral(actualView)})`);
      context.tempViewRegistry.set(inputId, actualView);
    });

    b.blank();

    // Resolve {input} placeholder
    let sql = cfg.sql;
    node.inputs.forEach((inputId, i) => {
      const viewName = context.tempViewRegistry.get(inputId) ?? `view_${i}`;
      sql = sql.replace(new RegExp(`\\{input${i > 0 ? i : ''}\\}`, 'g'), viewName);
    });

    b.line(`${varName} = spark.sql("""`);
    sql.split('\n').forEach(line => {
      b.line(`    ${line}`);
    });
    b.line(`""")`);

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Data Quality ─────────────────────────────────────────────────────────────

export class PySparkDataQualityGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'data_quality';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'data_quality';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DataQualityConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Transform: ${node.name} (Data Quality Checks)`);
      b.line(`# Failure action: ${cfg.failureAction}`);
    }

    b.line(`_dq_results_${varName} = []`);
    b.blank();

    cfg.rules.forEach(rule => {
      const condExpr = this.buildRuleCondition(rule);
      b.line(`# DQ Rule: ${rule.name}`);

      if (cfg.failureAction === 'fail') {
        b.line(`_dq_fail_count_${rule.name.replace(/\W/g, '_')} = ${inputVar}.filter(~(${condExpr})).count()`);
        b.line(`if _dq_fail_count_${rule.name.replace(/\W/g, '_')} > 0:`);
        b.indent(b2 => {
          b2.line(`raise ValueError(f"DQ Rule '${rule.name}' failed: {_dq_fail_count_${rule.name.replace(/\W/g, '_')}} records failed the check")`);
        });
      } else if (cfg.failureAction === 'drop') {
        b.line(`${inputVar} = ${inputVar}.filter(${condExpr})`);
        b.line(`logger.warning(f"DQ Rule '${rule.name}': dropped failing records")`);
      } else if (cfg.failureAction === 'quarantine' && cfg.quarantinePath) {
        b.line(`_dq_bad_${varName} = ${inputVar}.filter(~(${condExpr}))`);
        b.line(`${inputVar} = ${inputVar}.filter(${condExpr})`);
        b.line(`_dq_bad_${varName}.write.mode("append").parquet(${pyStringLiteral(cfg.quarantinePath)})`);
        b.line(`logger.warning(f"DQ Rule '${rule.name}': quarantined {_dq_bad_${varName}.count()} records")`);
      } else {
        // warn only
        b.line(`logger.warning(f"DQ Rule '${rule.name}': {${inputVar}.filter(~(${condExpr})).count()} failing records")`);
      }
      b.blank();
    });

    b.line(`${varName} = ${inputVar}`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }

  private buildRuleCondition(rule: DataQualityConfig['rules'][0]): string {
    switch (rule.type) {
      case 'not_null':    return `F.col(${pyStringLiteral(rule.column!)}).isNotNull()`;
      case 'unique':      return `True  # unique check requires window; see docs`;
      case 'range':       return `F.col(${pyStringLiteral(rule.column!)}).between(${rule.params?.['min'] ?? 'None'}, ${rule.params?.['max'] ?? 'None'})`;
      case 'regex':       return `F.col(${pyStringLiteral(rule.column!)}).rlike(${pyStringLiteral(String(rule.params?.['pattern'] ?? '.*'))})`;
      case 'custom':      return rule.expression ?? 'True';
      default:            return 'True';
    }
  }
}

// ─── Repartition ──────────────────────────────────────────────────────────────

export class PySparkRepartitionGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'repartition';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'repartition';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as RepartitionConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Repartition)`);

    if (cfg.strategy === 'range' && cfg.columns && cfg.columns.length > 0) {
      const colArgs = cfg.columns.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
      const numPart = cfg.numPartitions ? `${cfg.numPartitions}, ` : '';
      b.line(`${varName} = ${inputVar}.repartitionByRange(${numPart}${colArgs})`);
    } else if (cfg.columns && cfg.columns.length > 0 && cfg.numPartitions) {
      const colArgs = cfg.columns.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
      b.line(`${varName} = ${inputVar}.repartition(${cfg.numPartitions}, ${colArgs})`);
    } else if (cfg.numPartitions) {
      b.line(`${varName} = ${inputVar}.repartition(${cfg.numPartitions})`);
    } else {
      b.line(`${varName} = ${inputVar}.coalesce(1)  # WARNING: coalesce(1) - verify intent`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export class PySparkCacheGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'cache';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'cache';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const cfg = node.config as CacheConfig;

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Cache)`);

    if (cfg.storageLevel) {
      b.line(`from pyspark import StorageLevel`);
      b.line(`${varName} = ${inputVar}.persist(StorageLevel.${cfg.storageLevel})`);
    } else {
      b.line(`${varName} = ${inputVar}.cache()`);
    }

    if (cfg.eager) {
      b.line(`${varName}.count()  # Eager materialization`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Mask / Anonymize ─────────────────────────────────────────────────────────

export class PySparkMaskGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'mask';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'mask';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as MaskConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Data Masking)`);

    b.line(`${varName} = (`);
    b.indent(b2 => {
      b2.line(`${inputVar}`);
      b2.indent(b3 => {
        cfg.columns.forEach(col => {
          const maskExpr = this.buildMaskExpr(col);
          b3.line(`.withColumn(${pyStringLiteral(col.name)}, ${maskExpr})`);
        });
      });
    });
    b.line(')');

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }

  private buildMaskExpr(col: MaskConfig['columns'][0]): string {
    switch (col.strategy) {
      case 'hash':
        return `F.sha2(F.col(${pyStringLiteral(col.name)}).cast("string"), 256)`;
      case 'null':
        return `F.lit(None)`;
      case 'truncate': {
        const len = col.params?.['length'] ?? 4;
        return `F.substring(F.col(${pyStringLiteral(col.name)}), 1, ${len})`;
      }
      case 'replace': {
        const val = col.params?.['value'] ?? '***';
        return `F.lit(${pyStringLiteral(val)})`;
      }
      case 'regex_replace': {
        const pattern = col.params?.['pattern'] ?? '.*';
        const replacement = col.params?.['replacement'] ?? '***';
        return `F.regexp_replace(F.col(${pyStringLiteral(col.name)}), ${pyStringLiteral(pattern)}, ${pyStringLiteral(replacement)})`;
      }
      default:
        return `F.col(${pyStringLiteral(col.name)})`;
    }
  }
}
