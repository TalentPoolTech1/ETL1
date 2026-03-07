import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, FilterConfig, SelectConfig, RenameConfig, CastConfig,
  DeriveConfig, SortConfig, DedupConfig, FillnaConfig, JoinConfig,
  AggregateConfig, WindowConfig, CustomSqlConfig, DataQualityConfig,
  RepartitionConfig, MaskConfig, PivotConfig, ExplodeConfig, FlattenConfig
} from '../../../../core/types/pipeline.types';
import { ScalaCodeBuilder, toScalaVal, scalaString, toScalaSparkType } from '../scala.utils';

// ─── Helper ───────────────────────────────────────────────────────────────────

function inputVal(node: PipelineNode, ctx: GenerationContext, idx = 0): string {
  return ctx.resolvedNodes.get(node.inputs[idx])?.varName ?? 'missingInput';
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export class ScalaFilterGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'filter';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'filter'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FilterConfig;
    const v = toScalaVal(node.name); const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Filter)`);
    b.line(`val ${v} = ${inputVal(node, ctx)}.filter(${scalaString(cfg.condition)})`);
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Select ───────────────────────────────────────────────────────────────────

export class ScalaSelectGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'select';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'select'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SelectConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Select)`);

    const cols: string[] = cfg.columns.map(c => `col(${scalaString(c)})`);
    if (cfg.expressions) {
      Object.entries(cfg.expressions).forEach(([alias, expr]) => {
        cols.push(`expr(${scalaString(expr)}).as(${scalaString(alias)})`);
      });
    }

    b.line(`val ${v} = ${inp}.select(`);
    b.indent(b2 => { cols.forEach((c, i) => b2.line(`${c}${i < cols.length - 1 ? ',' : ''}`)); });
    b.line(')');
    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export class ScalaRenameGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'rename';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'rename'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as RenameConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Rename)`);
    const entries = Object.entries(cfg.mappings);
    if (entries.length === 0) {
      b.line(`val ${v} = ${inp}`);
    } else {
      b.line(`val ${v} = ${inp}`);
      b.indent(b2 => { entries.forEach(([old, n]) => b2.line(`.withColumnRenamed(${scalaString(old)}, ${scalaString(n)})`)); });
    }
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Cast ─────────────────────────────────────────────────────────────────────

export class ScalaCastGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'cast';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'cast'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as CastConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Cast)`);
    b.line(`val ${v} = ${inp}`);
    b.indent(b2 => {
      cfg.casts.forEach(c => b2.line(`.withColumn(${scalaString(c.column)}, col(${scalaString(c.column)}).cast(${toScalaSparkType(c.targetType)}))`));
    });
    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._', 'import org.apache.spark.sql.types._'], warnings: [] };
  }
}

// ─── Drop ─────────────────────────────────────────────────────────────────────

export class ScalaDropGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'drop';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'drop'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { columns: string[] };
    const v = toScalaVal(node.name); const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Drop)`);
    b.line(`val ${v} = ${inputVal(node, ctx)}.drop(${cfg.columns.map(c => scalaString(c)).join(', ')})`);
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Derive ───────────────────────────────────────────────────────────────────

export class ScalaDeriveGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'derive';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'derive'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeriveConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Derive)`);
    b.line(`val ${v} = ${inp}`);
    b.indent(b2 => {
      cfg.columns.forEach(col => {
        if (col.dataType) {
          b2.line(`.withColumn(${scalaString(col.name)}, expr(${scalaString(col.expression)}).cast(${toScalaSparkType(col.dataType)}))`);
        } else {
          b2.line(`.withColumn(${scalaString(col.name)}, expr(${scalaString(col.expression)}))`);
        }
      });
    });
    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Join ─────────────────────────────────────────────────────────────────────

