import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, JdbcSinkConfig, FileSinkConfig, KafkaSinkConfig,
  HiveSinkConfig, DeltaSinkConfig, IcebergSinkConfig
} from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

type SinkColumnMapping = { src: string; tgt: string };

const AUDIT_MAPPING_PREFIX = '__audit__:';

function getInputVar(node: PipelineNode, context: GenerationContext): string {
  const inputId = node.inputs[0];
  return context.resolvedNodes.get(inputId)?.varName ?? 'MISSING_INPUT';
}

function parseColumnMappings(raw: unknown): SinkColumnMapping[] {
  const parsed = (() => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
      const decoded = JSON.parse(raw);
      return Array.isArray(decoded) ? decoded : [];
    } catch {
      return [];
    }
  })();

  return parsed
    .map((entry): SinkColumnMapping | null => {
      if (!entry || typeof entry !== 'object') return null;
      const src = typeof (entry as { src?: unknown }).src === 'string' ? (entry as { src: string }).src.trim() : '';
      const tgt = typeof (entry as { tgt?: unknown }).tgt === 'string' ? (entry as { tgt: string }).tgt.trim() : '';
      if (!src || !tgt) return null;
      return { src, tgt };
    })
    .filter((entry): entry is SinkColumnMapping => entry !== null);
}

function getAuditMappingExpression(source: string, useScaffoldArgs: boolean): string | null {
  switch (source) {
    case `${AUDIT_MAPPING_PREFIX}current_timestamp`:
      return 'F.current_timestamp()';
    case `${AUDIT_MAPPING_PREFIX}current_date`:
      return 'F.current_date()';
    case `${AUDIT_MAPPING_PREFIX}current_time`:
      return 'F.date_format(F.current_timestamp(), "HH:mm:ss")';
    case `${AUDIT_MAPPING_PREFIX}job_name`:
      return 'F.lit(spark.sparkContext.appName)';
    case `${AUDIT_MAPPING_PREFIX}run_id`:
      return useScaffoldArgs ? 'F.lit(args.run_id)' : 'F.lit("")';
    case `${AUDIT_MAPPING_PREFIX}user_name`:
      return useScaffoldArgs ? 'F.lit(args.run_user)' : 'F.lit("system")';
    default:
      return null;
  }
}

