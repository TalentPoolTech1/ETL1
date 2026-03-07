import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, FilterConfig, SelectConfig, RenameConfig, CastConfig,
  DropConfig, DeriveConfig, SortConfig, DedupConfig, FillnaConfig, DropnaConfig, LimitConfig,
  MultiTransformNodeConfig, MultiTransformIRStep,
} from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral, toPySparkType } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInputVar(node: PipelineNode, context: GenerationContext): string {
  const inputId = node.inputs[0];
  return context.resolvedNodes.get(inputId)?.varName ?? 'MISSING_INPUT';
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export class PySparkFilterGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'filter';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'filter';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FilterConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Transform: ${node.name} (Filter)`);
    }
    b.line(`${varName} = ${inputVar}.filter(${pyStringLiteral(cfg.condition)})`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Select ───────────────────────────────────────────────────────────────────

export class PySparkSelectGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'select';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'select';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SelectConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Select)`);

    // Build select list: plain columns + expression aliases
    const colList: string[] = cfg.columns.map(c => `F.col(${pyStringLiteral(c)})`);

    if (cfg.expressions) {
      Object.entries(cfg.expressions).forEach(([alias, expr]) => {
        colList.push(`F.expr(${pyStringLiteral(expr)}).alias(${pyStringLiteral(alias)})`);
      });
    }

    if (colList.length === 1) {
      b.line(`${varName} = ${inputVar}.select(${colList[0]})`);
    } else {
      b.line(`${varName} = ${inputVar}.select(`);
      b.indent(b2 => {
        colList.forEach((c, i) => {
          b2.line(`${c}${i < colList.length - 1 ? ',' : ''}`);
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export class PySparkRenameGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'rename';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'rename';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as RenameConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Rename Columns)`);

    const entries = Object.entries(cfg.mappings);

    if (entries.length === 0) {
      b.line(`${varName} = ${inputVar}  # No renames specified`);
    } else if (entries.length === 1) {
      const [old, newName] = entries[0];
      b.line(`${varName} = ${inputVar}.withColumnRenamed(${pyStringLiteral(old)}, ${pyStringLiteral(newName)})`);
    } else {
      // Chain withColumnRenamed calls
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line(`${inputVar}`);
        b2.indent(b3 => {
          entries.forEach(([old, newName]) => {
            b3.line(`.withColumnRenamed(${pyStringLiteral(old)}, ${pyStringLiteral(newName)})`);
          });
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Cast ─────────────────────────────────────────────────────────────────────

export class PySparkCastGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'cast';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'cast';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as CastConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const imports = [PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.TYPES];

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Cast Types)`);

    if (cfg.casts.length === 0) {
      b.line(`${varName} = ${inputVar}  # No casts specified`);
    } else {
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line(`${inputVar}`);
        b2.indent(b3 => {
          cfg.casts.forEach(cast => {
            const sparkType = toPySparkType(cast.targetType);
            b3.line(`.withColumn(${pyStringLiteral(cast.column)}, F.col(${pyStringLiteral(cast.column)}).cast(${sparkType}))`);
          });
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports, warnings: [] };
  }
}

// ─── Drop Columns ─────────────────────────────────────────────────────────────

export class PySparkDropGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'drop';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'drop';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DropConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Drop Columns)`);

    const colArgs = cfg.columns.map(c => pyStringLiteral(c)).join(', ');
    b.line(`${varName} = ${inputVar}.drop(${colArgs})`);

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Derive (withColumn) ──────────────────────────────────────────────────────

export class PySparkDeriveGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'derive';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'derive';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeriveConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const imports = [PYSPARK_IMPORTS.FUNCTIONS];

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Derive Columns)`);

    if (cfg.columns.length === 0) {
      b.line(`${varName} = ${inputVar}  # No derived columns`);
    } else if (cfg.columns.length === 1) {
      const col = cfg.columns[0];
      b.line(`${varName} = ${inputVar}.withColumn(${pyStringLiteral(col.name)}, F.expr(${pyStringLiteral(col.expression)}))`);
    } else {
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line(`${inputVar}`);
        b2.indent(b3 => {
          cfg.columns.forEach(col => {
            if (col.dataType) {
              imports.push(PYSPARK_IMPORTS.TYPES);
              b3.line(`.withColumn(${pyStringLiteral(col.name)}, F.expr(${pyStringLiteral(col.expression)}).cast(${toPySparkType(col.dataType)}))`);
            } else {
              b3.line(`.withColumn(${pyStringLiteral(col.name)}, F.expr(${pyStringLiteral(col.expression)}))`);
            }
          });
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports: [...new Set(imports)], warnings: [] };
  }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

export class PySparkSortGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'sort';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'sort';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SortConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Sort)`);

    const sortExprs = cfg.orderBy.map(o => {
      const col = `F.col(${pyStringLiteral(o.column)})`;
      const dir = o.direction === 'desc' ? '.desc()' : '.asc()';
      const nulls = o.nullsFirst ? '.asc_nulls_first()' : '';
      return `${col}${nulls || dir}`;
    });

    b.line(`${varName} = ${inputVar}.orderBy(${sortExprs.join(', ')})`);

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

export class PySparkDedupGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'dedup';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'dedup';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DedupConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Deduplicate)`);

    if (cfg.columns && cfg.columns.length > 0) {
      const colArgs = cfg.columns.map(c => pyStringLiteral(c)).join(', ');
      b.line(`${varName} = ${inputVar}.dropDuplicates([${colArgs}])`);
    } else {
      b.line(`${varName} = ${inputVar}.dropDuplicates()`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── FillNA ───────────────────────────────────────────────────────────────────

export class PySparkFillnaGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'fillna';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'fillna';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FillnaConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Fill NA)`);

    if (cfg.columnValues) {
      // Per-column fill values
      const pyDict = Object.entries(cfg.columnValues)
        .map(([k, v]) => `${pyStringLiteral(k)}: ${typeof v === 'string' ? pyStringLiteral(v) : v}`)
        .join(', ');
      b.line(`${varName} = ${inputVar}.fillna({${pyDict}})`);
    } else if (cfg.value !== undefined) {
      const val = typeof cfg.value === 'string' ? pyStringLiteral(cfg.value) : cfg.value;
      b.line(`${varName} = ${inputVar}.fillna(${val})`);
    } else {
      b.line(`${varName} = ${inputVar}  # fillna: no value specified`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── DropNA ───────────────────────────────────────────────────────────────────

export class PySparkDropnaGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'dropna';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'dropna';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DropnaConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Drop NA)`);

    const how = cfg.how ?? 'any';
    if (cfg.columns && cfg.columns.length > 0) {
      const colArgs = cfg.columns.map(c => pyStringLiteral(c)).join(', ');
      b.line(`${varName} = ${inputVar}.dropna(how=${pyStringLiteral(how)}, subset=[${colArgs}])`);
    } else {
      b.line(`${varName} = ${inputVar}.dropna(how=${pyStringLiteral(how)})`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Limit ────────────────────────────────────────────────────────────────────

export class PySparkLimitGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'limit';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'limit';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { n: number };
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Limit)`);
    b.line(`${varName} = ${inputVar}.limit(${cfg.n})`);

    context.warnings.push({
      nodeId: node.id,
      code: 'LIMIT_IN_PRODUCTION',
      message: `Limit(${cfg.n}) on node "${node.name}" — verify this is intentional in production.`,
      severity: 'info',
    });

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Multi-Transform Sequence ─────────────────────────────────────────────────
// Handles nodes whose config contains a sequence of column-level transform steps
// produced by the Frontend MultiTransformEditor.

