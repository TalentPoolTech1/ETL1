import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, JoinConfig, AggregateConfig, WindowConfig, UnionConfig } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInputVar(node: PipelineNode, context: GenerationContext, index = 0): string {
  const inputId = node.inputs[index];
  return context.resolvedNodes.get(inputId)?.varName ?? `MISSING_INPUT_${index}`;
}

// ─── Join ─────────────────────────────────────────────────────────────────────

export class PySparkJoinGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'join';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'join';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JoinConfig;
    const leftVar = getInputVar(node, context, 0);
    const rightVar = context.resolvedNodes.get(cfg.rightInput)?.varName ?? 'MISSING_RIGHT';
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (context.options.includeComments) {
      b.line(`# Transform: ${node.name} (${cfg.type.toUpperCase()} JOIN)`);
    }

    // Build join condition
    const joinConditions = cfg.conditions.map(c => {
      if (c.leftColumn === c.rightColumn) {
        // Same-name columns → use string list (avoids duplicate column issue)
        return null;
      }
      return `${leftVar}[${pyStringLiteral(c.leftColumn)}] == ${rightVar}[${pyStringLiteral(c.rightColumn)}]`;
    });

    const sameNameCols = cfg.conditions.filter(c => c.leftColumn === c.rightColumn).map(c => c.leftColumn);
    const differentCols = joinConditions.filter(Boolean) as string[];

    // Broadcast hints
    if (cfg.broadcastHint === 'right' || cfg.broadcastHint === 'left') {
      const target = cfg.broadcastHint === 'right' ? rightVar : leftVar;
      b.line(`# Broadcast hint: ${cfg.broadcastHint} side`);
      b.line(`from pyspark.sql.functions import broadcast`);
      if (cfg.broadcastHint === 'right') {
        b.line(`_${varName}_right = broadcast(${rightVar})`);
      }
    }

    const actualRight = cfg.broadcastHint === 'right' ? `_${varName}_right` : rightVar;

    if (sameNameCols.length > 0 && differentCols.length === 0) {
      // Simple same-column join
      const colList = sameNameCols.map(c => pyStringLiteral(c)).join(', ');
      b.line(`${varName} = ${leftVar}.join(`);
      b.indent(b2 => {
        b2.line(`${actualRight},`);
        b2.line(`on=[${colList}],`);
        b2.line(`how=${pyStringLiteral(cfg.type)}`);
      });
      b.line(')');
    } else {
      // Complex condition
      const condition = differentCols.join(' & ');
      b.line(`${varName} = ${leftVar}.join(`);
      b.indent(b2 => {
        b2.line(`${actualRight},`);
        b2.line(`on=${condition},`);
        b2.line(`how=${pyStringLiteral(cfg.type)}`);
      });
      b.line(')');

      if (cfg.type !== 'left_semi' && cfg.type !== 'left_anti') {
        // Drop duplicate join key columns from right side
        const dropCols = cfg.conditions.filter(c => c.leftColumn !== c.rightColumn).map(c => c.rightColumn);
        if (dropCols.length > 0) {
          const dropArgs = dropCols.map(c => pyStringLiteral(c)).join(', ');
          b.line(`${varName} = ${varName}.drop(${dropArgs})`);
          warnings.push({ nodeId: node.id, code: 'JOIN_DROPPED_RIGHT_KEYS', message: `Dropped duplicate right-side key columns: ${dropCols.join(', ')}`, severity: 'info' as const });
        }
      }
    }

    if (cfg.skewHint) {
      b.blank();
      b.line(`# Skew hint set — consider: spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")`);
      warnings.push({ nodeId: node.id, code: 'SKEW_JOIN', message: 'Skew join hint requires AQE to be enabled.', severity: 'info' as const });
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}

// ─── Union ────────────────────────────────────────────────────────────────────

