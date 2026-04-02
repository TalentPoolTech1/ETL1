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

function normalizeFilterCondition(raw: unknown): string {
  if (typeof raw !== 'string') return 'true';
  const normalized = raw
    .replace(/^\s*where\b/i, '')
    .replace(/;+\s*$/, '')
    .trim();
  return normalized || 'true';
}

function escapeSparkSqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function sparkSqlIdentifier(columnName: string): string {
  return columnName
    .split('.')
    .map(part => `\`${part.replace(/`/g, '``')}\``)
    .join('.');
}

function normalizeTransformList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(value => String(value).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  }
  return [];
}

function isWrappedLiteral(value: string): boolean {
  return (value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'));
}

function unwrapLiteral(value: string): string {
  const inner = value.slice(1, -1);
  if (value.startsWith("'")) {
    return inner.replace(/''/g, "'").replace(/\\'/g, "'");
  }
  return inner.replace(/\\"/g, '"');
}

function isNumericLiteral(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

function isBooleanLiteral(value: string): boolean {
  return /^(true|false)$/i.test(value);
}

function isSimpleColumnReference(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(value);
}

function toSparkSqlOperand(raw: unknown, fallbackSql = 'NULL'): string {
  if (raw === undefined || raw === null) return fallbackSql;
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : fallbackSql;
  if (typeof raw === 'boolean') return raw ? 'TRUE' : 'FALSE';

  const value = String(raw).trim();
  if (!value) return fallbackSql;
  if (/^null$/i.test(value)) return 'NULL';
  if (isBooleanLiteral(value)) return value.toUpperCase();
  if (isNumericLiteral(value)) return value;
  if (isWrappedLiteral(value)) return `'${escapeSparkSqlString(unwrapLiteral(value))}'`;
  if (isSimpleColumnReference(value)) return sparkSqlIdentifier(value);
  return value;
}

function toPySparkValueExpr(raw: unknown, fallbackExpr = 'F.lit(None)'): string {
  if (raw === undefined || raw === null) return fallbackExpr;
  if (typeof raw === 'number') return Number.isFinite(raw) ? `F.lit(${raw})` : fallbackExpr;
  if (typeof raw === 'boolean') return `F.lit(${raw ? 'True' : 'False'})`;

  const value = String(raw).trim();
  if (!value) return fallbackExpr;
  if (/^null$/i.test(value)) return 'F.lit(None)';
  if (isBooleanLiteral(value)) return `F.lit(${/^true$/i.test(value) ? 'True' : 'False'})`;
  if (isNumericLiteral(value)) return `F.lit(${value})`;
  if (isWrappedLiteral(value)) return `F.lit(${pyStringLiteral(unwrapLiteral(value))})`;
  if (isSimpleColumnReference(value)) return `F.col(${pyStringLiteral(value)})`;
  return `F.expr(${pyStringLiteral(value)})`;
}

function toSparkCastType(targetType: unknown): string {
  switch (String(targetType ?? 'TEXT').toUpperCase()) {
    case 'INTEGER':
      return 'int';
    case 'DECIMAL':
      return 'decimal(18,2)';
    case 'DATE':
      return 'date';
    case 'TIMESTAMP':
      return 'timestamp';
    case 'BOOLEAN':
      return 'boolean';
    case 'TEXT':
    default:
      return 'string';
  }
}

function buildCaseWhenSql(params: Record<string, unknown>): string | null {
  const branches = Array.isArray(params['branches']) ? params['branches'] as Array<Record<string, unknown>> : [];
  const cases = branches
    .map(branch => {
      const when = String(branch?.when ?? '').trim();
      const then = String(branch?.then ?? '').trim();
      if (!when || !then) return null;
      return `WHEN ${when} THEN ${toSparkSqlOperand(then)}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (cases.length === 0) return null;
  const elseSql = toSparkSqlOperand(params['else'], 'NULL');
  return `CASE ${cases.join(' ')} ELSE ${elseSql} END`;
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
    const condition = normalizeFilterCondition(cfg.condition);
    const predicateExpr = `F.expr(${pyStringLiteral(condition)})`;
    const filterExpr = cfg.mode === 'EXCLUDE' ? `~(${predicateExpr})` : predicateExpr;

    if (context.options.includeComments) {
      b.line(`# Transform: ${node.name} (Filter)`);
    }
    b.line(`${varName} = ${inputVar}.filter(${filterExpr})`);

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
    const imports: string[] = [PYSPARK_IMPORTS.FUNCTIONS];

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
      if (seq.enabled === false) continue;
      const sourceColumn = typeof seq.sourceColumn === 'string' && seq.sourceColumn.trim()
        ? seq.sourceColumn.trim()
        : seq.columnName;
      const colLit = pyStringLiteral(seq.columnName);
      const sourceColLit = pyStringLiteral(sourceColumn);
      let currentInputColumn = sourceColumn;
      const enabledSteps = seq.steps.filter(s => s.enabled);

      if (context.options.includeComments) {
        b.line(`# Sequence "${seq.name}" → ${sourceColumn} -> ${seq.columnName}`);
      }

      if (enabledSteps.length === 0) {
        b.line(`${varName} = ${varName}.withColumn(${colLit}, F.col(${sourceColLit}))`);
        continue;
      }

      for (const step of enabledSteps) {
        const expr = this.compileStep(step, currentInputColumn);
        if (expr === null) {
          context.warnings.push({
            nodeId: node.id,
            code: 'UNSUPPORTED_STEP_TYPE',
            message: `Step type "${step.type}" in sequence "${seq.name}" (node "${node.name}") has no PySpark mapping — skipped.`,
            severity: 'warn',
          });
          continue;
        }
        const stepSourceColLit = pyStringLiteral(currentInputColumn);

        if (step.onError === 'RETURN_NULL') {
          b.line(`${varName} = ${varName}.withColumn(${colLit}, F.when(F.col(${stepSourceColLit}).isNotNull(), ${expr}).otherwise(F.lit(None)))`);
        } else if (step.onError === 'USE_DEFAULT' && step.defaultValue !== undefined) {
          const defLit = typeof step.defaultValue === 'string'
            ? pyStringLiteral(step.defaultValue as string)
            : String(step.defaultValue);
          b.line(`${varName} = ${varName}.withColumn(${colLit}, F.coalesce(${expr}, F.lit(${defLit})))`);
        } else {
          b.line(`${varName} = ${varName}.withColumn(${colLit}, ${expr})`);
        }

        currentInputColumn = seq.columnName;
      }
    }

    if (cfg.cacheResults) {
      b.line(`${varName}.cache()`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }

  private compileStep(step: MultiTransformIRStep, columnName: string): string | null {
    const col = `F.col(${pyStringLiteral(columnName)})`;
    const columnSql = sparkSqlIdentifier(columnName);
    const p = step.params as Record<string, unknown>;

    switch (step.type) {
      // Convert
      case 'to_number':
        return `F.regexp_replace(${col}.cast("string"), ${pyStringLiteral('[^0-9.\\-]')}, ${pyStringLiteral('')}).cast("decimal(18,2)")`;
      case 'to_date':
        return `F.to_date(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd'))})`;
      case 'cast':
        return `${col}.cast(${pyStringLiteral(toSparkCastType(p['targetType']))})`;

      // String
      case 'trim':
        return `F.trim(${col})`;
      case 'ltrim':
        return `F.ltrim(${col})`;
      case 'rtrim':
        return `F.rtrim(${col})`;
      case 'upper':
        return `F.upper(${col})`;
      case 'lower':
        return `F.lower(${col})`;
      case 'title_case':
        return `F.initcap(${col})`;
      case 'length':
        return `F.length(${col})`;
      case 'concat': {
        const operands = normalizeTransformList(p['values']).map(value => toPySparkValueExpr(value, 'F.lit("")'));
        return `F.concat(${[col, ...operands].join(', ')})`;
      }
      case 'substring':
        return `F.substring(${col}, ${p['startPos'] ?? 1}, ${p['length'] ?? 1})`;
      case 'pad_left':
        return `F.lpad(${col}, ${p['length'] ?? 10}, ${pyStringLiteral(String(p['padChar'] ?? '0'))})`;
      case 'pad_right':
        return `F.rpad(${col}, ${p['length'] ?? 10}, ${pyStringLiteral(String(p['padChar'] ?? ' '))})`;
      case 'replace':
        return `F.expr(${pyStringLiteral(`REPLACE(${columnSql}, ${toSparkSqlOperand(p['search'], "''")}, ${toSparkSqlOperand(p['replace'], "''")})`)})`;

      // Date / time
      case 'trim_timestamp': {
        const unit = String(p['unit'] ?? 'DAY').toUpperCase();
        if (unit === 'MONTH') return `F.expr(${pyStringLiteral(`TRUNC(${columnSql}, 'MONTH')`)})`;
        if (unit === 'YEAR') return `F.expr(${pyStringLiteral(`TRUNC(${columnSql}, 'YEAR')`)})`;
        return `F.to_date(${col})`;
      }
      case 'date_add': {
        const amount = Number(p['amount'] ?? 0);
        const unit = String(p['unit'] ?? 'DAY').toUpperCase();
        if (unit === 'MONTH') return `F.add_months(${col}, ${amount})`;
        if (unit === 'YEAR') return `F.add_months(${col}, ${amount * 12})`;
        return `F.date_add(${col}, ${amount})`;
      }
      case 'to_timestamp':
        return `F.to_timestamp(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd HH:mm:ss'))})`;
      case 'date_format':
        return `F.date_format(${col}, ${pyStringLiteral(String(p['format'] ?? 'yyyy-MM-dd'))})`;
      case 'extract_date_part': {
        const part = String(p['part'] ?? 'MONTH').toUpperCase();
        if (part === 'YEAR') return `F.year(${col})`;
        if (part === 'MONTH') return `F.month(${col})`;
        if (part === 'DAY') return `F.dayofmonth(${col})`;
        if (part === 'HOUR') return `F.hour(${col})`;
        if (part === 'MINUTE') return `F.minute(${col})`;
        if (part === 'SECOND') return `F.second(${col})`;
        return `F.month(${col})`;
      }
      case 'date_diff': {
        const endOperand = toSparkSqlOperand(p['endDate'], 'CURRENT_DATE');
        const unit = String(p['unit'] ?? 'DAY').toUpperCase();
        if (unit === 'MONTH') return `F.expr(${pyStringLiteral(`FLOOR(MONTHS_BETWEEN(${endOperand}, ${columnSql}))`)})`;
        if (unit === 'YEAR') return `F.expr(${pyStringLiteral(`FLOOR(MONTHS_BETWEEN(${endOperand}, ${columnSql}) / 12)`)})`;
        return `F.expr(${pyStringLiteral(`DATEDIFF(${endOperand}, ${columnSql})`)})`;
      }

      // Regex
      case 'regex_extract':
      case 'extract_regex': {
        const pattern = String(p['pattern'] ?? '');
        const effectivePattern = p['caseInsensitive'] ? `(?i)${pattern}` : pattern;
        return `F.regexp_extract(${col}, ${pyStringLiteral(effectivePattern)}, ${p['group'] ?? p['groupIndex'] ?? 1})`;
      }
      case 'replace_regex':
        return `F.regexp_replace(${col}, ${pyStringLiteral(String(p['pattern'] ?? ''))}, ${pyStringLiteral(String(p['replacement'] ?? ''))})`;
      case 'matches_regex': {
        const pattern = String(p['pattern'] ?? '');
        const effectivePattern = p['caseInsensitive'] ? `(?i)${pattern}` : pattern;
        return `${col}.rlike(${pyStringLiteral(effectivePattern)}).cast("boolean")`;
      }

      // Conditional / null handling
      case 'if_null':
      case 'coalesce': {
        const fallbacks = normalizeTransformList(p['fallbacks']).map(value => toPySparkValueExpr(value));
        const legacyDefault = p['defaultValue'] !== undefined ? [toPySparkValueExpr(p['defaultValue'])] : [];
        return `F.coalesce(${[col, ...fallbacks, ...legacyDefault].join(', ')})`;
      }
      case 'null_if':
      case 'nullif':
        return `F.when(${col} == ${toPySparkValueExpr(p['value'])}, F.lit(None)).otherwise(${col})`;
      case 'case_when': {
        const caseSql = buildCaseWhenSql(p);
        return caseSql ? `F.expr(${pyStringLiteral(caseSql)})` : null;
      }

      // Numeric
      case 'round': {
        const places = Number(p['places'] ?? 2);
        const mode = String(p['mode'] ?? 'HALF_UP').toUpperCase();
        if (mode === 'UP') {
          return `F.expr(${pyStringLiteral(`CASE WHEN ${columnSql} >= 0 THEN CEIL(${columnSql} * POWER(10, ${places})) / POWER(10, ${places}) ELSE FLOOR(${columnSql} * POWER(10, ${places})) / POWER(10, ${places}) END`)})`;
        }
        if (mode === 'DOWN') {
          return `F.expr(${pyStringLiteral(`CASE WHEN ${columnSql} >= 0 THEN FLOOR(${columnSql} * POWER(10, ${places})) / POWER(10, ${places}) ELSE CEIL(${columnSql} * POWER(10, ${places})) / POWER(10, ${places}) END`)})`;
        }
        return `F.round(${col}, ${places})`;
      }
      case 'abs':
        return `F.abs(${col})`;
      case 'ceil':
        return `F.ceil(${col})`;
      case 'floor':
        return `F.floor(${col})`;
      case 'mod':
        return `F.expr(${pyStringLiteral(`MOD(${columnSql}, ${toSparkSqlOperand(p['divisor'], '2')})`)})`;
      case 'power':
        return `F.pow(${col}, ${p['exponent'] ?? 2})`;

      // Custom SQL expression — user-supplied
      case 'custom_sql':
        return p['expression'] ? `F.expr(${pyStringLiteral(String(p['expression']))})` : null;

      default:
        return null;
    }
  }
}