function prepareSinkInput(
  node: PipelineNode,
  inputVar: string,
  varName: string,
  context: GenerationContext,
  builder: CodeBuilder,
): { inputVar: string; needsFunctions: boolean } {
  const cfg = node.config as {
    columnMappings?: unknown;
    auditColumnsEnabled?: boolean | string;
    loadTsColumn?: string;
    runIdColumn?: string;
    runUserColumn?: string;
    useScaffoldArgs?: boolean | string;
  };

  let currentInputVar = inputVar;
  let needsFunctions = false;
  const useScaffoldArgs = cfg.useScaffoldArgs !== false && cfg.useScaffoldArgs !== 'false';
  const columnMappings = parseColumnMappings(cfg.columnMappings);

  if (columnMappings.length > 0) {
    const mappedVarName = `${varName}_mapped`;

    if (context.options.includeComments) {
      builder.line(`# Apply explicit target column mapping for ${node.name}`);
    }

    builder.line(`${mappedVarName} = (`);
    builder.indent(b2 => {
      b2.line(`${currentInputVar}`);
      b2.indent(b3 => {
        b3.line(`.select(`);
        b3.indent(b4 => {
          columnMappings.forEach(({ src, tgt }, index) => {
            const auditExpr = getAuditMappingExpression(src, useScaffoldArgs);
            const expression = auditExpr
              ? `${auditExpr}.alias(${pyStringLiteral(tgt)})`
              : `F.col(${pyStringLiteral(src)}).alias(${pyStringLiteral(tgt)})`;
            const suffix = index === columnMappings.length - 1 ? '' : ',';
            b4.line(`${expression}${suffix}`);
          });
        });
        b3.line(`)`);
      });
    });
    builder.line(`)`);
    builder.blank();

    currentInputVar = mappedVarName;
    needsFunctions = true;
  }

  const auditEnabled = cfg.auditColumnsEnabled === true || cfg.auditColumnsEnabled === 'true';
  if (!auditEnabled) return { inputVar: currentInputVar, needsFunctions };

  const loadTsColumn = typeof cfg.loadTsColumn === 'string' ? cfg.loadTsColumn.trim() : '_load_ts';
  const runIdColumn = typeof cfg.runIdColumn === 'string' ? cfg.runIdColumn.trim() : '_run_id';
  const runUserColumn = typeof cfg.runUserColumn === 'string' ? cfg.runUserColumn.trim() : '_run_user';

  const auditAssignments: Array<{ column: string; expression: string }> = [];
  if (loadTsColumn) auditAssignments.push({ column: loadTsColumn, expression: 'F.current_timestamp()' });
  if (runIdColumn) auditAssignments.push({ column: runIdColumn, expression: useScaffoldArgs ? 'F.lit(args.run_id)' : 'F.lit("")' });
  if (runUserColumn) auditAssignments.push({ column: runUserColumn, expression: useScaffoldArgs ? 'F.lit(args.run_user)' : 'F.lit("system")' });

  if (auditAssignments.length === 0) return { inputVar: currentInputVar, needsFunctions };

  const auditedVarName = `${varName}_audited`;

  if (context.options.includeComments) {
    builder.line(`# Add target audit values before writing ${node.name}`);
  }

  builder.line(`${auditedVarName} = (`);
  builder.indent(b2 => {
    b2.line(`${currentInputVar}`);
    b2.indent(b3 => {
      auditAssignments.forEach(({ column, expression }) => {
        b3.line(`.withColumn(${pyStringLiteral(column)}, ${expression})`);
      });
    });
  });
  builder.line(')');
  builder.blank();

  return { inputVar: auditedVarName, needsFunctions: true };
}

// ─── JDBC Sink ────────────────────────────────────────────────────────────────

