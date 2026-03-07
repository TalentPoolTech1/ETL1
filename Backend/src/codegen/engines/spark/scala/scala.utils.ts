import { DataType } from '../../../core/types/pipeline.types';

export const SCALA_INDENT = '  ';

export function toScalaSparkType(dt: DataType): string {
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
    case 'array':     return `ArrayType(${dt.elementType ? toScalaSparkType(dt.elementType) : 'StringType'})`;
    case 'map':       return `MapType(${dt.keyType ? toScalaSparkType(dt.keyType) : 'StringType'}, ${dt.valueType ? toScalaSparkType(dt.valueType) : 'StringType'})`;
    case 'struct': {
      if (dt.fields && dt.fields.length > 0) {
        const fields = dt.fields.map(f => `StructField("${f.name}", ${toScalaSparkType(f.dataType)}, ${f.nullable !== false})`).join(', ');
        return `StructType(Seq(${fields}))`;
      }
      return 'StructType(Seq())';
    }
    default: return 'StringType';
  }
}

/** Node name → camelCase Scala val  e.g. "My Source 1" → "mySource1Df" */
export function toScalaVal(name: string, suffix = 'Df'): string {
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  const camel = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return `${camel}${suffix}`;
}

export function scalaString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ─── Scala CodeBuilder ─────────────────────────────────────────────────────────
export class ScalaCodeBuilder {
  private lines: string[] = [];
  private depth = 0;

  line(code = ''): this {
    if (code.trim() === '') { this.lines.push(''); return this; }
    this.lines.push(SCALA_INDENT.repeat(this.depth) + code);
    return this;
  }

  blank(n = 1): this {
    for (let i = 0; i < n; i++) this.lines.push('');
    return this;
  }

  block(open: string, fn: (b: ScalaCodeBuilder) => void, close = '}'): this {
    this.line(open);
    this.depth++;
    fn(this);
    this.depth--;
    this.line(close);
    return this;
  }

  indent(fn: (b: ScalaCodeBuilder) => void): this {
    this.depth++;
    fn(this);
    this.depth--;
    return this;
  }

  raw(code: string): this {
    const prefix = SCALA_INDENT.repeat(this.depth);
    code.split('\n').forEach(l => this.lines.push(l.trim() === '' ? '' : prefix + l));
    return this;
  }

  comment(text: string): this {
    return this.line(`// ${text}`);
  }

  build(): string { return this.lines.join('\n'); }
}