export class ScalaJoinGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'join';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'join'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JoinConfig;
    const v = toScalaVal(node.name);
    const leftVar = inputVal(node, ctx, 0);
    const rightVar = ctx.resolvedNodes.get(cfg.rightInput)?.varName ?? 'missingRight';
    const b = new ScalaCodeBuilder();
    const warnings = [];

    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (${cfg.type.toUpperCase()} JOIN)`);

    const sameNameCols = cfg.conditions.filter(c => c.leftColumn === c.rightColumn).map(c => c.leftColumn);
    const diffCols = cfg.conditions.filter(c => c.leftColumn !== c.rightColumn);

    const actualRight = cfg.broadcastHint === 'right' ? `broadcast(${rightVar})` : rightVar;

    if (sameNameCols.length > 0 && diffCols.length === 0) {
      const colSeq = sameNameCols.map(c => scalaString(c)).join(', ');
      b.line(`val ${v} = ${leftVar}.join(`);
      b.indent(b2 => {
        b2.line(`${actualRight},`);
        b2.line(`Seq(${colSeq}),`);
        b2.line(`${scalaString(cfg.type)}`);
      });
      b.line(')');
    } else {
      const cond = cfg.conditions.map(c => `${leftVar}(${scalaString(c.leftColumn)}) === ${rightVar}(${scalaString(c.rightColumn)})`).join(' && ');
      b.line(`val ${v} = ${leftVar}.join(`);
      b.indent(b2 => {
        b2.line(`${actualRight},`);
        b2.line(`${cond},`);
        b2.line(`${scalaString(cfg.type)}`);
      });
      b.line(')');
    }

    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings };
  }
}

// ─── Union ────────────────────────────────────────────────────────────────────

export class ScalaUnionGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'union';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'union'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { byName?: boolean };
    const v = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();
    const inputVars = node.inputs.map(id => ctx.resolvedNodes.get(id)?.varName ?? 'missing');
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Union)`);
    const method = cfg.byName ? 'unionByName' : 'union';
    b.line(`val ${v} = ${inputVars[0]}`);
    b.indent(b2 => { inputVars.slice(1).forEach(iv => b2.line(`.${method}(${iv})`)); });
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export class ScalaAggregateGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'aggregate';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'aggregate'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as AggregateConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Aggregate)`);

    const groupCols = cfg.groupBy.map(c => `col(${scalaString(c)})`).join(', ');
    const aggExprs = cfg.aggregations.map(agg => {
      const fn = this.buildAggFn(agg.function, agg.column, agg.distinct ?? false);
      return `${fn}.as(${scalaString(agg.alias)})`;
    });

    if (cfg.groupBy.length === 0) {
      b.line(`val ${v} = ${inp}.agg(`);
    } else {
      b.line(`val ${v} = ${inp}.groupBy(${groupCols}).agg(`);
    }
    b.indent(b2 => { aggExprs.forEach((e, i) => b2.line(`${e}${i < aggExprs.length - 1 ? ',' : ''}`)); });
    b.line(')');
    if (cfg.having) b.line(`  .filter(${scalaString(cfg.having)})`);

    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }

  private buildAggFn(fn: string, col: string, distinct: boolean): string {
    const c = `col(${scalaString(col)})`;
    switch (fn) {
      case 'count':        return distinct ? `countDistinct(${c})` : `count(${c})`;
      case 'sum':          return `sum(${c})`;
      case 'avg':          return `avg(${c})`;
      case 'min':          return `min(${c})`;
      case 'max':          return `max(${c})`;
      case 'first':        return `first(${c}, ignoreNulls = true)`;
      case 'last':         return `last(${c}, ignoreNulls = true)`;
      case 'collect_list': return `collect_list(${c})`;
      case 'collect_set':  return `collect_set(${c})`;
      default:             return `${fn}(${c})`;
    }
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

export class ScalaWindowGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'window';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'window'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as WindowConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const wSpec = `wSpec${v.charAt(0).toUpperCase() + v.slice(1)}`;
    const b = new ScalaCodeBuilder();
    const imports = ['import org.apache.spark.sql.functions._', 'import org.apache.spark.sql.expressions.Window'];

    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Window Functions)`);

    const partCols = cfg.partitionBy.map(c => `col(${scalaString(c)})`).join(', ');
    const ordCols = cfg.orderBy.map(o => {
      const c = `col(${scalaString(o.column)})`;
      return o.direction === 'desc' ? `${c}.desc` : c;
    }).join(', ');

    let windowSpec = 'Window';
    if (cfg.partitionBy.length > 0) windowSpec += `.partitionBy(${partCols})`;
    if (cfg.orderBy.length > 0) windowSpec += `.orderBy(${ordCols})`;
    if (cfg.rowsBetween) {
      const [s, e] = cfg.rowsBetween;
      const sv = s === 'unbounded' ? 'Window.unboundedPreceding' : String(s);
      const ev = e === 'unbounded' ? 'Window.unboundedFollowing' : String(e);
      windowSpec += `.rowsBetween(${sv}, ${ev})`;
    }

    b.line(`val ${wSpec} = ${windowSpec}`);
    b.blank();
    b.line(`val ${v} = ${inp}`);
    b.indent(b2 => {
      cfg.windowFunctions.forEach(wf => {
        b2.line(`.withColumn(${scalaString(wf.alias)}, ${this.buildWindowFn(wf)}.over(${wSpec}))`);
      });
    });

    return { varName: v, code: b.build(), imports, warnings: [] };
  }

  private buildWindowFn(wf: WindowConfig['windowFunctions'][0]): string {
    switch (wf.function.toLowerCase()) {
      case 'row_number':  return 'row_number()';
      case 'rank':        return 'rank()';
      case 'dense_rank':  return 'dense_rank()';
      case 'percent_rank': return 'percent_rank()';
      case 'cume_dist':   return 'cume_dist()';
      case 'lag':         return `lag(col(${scalaString(wf.column!)}), ${wf.offset ?? 1})`;
      case 'lead':        return `lead(col(${scalaString(wf.column!)}), ${wf.offset ?? 1})`;
      case 'sum':         return `sum(col(${scalaString(wf.column!)}))`;
      case 'avg':         return `avg(col(${scalaString(wf.column!)}))`;
      case 'min':         return `min(col(${scalaString(wf.column!)}))`;
      case 'max':         return `max(col(${scalaString(wf.column!)}))`;
      case 'count':       return `count(col(${scalaString(wf.column!)}))`;
      case 'ntile':       return `ntile(${wf.offset ?? 4})`;
      default:            return `${wf.function}(col(${scalaString(wf.column ?? '*')}))`;
    }
  }
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