export class PySparkJdbcSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'jdbc';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'jdbc';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JdbcSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const b = new CodeBuilder();
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) {
      b.line(`# Sink: ${node.name} (JDBC → ${cfg.table})`);
      if (node.description) b.line(`# ${node.description}`);
    }

    const userExpr = cfg.passwordSecret
      ? `os.environ.get(${pyStringLiteral(cfg.passwordSecret + '_USER')}, "")`
      : cfg.user ? pyStringLiteral(cfg.user) : `os.environ.get("DB_USER", "")`;
    const passExpr = cfg.passwordSecret
      ? `os.environ.get(${pyStringLiteral(cfg.passwordSecret)}, "")`
      : cfg.password ? pyStringLiteral(cfg.password) : `os.environ.get("DB_PASSWORD", "")`;

    b.line(`(`);
    b.indent(b2 => {
      b2.line(`${writeInputVar}`);
      b2.indent(b3 => {
        b3.line(`.write`);
        b3.line(`.format("jdbc")`);
        b3.line(`.mode(${pyStringLiteral(cfg.mode)})`);
        b3.line(`.option("url", ${pyStringLiteral(cfg.url)})`);
        b3.line(`.option("dbtable", ${pyStringLiteral(cfg.table)})`);
        b3.line(`.option("driver", ${pyStringLiteral(cfg.driver)})`);
        b3.line(`.option("user", ${userExpr})`);
        b3.line(`.option("password", ${passExpr})`);
        if (cfg.batchSize) b3.line(`.option("batchsize", ${cfg.batchSize})`);
        if (cfg.truncate) b3.line(`.option("truncate", "true")`);
        if (cfg.createTableOptions) b3.line(`.option("createTableOptions", ${pyStringLiteral(cfg.createTableOptions)})`);
        if (cfg.customOptions) {
          Object.entries(cfg.customOptions).forEach(([k, v]) => b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`));
        }
        b3.line(`.save()`);
      });
    });
    b.line(')');

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(f"Wrote JDBC sink '${node.name}' → ${cfg.table} (mode: ${cfg.mode})")`);
    }

    return {
      varName,
      code: b.build(),
      imports: preparedInput.needsFunctions ? [PYSPARK_IMPORTS.OS, PYSPARK_IMPORTS.FUNCTIONS] : [PYSPARK_IMPORTS.OS],
      warnings: [],
    };
  }
}

// ─── File Sink ────────────────────────────────────────────────────────────────

export class PySparkFileSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'file';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'file';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FileSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const b = new CodeBuilder();
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) {
      b.line(`# Sink: ${node.name} (${cfg.format.toUpperCase()} File)`);
    }

    // Repartition must happen on the DataFrame BEFORE the writer chain
    const writeSource = cfg.numPartitions ? `${writeInputVar}.repartition(${cfg.numPartitions})` : writeInputVar;

    b.line(`(`);
    b.indent(b2 => {
      b2.line(`${writeSource}`);
      b2.indent(b3 => {
        b3.line(`.write`);
        b3.line(`.format(${pyStringLiteral(cfg.format)})`);
        b3.line(`.mode(${pyStringLiteral(cfg.mode)})`);

        if (cfg.partitionBy && cfg.partitionBy.length > 0) {
          const cols = cfg.partitionBy.map(c => pyStringLiteral(c)).join(', ');
          b3.line(`.partitionBy(${cols})`);
        }

        if (cfg.compression) b3.line(`.option("compression", ${pyStringLiteral(cfg.compression)})`);

        if (cfg.format === 'csv') {
          if (cfg.header !== false) b3.line(`.option("header", "true")`);
          if (cfg.delimiter) b3.line(`.option("sep", ${pyStringLiteral(cfg.delimiter)})`);
        }

        if (cfg.customOptions) {
          Object.entries(cfg.customOptions).forEach(([k, v]) => b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`));
        }

        b3.line(`.save(${pyStringLiteral(cfg.path)})`);
      });
    });
    b.line(')');

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(f"Wrote file sink '${node.name}' → ${cfg.path}")`);
    }

    return { varName, code: b.build(), imports: preparedInput.needsFunctions ? [PYSPARK_IMPORTS.FUNCTIONS] : [], warnings: [] };
  }
}

// ─── Delta Sink ───────────────────────────────────────────────────────────────

export class PySparkDeltaSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'delta';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'delta';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeltaSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const b = new CodeBuilder();
    const warnings: any[] = [];
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) {
      b.line(`# Sink: ${node.name} (Delta Lake)`);
    }

    if (cfg.mode === 'merge') {
      // Generate MERGE INTO (DML-style)
      b.line(`from delta.tables import DeltaTable`);
      b.blank();

      const target = cfg.path ? `DeltaTable.forPath(spark, ${pyStringLiteral(cfg.path)})` : `DeltaTable.forName(spark, ${pyStringLiteral(cfg.tableName!)})`;
      b.line(`_delta_target_${varName} = ${target}`);

      const mergeKey = cfg.mergeKey ?? [];
      const mergeCondition = cfg.mergeCondition ?? mergeKey.map(k => `target.${k} = source.${k}`).join(' AND ');

      if (mergeKey.length === 0 && !cfg.mergeCondition) {
        warnings.push({ nodeId: node.id, code: 'DELTA_MERGE_NO_KEY', message: 'Delta MERGE mode: mergeKey or mergeCondition required.', severity: 'error' as const });
      }

      b.line(`(_delta_target_${varName}`);
      b.indent(b2 => {
        b2.line(`.merge(`);
        b2.indent(b3 => {
          b3.line(`${writeInputVar},`);
          b3.line(`${pyStringLiteral(mergeCondition)}`);
        });
        b2.line(`)`);
        b2.line(`.whenMatchedUpdateAll()`);
        b2.line(`.whenNotMatchedInsertAll()`);
        b2.line(`.execute()`);
      });
      b.line(')');
    } else {
      b.line(`_writer_${varName} = (`);
      b.indent(b2 => {
        b2.line(`${writeInputVar}`);
        b2.indent(b3 => {
          b3.line(`.write`);
          b3.line(`.format("delta")`);
          b3.line(`.mode(${pyStringLiteral(cfg.mode)})`);
          if (cfg.partitionBy && cfg.partitionBy.length > 0) {
            const cols = cfg.partitionBy.map(c => pyStringLiteral(c)).join(', ');
            b3.line(`.partitionBy(${cols})`);
          }
          if (cfg.optimizeWrite) b3.line(`.option("optimizeWrite", "true")`);
          if (cfg.autoCompact) b3.line(`.option("autoCompact", "true")`);
          if (cfg.path) b3.line(`.save(${pyStringLiteral(cfg.path)})`);
          else if (cfg.tableName) b3.line(`.saveAsTable(${pyStringLiteral(cfg.tableName)})`);
        });
      });
      b.line(')');

      if (cfg.zorderBy && cfg.zorderBy.length > 0) {
        const zCols = cfg.zorderBy.join(', ');
        b.blank();
        b.line(`# Z-Order optimization`);
        b.line(`from delta.tables import DeltaTable`);
        const target = cfg.path ? `DeltaTable.forPath(spark, ${pyStringLiteral(cfg.path)})` : `DeltaTable.forName(spark, ${pyStringLiteral(cfg.tableName!)})`;
        b.line(`${target}.optimize().executeZOrderBy(${pyStringLiteral(zCols)})`);
      }
    }

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(f"Wrote Delta sink '${node.name}' (mode: ${cfg.mode})")`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}

// ─── Iceberg Sink ─────────────────────────────────────────────────────────────

export class PySparkIcebergSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'iceberg';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'iceberg';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as IcebergSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const tableRef = `${cfg.catalog}.${cfg.namespace}.${cfg.table}`;
    const b = new CodeBuilder();
    const warnings = [];
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) b.line(`# Sink: ${node.name} (Iceberg → ${tableRef})`);

    if (cfg.createIfNotExists) {
      b.line(`# Create table if not exists`);
      b.line(`spark.sql(f"""CREATE TABLE IF NOT EXISTS ${tableRef} USING iceberg""")`);
      b.blank();
    }

    if (cfg.mode === 'merge' && cfg.mergeKey && cfg.mergeKey.length > 0) {
      const mergeCondition = cfg.mergeKey.map(k => `t.${k} = s.${k}`).join(' AND ');
      b.line(`${writeInputVar}.createOrReplaceTempView("_iceberg_source_${varName}")`);
      b.line(`spark.sql(f"""`);
      b.indent(b2 => {
        b2.line(`MERGE INTO ${tableRef} t`);
        b2.line(`USING _iceberg_source_${varName} s`);
        b2.line(`ON ${mergeCondition}`);
        b2.line(`WHEN MATCHED THEN UPDATE SET *`);
        b2.line(`WHEN NOT MATCHED THEN INSERT *`);
      });
      b.line(`""")`);
    } else {
      b.line(`(`);
      b.indent(b2 => {
        b2.line(`${writeInputVar}`);
        b2.indent(b3 => {
          b3.line(`.write`);
          b3.line(`.format("iceberg")`);
          b3.line(`.mode(${pyStringLiteral(cfg.mode)})`);
          if (cfg.mergeKey && cfg.mode === 'overwrite') {
            const overwriteExpr = cfg.mergeKey.map(k => pyStringLiteral(k)).join(', ');
            b3.line(`.option("overwrite-mode", "dynamic")`);
          }
          b3.line(`.saveAsTable(${pyStringLiteral(tableRef)})`);
        });
      });
      b.line(')');
    }

    return { varName, code: b.build(), imports: preparedInput.needsFunctions ? [PYSPARK_IMPORTS.FUNCTIONS] : [], warnings };
  }
}