export class PySparkMultiTransformGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'multi_transform_sequence';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'multi_transform_sequence';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as MultiTransformNodeConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Multi-Transform: ${node.name}`);
      if (cfg.executionStrategy) {
        b.line(`# Execution strategy: ${cfg.executionStrategy}`);
      }
    }

    b.line(`${varName} = ${inputVar}`);

    for (const seq of (cfg.transformSequences ?? [])) {
      const enabledSteps = seq.steps.filter(s => s.enabled);
      if (enabledSteps.length === 0) continue;

      if (context.options.includeComments) {
        b.line(`# Sequence "${seq.name}" → column: ${seq.columnName}`);
      }

      for (const step of enabledSteps) {
        const expr = this.compileStep(step, seq.columnName);
        if (expr === null) {
          context.warnings.push({
            nodeId: node.id,
            code: 'UNSUPPORTED_STEP_TYPE',
            message: `Step type "${step.type}" in sequence "${seq.name}" (node "${node.name}") has no PySpark mapping — skipped.`,
            severity: 'warn',
          });
          continue;
        }

        const colLit = pyStringLiteral(seq.columnName);

        if (step.onError === 'RETURN_NULL') {
          b.line(`${varName} = ${varName}.withColumn(${colLit}, F.when(F.col(${colLit}).isNotNull(), ${expr}).otherwise(F.lit(None)))`);
        } else if (step.onError === 'USE_DEFAULT' && step.defaultValue !== undefined) {
          const defLit = typeof step.defaultValue === 'string'
            ? pyStringLiteral(step.defaultValue as string)
            : String(step.defaultValue);
          b.line(`${varName} = ${varName}.withColumn(${colLit}, F.coalesce(${expr}, F.lit(${defLit})))`);
        } else {
          b.line(`${varName} = ${varName}.withColumn(${colLit}, ${expr})`);
        }
      }
    }

    if (cfg.cacheResults) {
      b.line(`${varName}.cache()`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }

  private compileStep(step: MultiTransformIRStep, columnName: string): string | null {
    const col = `F.col(${pyStringLiteral(columnName)})`;
    const p = step.params as Record<string, unknown>;

    switch (step.type) {
      // String
      case 'trim':           return `F.trim(${col})`;
      case 'ltrim':          return `F.ltrim(${col})`;
      case 'rtrim':          return `F.rtrim(${col})`;
      case 'upper':          return `F.upper(${col})`;
      case 'lower':          return `F.lower(${col})`;
      case 'title_case':     return `F.initcap(${col})`;
      case 'length':         return `F.length(${col})`;
      case 'concat':         return `F.concat(${col}, F.lit(${pyStringLiteral(String(p['suffix'] ?? ''))}))`;
      case 'substring':      return `F.substring(${col}, ${p['start'] ?? 1}, ${p['length'] ?? 255})`;
      case 'pad_left':       return `F.lpad(${col}, ${p['length'] ?? 10}, ${pyStringLiteral(String(p['pad'] ?? ' '))})`;
      case 'pad_right':      return `F.rpad(${col}, ${p['length'] ?? 10}, ${pyStringLiteral(String(p['pad'] ?? ' '))})`;

      // Numeric
      case 'to_number':      return `${col}.cast("decimal(${p['precision'] ?? 18},${p['scale'] ?? 2})")`;
      case 'round':          return `F.round(${col}, ${p['decimals'] ?? 2})`;
      case 'abs':            return `F.abs(${col})`;
      case 'ceil':           return `F.ceil(${col})`;
      case 'floor':          return `F.floor(${col})`;

      // Date / time
      case 'to_date':        return `F.to_date(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd'))})`;
      case 'to_timestamp':   return `F.to_timestamp(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd HH:mm:ss'))})`;
      case 'date_format':    return `F.date_format(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd'))})`;
      case 'date_add':       return `F.date_add(${col}, ${p['days'] ?? 0})`;
      case 'date_diff':      return `F.datediff(F.current_date(), ${col})`;

      // Regex
      case 'extract_regex':  return `F.regexp_extract(${col}, ${pyStringLiteral(String(p['pattern'] ?? ''))}, ${p['group'] ?? 0})`;
      case 'replace_regex':  return `F.regexp_replace(${col}, ${pyStringLiteral(String(p['pattern'] ?? ''))}, ${pyStringLiteral(String(p['replacement'] ?? ''))})`;
      case 'matches_regex':  return `F.col(${pyStringLiteral(columnName)}).rlike(${pyStringLiteral(String(p['pattern'] ?? ''))}).cast("boolean")`;

      // Conditional / null handling
      case 'if_null':
      case 'coalesce':       return `F.coalesce(${col}, F.lit(${pyStringLiteral(String(p['defaultValue'] ?? ''))}))`;
      // F.nullif() is SQL-only; use F.when() to replicate NULLIF(col, val) semantics
      case 'nullif':         return `F.when(${col} != F.lit(${pyStringLiteral(String(p['value'] ?? ''))}), ${col})`;

      // Custom SQL expression — user-supplied
      case 'custom_sql':
        return p['expression'] ? `F.expr(${pyStringLiteral(String(p['expression']))})` : null;

      default:
        return null;
    }
  }
}