export class ScalaDedupGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'dedup';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'dedup'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { columns?: string[] };
    const v = toScalaVal(node.name); const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Dedup)`);
    if (cfg.columns && cfg.columns.length > 0) {
      b.line(`val ${v} = ${inputVal(node, ctx)}.dropDuplicates(Seq(${cfg.columns.map(c => scalaString(c)).join(', ')}))`);
    } else {
      b.line(`val ${v} = ${inputVal(node, ctx)}.dropDuplicates()`);
    }
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

export class ScalaSortGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'sort';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'sort'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SortConfig;
    const v = toScalaVal(node.name); const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Sort)`);
    const sortExprs = cfg.orderBy.map(o => {
      const c = `col(${scalaString(o.column)})`;
      return o.direction === 'desc' ? `${c}.desc` : c;
    }).join(', ');
    b.line(`val ${v} = ${inputVal(node, ctx)}.orderBy(${sortExprs})`);
    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Custom SQL ───────────────────────────────────────────────────────────────

export class ScalaCustomSqlGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'custom_sql';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'custom_sql'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as CustomSqlConfig;
    const v = toScalaVal(node.name); const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Custom SQL)`);

    node.inputs.forEach((inputId, i) => {
      const iv = ctx.resolvedNodes.get(inputId)?.varName ?? `missing_${i}`;
      const viewName = cfg.tempViewName ?? `view_${iv}`;
      b.line(`${iv}.createOrReplaceTempView(${scalaString(i === 0 ? viewName : `${viewName}_${i}`)})`);
    });
    b.blank();
    b.line(`val ${v} = spark.sql(s"""${cfg.sql}""")`);
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Repartition ─────────────────────────────────────────────────────────────

export class ScalaRepartitionGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'repartition';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'repartition'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as RepartitionConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Repartition)`);

    if (cfg.columns && cfg.columns.length > 0 && cfg.numPartitions) {
      const cols = cfg.columns.map(c => `col(${scalaString(c)})`).join(', ');
      b.line(`val ${v} = ${inp}.repartition(${cfg.numPartitions}, ${cols})`);
    } else if (cfg.numPartitions) {
      b.line(`val ${v} = ${inp}.repartition(${cfg.numPartitions})`);
    } else {
      b.line(`val ${v} = ${inp}.coalesce(1)`);
    }
    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Data Quality ─────────────────────────────────────────────────────────────

export class ScalaDataQualityGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const; readonly subType = 'data_quality';
  canHandle(n: PipelineNode) { return n.type === 'transformation' && n.transformationType === 'data_quality'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DataQualityConfig;
    const v = toScalaVal(node.name); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Transform: ${node.name} (Data Quality)`);

    cfg.rules.forEach(rule => {
      const cond = this.buildCond(rule);
      b.comment(`DQ Rule: ${rule.name}`);
      if (cfg.failureAction === 'fail') {
        b.line(`val failCount_${rule.name.replace(/\W/g, '_')} = ${inp}.filter(!($${cond})).count()`);
        b.line(`require(failCount_${rule.name.replace(/\W/g, '_')} == 0, s"DQ Rule '${rule.name}' failed: $$failCount_${rule.name.replace(/\W/g, '_')} rows")`);
      } else if (cfg.failureAction === 'drop') {
        b.line(`// drop failing rows for rule: ${rule.name}`);
      }
      b.blank();
    });

    if (cfg.failureAction === 'drop') {
      const conditions = cfg.rules.map(r => this.buildCond(r)).join(' && ');
      b.line(`val ${v} = ${inp}.filter(${conditions})`);
    } else {
      b.line(`val ${v} = ${inp}`);
    }

    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }

  private buildCond(rule: DataQualityConfig['rules'][0]): string {
    switch (rule.type) {
      case 'not_null': return `col(${scalaString(rule.column!)}).isNotNull`;
      case 'range':    return `col(${scalaString(rule.column!)}).between(${rule.params?.['min'] ?? 0}, ${rule.params?.['max'] ?? 'Long.MaxValue'})`;
      case 'regex':    return `col(${scalaString(rule.column!)}).rlike(${scalaString(String(rule.params?.['pattern'] ?? '.*'))})`;
      case 'custom':   return rule.expression ?? 'true';
      default:         return 'true';
    }
  }
}