// ─── Kafka Sink ───────────────────────────────────────────────────────────────

export class PySparkKafkaSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'kafka';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'kafka';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as KafkaSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const b = new CodeBuilder();
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) b.line(`# Sink: ${node.name} (Kafka → ${cfg.topic})`);

    // Serialize to Kafka value
    if (cfg.valueFormat === 'json' || !cfg.valueFormat) {
      b.line(`_kafka_df_${varName} = ${writeInputVar}.select(`);
      b.indent(b2 => {
        if (cfg.keyColumn) {
          b2.line(`F.col(${pyStringLiteral(cfg.keyColumn)}).cast("string").alias("key"),`);
        }
        b2.line(`F.to_json(F.struct("*")).alias("value")`);
      });
      b.line(')');
    } else {
      b.line(`_kafka_df_${varName} = ${writeInputVar}.select(F.to_json(F.struct("*")).alias("value"))`);
    }

    b.blank();
    b.line(`(`);
    b.indent(b2 => {
      b2.line(`_kafka_df_${varName}`);
      b2.indent(b3 => {
        b3.line(`.write`);
        b3.line(`.format("kafka")`);
        b3.line(`.option("kafka.bootstrap.servers", ${pyStringLiteral(cfg.bootstrapServers)})`);
        b3.line(`.option("topic", ${pyStringLiteral(cfg.topic)})`);
        if (cfg.customOptions) {
          Object.entries(cfg.customOptions).forEach(([k, v]) => b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`));
        }
        b3.line(`.save()`);
      });
    });
    b.line(')');

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings: [] };
  }
}

// ─── Hive Sink ────────────────────────────────────────────────────────────────

export class PySparkHiveSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'hive';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'hive';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as HiveSinkConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const table = `${cfg.database}.${cfg.table}`;
    const b = new CodeBuilder();
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) b.line(`# Sink: ${node.name} (Hive → ${table})`);

    if (cfg.createIfNotExists) {
      b.line(`spark.sql(${pyStringLiteral(`CREATE TABLE IF NOT EXISTS ${table} STORED AS ${cfg.fileFormat ?? 'parquet'}`)})`);
      b.blank();
    }

    b.line(`(`);
    b.indent(b2 => {
      b2.line(`${writeInputVar}`);
      b2.indent(b3 => {
        b3.line(`.write`);
        b3.line(`.mode(${pyStringLiteral(cfg.mode)})`);
        if (cfg.fileFormat) b3.line(`.format(${pyStringLiteral(cfg.fileFormat)})`);
        if (cfg.partitionBy && cfg.partitionBy.length > 0) {
          const cols = cfg.partitionBy.map(c => pyStringLiteral(c)).join(', ');
          b3.line(`.partitionBy(${cols})`);
        }
        b3.line(`.saveAsTable(${pyStringLiteral(table)})`);
      });
    });
    b.line(')');

    return { varName, code: b.build(), imports: preparedInput.needsFunctions ? [PYSPARK_IMPORTS.FUNCTIONS] : [], warnings: [] };
  }
}

// ─── Console Sink (dev/debug) ─────────────────────────────────────────────────

export class PySparkConsoleSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const;
  readonly subType = 'console';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'sink' && node.sinkType === 'console';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { numRows?: number; truncate?: boolean; vertical?: boolean };
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name, 'sink');
    const b = new CodeBuilder();
    const preparedInput = prepareSinkInput(node, inputVar, varName, context, b);
    const writeInputVar = preparedInput.inputVar;

    if (context.options.includeComments) b.line(`# Sink: ${node.name} (Console - DEBUG ONLY)`);

    const numRows = cfg.numRows ?? 20;
    const truncate = cfg.truncate !== false;
    const vertical = cfg.vertical ?? false;

    b.line(`${writeInputVar}.show(${numRows}, truncate=${truncate ? 'True' : 'False'}, vertical=${vertical ? 'True' : 'False'})`);
    b.line(`${writeInputVar}.printSchema()`);

    context.warnings.push({
      nodeId: node.id,
      code: 'CONSOLE_SINK_IN_PIPELINE',
      message: `Console sink "${node.name}" is for debugging only. Remove in production.`,
      severity: 'warn',
    });

    return { varName, code: b.build(), imports: preparedInput.needsFunctions ? [PYSPARK_IMPORTS.FUNCTIONS] : [], warnings: [] };
  }
}
