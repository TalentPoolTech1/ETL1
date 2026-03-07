import { VAR_NAME_SANITIZE_RE, RESERVED_PYTHON_KEYWORDS, INDENT } from '../core/constants/codegen.constants';
import { DataType, PipelineNode } from '../core/types/pipeline.types';

// ─── Naming Utilities ──────────────────────────────────────────────────────────

/**
 * Convert a node name to a valid Python/Scala variable name.
 * e.g. "My Source 1" → "my_source_1_df"
 */
export function toVarName(name: string, suffix = 'df'): string {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(VAR_NAME_SANITIZE_RE, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  const safe = RESERVED_PYTHON_KEYWORDS.has(base) ? `_${base}` : base;
  return suffix ? `${safe}_${suffix}` : safe;
}

/**
 * Convert node name to valid Scala val name (camelCase).
 */
export function toScalaValName(name: string, suffix = 'Df'): string {
  const parts = name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
  const camel = parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  return `${camel}${suffix}`;
}

/**
 * Generate unique var name by appending node ID fragment to avoid collisions.
 */
export function uniqueVarName(node: PipelineNode, suffix = 'df'): string {
  const base = toVarName(node.name, '');
  const idSuffix = node.id.replace(VAR_NAME_SANITIZE_RE, '').slice(-6);
  return `${base}_${idSuffix}_${suffix}`;
}

// ─── DataType Mapping ──────────────────────────────────────────────────────────

/**
 * Convert DataType to PySpark type string.
 */
export function toPySparkType(dt: DataType): string {
  switch (dt.name) {
    case 'string':    return 'T.StringType()';
    case 'integer':   return 'T.IntegerType()';
    case 'long':      return 'T.LongType()';
    case 'double':    return 'T.DoubleType()';
    case 'float':     return 'T.FloatType()';
    case 'boolean':   return 'T.BooleanType()';
    case 'date':      return 'T.DateType()';
    case 'timestamp': return 'T.TimestampType()';
    case 'binary':    return 'T.BinaryType()';
    case 'decimal':
      return `T.DecimalType(${dt.precision ?? 10}, ${dt.scale ?? 2})`;
    case 'array':
      return `T.ArrayType(${dt.elementType ? toPySparkType(dt.elementType) : 'T.StringType()'}, ${dt.nullable !== false})`;
    case 'map':
      return `T.MapType(${dt.keyType ? toPySparkType(dt.keyType) : 'T.StringType()'}, ${dt.valueType ? toPySparkType(dt.valueType) : 'T.StringType()'}, ${dt.nullable !== false})`;
    case 'struct':
      if (dt.fields && dt.fields.length > 0) {
        const fieldDefs = dt.fields
          .map(f => `T.StructField("${f.name}", ${toPySparkType(f.dataType)}, ${f.nullable !== false})`)
          .join(', ');
        return `T.StructType([${fieldDefs}])`;
      }
      return 'T.StructType([])';
    default:
      return 'T.StringType()';
  }
}

/**
 * Convert DataType to Scala Spark type string.
 */
export function toScalaType(dt: DataType): string {
  switch (dt.name) {
    case 'string':    return 'StringType';
    case 'integer':   return 'IntegerType';
    case 'long':      return 'LongType';
    case 'double':    return 'DoubleType';
    case 'float':     return 'FloatType';
    case 'boolean':   return 'BooleanType';
    case 'date':      return 'DateType';
    case 'timestamp': return 'TimestampType';
    case 'binary':    return 'BinaryType';
    case 'decimal':   return `DecimalType(${dt.precision ?? 10}, ${dt.scale ?? 2})`;
    case 'array':     return `ArrayType(${dt.elementType ? toScalaType(dt.elementType) : 'StringType'})`;
    case 'map':       return `MapType(${dt.keyType ? toScalaType(dt.keyType) : 'StringType'}, ${dt.valueType ? toScalaType(dt.valueType) : 'StringType'})`;
    case 'struct':    return 'StructType(Seq())';
    default:          return 'StringType';
  }
}

// ─── String Utilities ──────────────────────────────────────────────────────────

export function indent(code: string, levels = 1): string {
  const prefix = INDENT.repeat(levels);
  return code.split('\n').map(line => (line.trim() ? prefix + line : '')).join('\n');
}

export function pyStringLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function pyDictLiteral(obj: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? pyStringLiteral(v) : v;
      return `"${k}": ${val}`;
    })
    .join(', ');
  return `{${entries}}`;
}

export function commentBlock(lines: string[], style: 'python' | 'scala' = 'python'): string {
  if (style === 'scala') {
    return `/**\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
  }
  return lines.map(l => `# ${l}`).join('\n');
}

export function sectionHeader(title: string, style: 'python' | 'scala' = 'python'): string {
  const bar = '─'.repeat(70);
  if (style === 'scala') {
    return `// ─── ${title} ${'─'.repeat(Math.max(0, 68 - title.length))}`;
  }
  return `# ─── ${title} ${'─'.repeat(Math.max(0, 68 - title.length))}`;
}

// ─── Code Builder ──────────────────────────────────────────────────────────────
/**
 * Fluent builder for assembling code blocks line by line.
 */
export class CodeBuilder {
  private lines: string[] = [];
  private indentLevel = 0;

  line(code = ''): this {
    if (code.trim() === '') {
      this.lines.push('');
    } else {
      this.lines.push(INDENT.repeat(this.indentLevel) + code);
    }
    return this;
  }

  blank(n = 1): this {
    for (let i = 0; i < n; i++) this.lines.push('');
    return this;
  }

  section(title: string): this {
    return this.blank().line(sectionHeader(title)).blank();
  }

  indent(fn: (b: CodeBuilder) => void): this {
    this.indentLevel++;
    fn(this);
    this.indentLevel--;
    return this;
  }

  raw(code: string): this {
    const indentPrefix = INDENT.repeat(this.indentLevel);
    code.split('\n').forEach(l => {
      this.lines.push(l.trim() === '' ? '' : indentPrefix + l);
    });
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }
}