export class PySparkUnionGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'union';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'union';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { byName?: boolean; all?: boolean };
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (node.inputs.length < 2) {
      warnings.push({ nodeId: node.id, code: 'UNION_TOO_FEW_INPUTS', message: 'Union requires at least 2 inputs.', severity: 'error' as const });
      return { varName, code: `${varName} = None  # ERROR: Union needs >= 2 inputs`, imports: [], warnings };
    }

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Union)`);

    const inputVars = node.inputs.map(id => context.resolvedNodes.get(id)?.varName ?? 'MISSING');
    const method = cfg.byName ? 'unionByName' : 'union';

    // Build chain
    let chain = inputVars[0];
    const methodArgs = cfg.all ? `${inputVars[1]}, allowMissingColumns=True` : inputVars[1];

    if (inputVars.length === 2) {
      b.line(`${varName} = ${chain}.${method}(${methodArgs})`);
    } else {
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line(`${chain}`);
        b2.indent(b3 => {
          inputVars.slice(1).forEach(v => {
            const args = cfg.all ? `${v}, allowMissingColumns=True` : v;
            b3.line(`.${method}(${args})`);
          });
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports: [], warnings };
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export class PySparkAggregateGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'aggregate';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'aggregate';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as AggregateConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Aggregate)`);

    const groupByCols = cfg.groupBy.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');

    const aggExprs = cfg.aggregations.map(agg => {
      const fn = this.buildAggFunction(agg.function, agg.column, agg.distinct ?? false);
      return `${fn}.alias(${pyStringLiteral(agg.alias)})`;
    });

    if (cfg.groupBy.length === 0) {
      // Global aggregate
      b.line(`${varName} = ${inputVar}.agg(`);
    } else {
      b.line(`${varName} = ${inputVar}.groupBy(${groupByCols}).agg(`);
    }

    b.indent(b2 => {
      aggExprs.forEach((expr, i) => {
        b2.line(`${expr}${i < aggExprs.length - 1 ? ',' : ''}`);
      });
    });
    b.line(')');

    if (cfg.having) {
      b.line(`${varName} = ${varName}.filter(${pyStringLiteral(cfg.having)})`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }

  private buildAggFunction(fn: string, col: string, distinct: boolean): string {
    const colExpr = `F.col(${pyStringLiteral(col)})`;
    const distinctFn = distinct ? 'countDistinct' : fn;

    switch (fn) {
      case 'count':       return distinct ? `F.countDistinct(${colExpr})` : `F.count(${colExpr})`;
      case 'sum':         return `F.sum(${colExpr})`;
      case 'avg':         return `F.avg(${colExpr})`;
      case 'min':         return `F.min(${colExpr})`;
      case 'max':         return `F.max(${colExpr})`;
      case 'first':       return `F.first(${colExpr}, ignorenulls=True)`;
      case 'last':        return `F.last(${colExpr}, ignorenulls=True)`;
      case 'collect_list': return `F.collect_list(${colExpr})`;
      case 'collect_set': return `F.collect_set(${colExpr})`;
      case 'countDistinct': return `F.countDistinct(${colExpr})`;
      default:            return `F.${fn}(${colExpr})`;
    }
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

export class PySparkWindowGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'window';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'window';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as WindowConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const imports = [PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.WINDOW];

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Window Functions)`);

    // Build window spec
    const windowSpecVar = `_w_${varName}`;
    const partitionCols = cfg.partitionBy.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
    const orderCols = cfg.orderBy.map(o => {
      const col = `F.col(${pyStringLiteral(o.column)})`;
      return o.direction === 'desc' ? `${col}.desc()` : col;
    }).join(', ');

    let windowSpec = 'Window';
    if (cfg.partitionBy.length > 0) windowSpec += `.partitionBy(${partitionCols})`;
    if (cfg.orderBy.length > 0) windowSpec += `.orderBy(${orderCols})`;

    if (cfg.rowsBetween) {
      const [start, end] = cfg.rowsBetween;
      const s = start === 'unbounded' ? 'Window.unboundedPreceding' : start;
      const e = end === 'unbounded' ? 'Window.unboundedFollowing' : end;
      windowSpec += `.rowsBetween(${s}, ${e})`;
    } else if (cfg.rangeBetween) {
      const [start, end] = cfg.rangeBetween;
      const s = start === 'unbounded' ? 'Window.unboundedPreceding' : start;
      const e = end === 'unbounded' ? 'Window.unboundedFollowing' : end;
      windowSpec += `.rangeBetween(${s}, ${e})`;
    }

    b.line(`${windowSpecVar} = ${windowSpec}`);
    b.blank();

    // Apply window functions via withColumn chains
    b.line(`${varName} = (`);
    b.indent(b2 => {
      b2.line(`${inputVar}`);
      b2.indent(b3 => {
        cfg.windowFunctions.forEach(wf => {
          const fnExpr = this.buildWindowFn(wf);
          b3.line(`.withColumn(${pyStringLiteral(wf.alias)}, ${fnExpr}.over(${windowSpecVar}))`);
        });
      });
    });
    b.line(')');

    return { varName, code: b.build(), imports, warnings: [] };
  }

  private buildWindowFn(wf: WindowConfig['windowFunctions'][0]): string {
    switch (wf.function.toLowerCase()) {
      case 'row_number':  return 'F.row_number()';
      case 'rank':        return 'F.rank()';
      case 'dense_rank':  return 'F.dense_rank()';
      case 'percent_rank': return 'F.percent_rank()';
      case 'cume_dist':   return 'F.cume_dist()';
      case 'lag': {
        const col = `F.col(${pyStringLiteral(wf.column!)})`;
        const offset = wf.offset ?? 1;
        const def = wf.defaultValue ? `, ${pyStringLiteral(wf.defaultValue)}` : '';
        return `F.lag(${col}, ${offset}${def})`;
      }
      case 'lead': {
        const col = `F.col(${pyStringLiteral(wf.column!)})`;
        const offset = wf.offset ?? 1;
        const def = wf.defaultValue ? `, ${pyStringLiteral(wf.defaultValue)}` : '';
        return `F.lead(${col}, ${offset}${def})`;
      }
      case 'sum':   return `F.sum(F.col(${pyStringLiteral(wf.column!)}))`;
      case 'avg':   return `F.avg(F.col(${pyStringLiteral(wf.column!)}))`;
      case 'min':   return `F.min(F.col(${pyStringLiteral(wf.column!)}))`;
      case 'max':   return `F.max(F.col(${pyStringLiteral(wf.column!)}))`;
      case 'count': return `F.count(F.col(${pyStringLiteral(wf.column!)}))`;
      case 'first': return `F.first(F.col(${pyStringLiteral(wf.column!)}), ignorenulls=True)`;
      case 'last':  return `F.last(F.col(${pyStringLiteral(wf.column!)}), ignorenulls=True)`;
      case 'ntile': return `F.ntile(${wf.offset ?? 4})`;
      default:      return `F.${wf.function}(F.col(${pyStringLiteral(wf.column ?? '*')}))`;
    }
  }
}
