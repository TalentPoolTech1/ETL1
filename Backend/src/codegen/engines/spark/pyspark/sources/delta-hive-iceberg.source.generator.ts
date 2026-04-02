import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, DeltaSourceConfig, HiveSourceConfig, IcebergSourceConfig } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── PySpark Delta Source Generator ───────────────────────────────────────────

export class PySparkDeltaSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'delta';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'delta';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeltaSourceConfig;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Delta Lake)`);
      if (node.description) b.line(`# ${node.description}`);
    }

    if (cfg.readChangeFeed) {
      // Change Data Feed read
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line('spark.read.format("delta")');
        b2.indent(b3 => {
          b3.line('.option("readChangeFeed", "true")');
          if (cfg.startingVersion !== undefined) b3.line(`.option("startingVersion", ${cfg.startingVersion})`);
          if (cfg.startingTimestamp) b3.line(`.option("startingTimestamp", ${pyStringLiteral(cfg.startingTimestamp)})`);
          if (cfg.path) b3.line(`.load(${pyStringLiteral(cfg.path)})`);
          else if (cfg.tableName) b3.line(`.table(${pyStringLiteral(cfg.tableName)})`);
        });
      });
      b.line(')');
    } else if (cfg.version !== undefined || cfg.timestamp) {
      // Time travel
      b.line(`${varName} = (`);
      b.indent(b2 => {
        b2.line('spark.read.format("delta")');
        b2.indent(b3 => {
          if (cfg.version !== undefined) b3.line(`.option("versionAsOf", ${cfg.version})`);
          if (cfg.timestamp) b3.line(`.option("timestampAsOf", ${pyStringLiteral(cfg.timestamp)})`);
          if (cfg.path) b3.line(`.load(${pyStringLiteral(cfg.path)})`);
          else if (cfg.tableName) b3.line(`.table(${pyStringLiteral(cfg.tableName)})`);
        });
      });
      b.line(')');
    } else {
      // Standard read
      if (cfg.tableName) {
        b.line(`${varName} = spark.table(${pyStringLiteral(cfg.tableName)})`);
      } else if (cfg.path) {
        b.line(`${varName} = spark.read.format("delta").load(${pyStringLiteral(cfg.path)})`);
      } else {
        warnings.push({ nodeId: node.id, code: 'DELTA_NO_TARGET', message: 'Delta source needs path or tableName.', severity: 'error' as const });
        b.line(`${varName} = None  # ERROR: Delta source needs path or tableName`);
      }
    }

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(${pyStringLiteral(`Configured Delta source '${node.name}'`)})`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}

// ─── PySpark Hive Source Generator ────────────────────────────────────────────

export class PySparkHiveSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'hive';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'hive';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as HiveSourceConfig;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Hive)`);
    }

    const table = `${cfg.database}.${cfg.table}`;

    if (cfg.partitionFilter) {
      b.line(`${varName} = spark.table(${pyStringLiteral(table)}).filter(${pyStringLiteral(cfg.partitionFilter)})`);
    } else {
      b.line(`${varName} = spark.table(${pyStringLiteral(table)})`);
    }

    if (cfg.pushDownPredicate === false) {
      context.warnings.push({
        nodeId: node.id,
        code: 'HIVE_PUSHDOWN_DISABLED',
        message: `Predicate pushdown disabled for Hive source "${node.name}". May impact performance.`,
        severity: 'warn',
      });
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── PySpark Iceberg Source Generator ─────────────────────────────────────────

export class PySparkIcebergSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'iceberg';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'iceberg';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as IcebergSourceConfig;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Apache Iceberg)`);
      if (node.description) b.line(`# ${node.description}`);
    }

    const tableRef = `${cfg.catalog}.${cfg.namespace}.${cfg.table}`;

    if (cfg.readChangelog) {
      b.line(`${varName} = spark.read`);
      b.indent(b2 => {
        b2.line('.format("iceberg")');
        b2.line(`.option("streaming", "false")`);
        b2.line(`.load("${tableRef}.history")`);
      });
      warnings.push({ nodeId: node.id, code: 'ICEBERG_CHANGELOG', message: 'Iceberg changelog reads require snapshot management.', severity: 'info' as const });
    } else if (cfg.snapshotId) {
      b.line(`${varName} = spark.read.option("snapshot-id", ${cfg.snapshotId}).table(${pyStringLiteral(tableRef)})`);
    } else if (cfg.asOfTimestamp) {
      b.line(`${varName} = spark.read.option("as-of-timestamp", ${pyStringLiteral(cfg.asOfTimestamp)}).table(${pyStringLiteral(tableRef)})`);
    } else {
      b.line(`${varName} = spark.table(${pyStringLiteral(tableRef)})`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}
