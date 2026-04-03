import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, FileSourceConfig, Schema } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral, toPySparkType, pyBoolLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── PySpark File Source Generator ────────────────────────────────────────────

export class PySparkFileSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'file';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'file';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FileSourceConfig;
    const varName = toVarName(node.name);
    const imports: string[] = [PYSPARK_IMPORTS.FUNCTIONS];
    const warnings: any[] = [];
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (${cfg.format.toUpperCase()} File)`);
      if (node.description) b.line(`# ${node.description}`);
    }

    // Delta and Iceberg need special handling
    if (cfg.format === 'delta') {
      return this.generateDeltaRead(node, cfg, varName, context, imports, warnings);
    }

    if (cfg.format === 'iceberg') {
      return this.generateIcebergRead(node, cfg, varName, context, imports, warnings);
    }

    b.line(`${varName} = (`);
    b.indent(b2 => {
      b2.line('spark.read');
      b2.indent(b3 => {
        b3.line(`.format(${pyStringLiteral(cfg.format)})`);

        // Schema
        if (cfg.schema && !cfg.inferSchema) {
          const schemaVar = `_schema_${varName}`;
          imports.push(PYSPARK_IMPORTS.TYPES);
          // Schema will be pre-defined; reference the var
          b3.line(`.schema(${schemaVar})`);
        } else if (cfg.inferSchema) {
          b3.line(`.option("inferSchema", "true")`);
        }

        // Format-specific options
        this.addFormatOptions(cfg, b3);

        // Common options
        if (cfg.pathGlobFilter) b3.line(`.option("pathGlobFilter", ${pyStringLiteral(cfg.pathGlobFilter)})`);
        if (cfg.modifiedAfter) b3.line(`.option("modifiedAfter", ${pyStringLiteral(cfg.modifiedAfter)})`);
        if (cfg.modifiedBefore) b3.line(`.option("modifiedBefore", ${pyStringLiteral(cfg.modifiedBefore)})`);
        if (cfg.recursiveFileLookup) b3.line(`.option("recursiveFileLookup", "true")`);
        if (cfg.mergeSchema) b3.line(`.option("mergeSchema", "true")`);

        // Custom options
        if (cfg.customOptions) {
          Object.entries(cfg.customOptions).forEach(([k, v]) => {
            b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`);
          });
        }

        b3.line(`.load(${pyStringLiteral(cfg.path)})`);
      });
    });
    b.line(')');

    // Prepend schema definition if needed
    let schemaDef = '';
    if (cfg.schema && !cfg.inferSchema) {
      schemaDef = this.buildSchemaDefinition(`_schema_${varName}`, cfg.schema);
    }

    const postReadCoercions = cfg.schema && !cfg.inferSchema
      ? this.buildPostReadCoercions(varName, cfg.schema)
      : '';

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(${pyStringLiteral(`Configured file source '${node.name}' from ${cfg.path}`)})`);
    }

    const code = [schemaDef, b.build(), postReadCoercions].filter(Boolean).join('\n');
    return { varName, code, imports, warnings };
  }

  private addFormatOptions(cfg: FileSourceConfig, b: CodeBuilder): void {
    switch (cfg.format) {
      case 'csv':
        if (cfg.header !== false) b.line(`.option("header", "true")`);
        if (cfg.delimiter) b.line(`.option("sep", ${pyStringLiteral(cfg.delimiter)})`);
        b.line(`.option("encoding", "UTF-8")`);
        b.line(`.option("mode", "FAILFAST")`);
        break;
      case 'json':
        if (cfg.multiLine) b.line(`.option("multiLine", "true")`);
        break;
      case 'parquet':
        // parquet is usually option-less
        break;
      case 'orc':
        break;
      case 'avro':
        break;
    }
  }

  private generateDeltaRead(
    node: PipelineNode,
    cfg: FileSourceConfig,
    varName: string,
    context: GenerationContext,
    imports: string[],
    warnings: any[]
  ): GeneratedNodeCode {
    const b = new CodeBuilder();
    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Delta Lake)`);
    }
    b.line(`${varName} = spark.read.format("delta").load(${pyStringLiteral(cfg.path)})`);
    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(${pyStringLiteral(`Configured Delta source '${node.name}' from ${cfg.path}`)})`);
    }
    return { varName, code: b.build(), imports, warnings };
  }

  private generateIcebergRead(
    node: PipelineNode,
    cfg: FileSourceConfig,
    varName: string,
    context: GenerationContext,
    imports: string[],
    warnings: any[]
  ): GeneratedNodeCode {
    const b = new CodeBuilder();
    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Iceberg)`);
    }
    b.line(`${varName} = spark.table(${pyStringLiteral(cfg.path)})`);
    return { varName, code: b.build(), imports, warnings };
  }

  private buildSchemaDefinition(varName: string, schema: Schema): string {
    const b = new CodeBuilder();
    b.line(`${varName} = T.StructType([`);
    b.indent(b2 => {
      schema.fields.forEach((f, i) => {
        const comma = i < schema.fields.length - 1 ? ',' : '';
        b2.line(`T.StructField(${pyStringLiteral(f.name)}, ${this.toReadPySparkType(f)}, ${pyBoolLiteral(f.nullable !== false)})${comma}`);
      });
    });
    b.line('])');
    return b.build();
  }

  private toReadPySparkType(field: Schema['fields'][number]): string {
    const parseFormat = field.tags?.['parseFormat'];
    if (parseFormat && (field.dataType.name === 'date' || field.dataType.name === 'timestamp')) {
      return 'T.StringType()';
    }
    return toPySparkType(field.dataType);
  }

  private buildPostReadCoercions(varName: string, schema: Schema): string {
    const b = new CodeBuilder();
    let hasCoercions = false;

    schema.fields.forEach(field => {
      const parseFormat = field.tags?.['parseFormat']?.trim();
      if (!parseFormat) return;

      if (field.dataType.name === 'date') {
        hasCoercions = true;
        b.line(`${varName} = ${varName}.withColumn(${pyStringLiteral(field.name)}, F.to_date(F.col(${pyStringLiteral(field.name)}), ${pyStringLiteral(parseFormat)}))`);
      } else if (field.dataType.name === 'timestamp') {
        hasCoercions = true;
        b.line(`${varName} = ${varName}.withColumn(${pyStringLiteral(field.name)}, F.to_timestamp(F.col(${pyStringLiteral(field.name)}), ${pyStringLiteral(parseFormat)}))`);
      }
    });

    return hasCoercions ? b.build() : '';
  }
}
