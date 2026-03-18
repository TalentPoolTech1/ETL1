import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, JdbcSourceConfig, FileSourceConfig, KafkaSourceConfig,
  DeltaSourceConfig, HiveSourceConfig, IcebergSourceConfig, Schema
} from '../../../../core/types/pipeline.types';
import { ScalaCodeBuilder, toScalaVal, scalaString, toScalaSparkType } from '../scala.utils';

// ─── Scala JDBC Source ────────────────────────────────────────────────────────

export class ScalaJdbcSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'jdbc';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'jdbc'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JdbcSourceConfig;
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();
    const warnings: any[] = [];

    if (context.options.includeComments) b.comment(`Source: ${node.name} (JDBC)`);

    const userExpr = cfg.passwordSecret
      ? `sys.env.getOrElse(${scalaString(cfg.passwordSecret + '_USER')}, "")`
      : cfg.user ? scalaString(cfg.user) : `sys.env.getOrElse("DB_USER", "")`;
    const passExpr = cfg.passwordSecret
      ? `sys.env.getOrElse(${scalaString(cfg.passwordSecret)}, "")`
      : cfg.password ? scalaString(cfg.password) : `sys.env.getOrElse("DB_PASSWORD", "")`;

    const dbtable = cfg.query
      ? `(${cfg.query.replace(/\s+/g, ' ').trim()}) AS q_${varName}`
      : cfg.table ?? '';

    b.line(`val ${varName} = spark.read`);
    b.indent(b2 => {
      b2.line(`.format("jdbc")`);
      b2.line(`.option("url", ${scalaString(cfg.url)})`);
      b2.line(`.option("dbtable", ${scalaString(dbtable)})`);
      b2.line(`.option("driver", ${scalaString(cfg.driver ?? '')})`);
      b2.line(`.option("user", ${userExpr})`);
      b2.line(`.option("password", ${passExpr})`);
      if (cfg.numPartitions) {
        b2.line(`.option("numPartitions", ${cfg.numPartitions})`);
        if (cfg.partitionColumn) b2.line(`.option("partitionColumn", ${scalaString(cfg.partitionColumn)})`);
        if (cfg.lowerBound !== undefined) b2.line(`.option("lowerBound", ${cfg.lowerBound})`);
        if (cfg.upperBound !== undefined) b2.line(`.option("upperBound", ${cfg.upperBound})`);
      }
      if (cfg.fetchSize) b2.line(`.option("fetchsize", ${cfg.fetchSize})`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.load()`);
    });

    return { varName, code: b.build(), imports: [], warnings };
  }
}

// ─── Scala File Source ────────────────────────────────────────────────────────

export class ScalaFileSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'file';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'file'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FileSourceConfig;
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) b.comment(`Source: ${node.name} (${cfg.format.toUpperCase()})`);

    if (cfg.schema && !cfg.inferSchema) {
      b.raw(this.buildSchema(`schema${varName.charAt(0).toUpperCase() + varName.slice(1)}`, cfg.schema));
      b.blank();
    }

    b.line(`val ${varName} = spark.read`);
    b.indent(b2 => {
      b2.line(`.format(${scalaString(cfg.format)})`);
      if (cfg.schema && !cfg.inferSchema) {
        const schemaVar = `schema${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
        b2.line(`.schema(${schemaVar})`);
      } else if (cfg.inferSchema) {
        b2.line(`.option("inferSchema", "true")`);
      }
      if (cfg.format === 'csv') {
        if (cfg.header !== false) b2.line(`.option("header", "true")`);
        if (cfg.delimiter) b2.line(`.option("sep", ${scalaString(cfg.delimiter)})`);
      }
      if (cfg.format === 'json' && cfg.multiLine) b2.line(`.option("multiLine", "true")`);
      if (cfg.mergeSchema) b2.line(`.option("mergeSchema", "true")`);
      if (cfg.recursiveFileLookup) b2.line(`.option("recursiveFileLookup", "true")`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.load(${scalaString(cfg.path)})`);
    });

    return { varName, code: b.build(), imports: [], warnings: [] };
  }

  private buildSchema(varName: string, schema: Schema): string {
    const b = new ScalaCodeBuilder();
    b.line(`val ${varName} = StructType(Seq(`);
    b.indent(b2 => {
      schema.fields.forEach((f, i) => {
        const comma = i < schema.fields.length - 1 ? ',' : '';
        b2.line(`StructField(${scalaString(f.name)}, ${toScalaSparkType(f.dataType)}, nullable = ${f.nullable !== false})${comma}`);
      });
    });
    b.line(`))`)
    return b.build();
  }
}

// ─── Scala Kafka Source ───────────────────────────────────────────────────────

export class ScalaKafkaSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'kafka';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'kafka'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as KafkaSourceConfig;
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) b.comment(`Source: ${node.name} (Kafka${cfg.streaming ? ' Streaming' : ''})`);

    const readApi = cfg.streaming ? 'spark.readStream' : 'spark.read';
    b.line(`val ${varName}Raw = ${readApi}`);
    b.indent(b2 => {
      b2.line(`.format("kafka")`);
      b2.line(`.option("kafka.bootstrap.servers", ${scalaString(cfg.bootstrapServers)})`);
      b2.line(`.option("subscribe", ${scalaString(cfg.topic)})`);
      if (cfg.startingOffsets) b2.line(`.option("startingOffsets", ${scalaString(cfg.startingOffsets)})`);
      if (!cfg.streaming && cfg.endingOffsets) b2.line(`.option("endingOffsets", ${scalaString(cfg.endingOffsets)})`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.load()`);
    });
    b.blank();
    b.line(`val ${varName} = ${varName}Raw.select(`);
    b.indent(b2 => {
      b2.line(`col("key").cast("string").as("_kafka_key"),`);
      b2.line(`col("value").cast("string").as("_value"),`);
      b2.line(`col("timestamp").as("_kafka_timestamp")`);
    });
    b.line(')');

    return { varName, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Scala Delta Source ───────────────────────────────────────────────────────

export class ScalaDeltaSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'delta';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'delta'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeltaSourceConfig;
    const varName = toScalaVal(node.name);
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) b.comment(`Source: ${node.name} (Delta Lake)`);

    if (cfg.version !== undefined || cfg.timestamp) {
      b.line(`val ${varName} = spark.read.format("delta")`);
      b.indent(b2 => {
        if (cfg.version !== undefined) b2.line(`.option("versionAsOf", ${cfg.version})`);
        if (cfg.timestamp) b2.line(`.option("timestampAsOf", ${scalaString(cfg.timestamp)})`);
        if (cfg.path) b2.line(`.load(${scalaString(cfg.path)})`);
        else if (cfg.tableName) b2.line(`.table(${scalaString(cfg.tableName)})`);
      });
    } else if (cfg.tableName) {
      b.line(`val ${varName} = spark.table(${scalaString(cfg.tableName)})`);
    } else if (cfg.path) {
      b.line(`val ${varName} = spark.read.format("delta").load(${scalaString(cfg.path)})`);
    } else {
      b.line(`// ERROR: Delta source "${node.name}" needs path or tableName`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Scala Hive Source ────────────────────────────────────────────────────────

export class ScalaHiveSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'hive';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'hive'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as HiveSourceConfig;
    const varName = toScalaVal(node.name);
    const table = `${cfg.database}.${cfg.table}`;
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) b.comment(`Source: ${node.name} (Hive)`);

    if (cfg.partitionFilter) {
      b.line(`val ${varName} = spark.table(${scalaString(table)}).filter(${scalaString(cfg.partitionFilter)})`);
    } else {
      b.line(`val ${varName} = spark.table(${scalaString(table)})`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Scala Iceberg Source ─────────────────────────────────────────────────────

export class ScalaIcebergSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'iceberg';
  canHandle(n: PipelineNode) { return n.type === 'source' && n.sourceType === 'iceberg'; }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as IcebergSourceConfig;
    const varName = toScalaVal(node.name);
    const tableRef = `${cfg.catalog}.${cfg.namespace}.${cfg.table}`;
    const b = new ScalaCodeBuilder();

    if (context.options.includeComments) b.comment(`Source: ${node.name} (Iceberg)`);

    if (cfg.snapshotId) {
      b.line(`val ${varName} = spark.read.option("snapshot-id", ${cfg.snapshotId}).table(${scalaString(tableRef)})`);
    } else if (cfg.asOfTimestamp) {
      b.line(`val ${varName} = spark.read.option("as-of-timestamp", ${scalaString(cfg.asOfTimestamp)}).table(${scalaString(tableRef)})`);
    } else {
      b.line(`val ${varName} = spark.table(${scalaString(tableRef)})`);
    }

    return { varName, code: b.build(), imports: [], warnings: [] };
  }
}
