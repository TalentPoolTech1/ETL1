import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import {
  PipelineNode, JdbcSinkConfig, FileSinkConfig, DeltaSinkConfig,
  IcebergSinkConfig, KafkaSinkConfig, HiveSinkConfig
} from '../../../../core/types/pipeline.types';
import { ScalaCodeBuilder, toScalaVal, scalaString } from '../scala.utils';

function inputVal(node: PipelineNode, ctx: GenerationContext): string {
  return ctx.resolvedNodes.get(node.inputs[0])?.varName ?? 'missingInput';
}

// ─── JDBC Sink ────────────────────────────────────────────────────────────────

export class ScalaJdbcSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'jdbc';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'jdbc'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JdbcSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (JDBC → ${cfg.table})`);

    const userExpr = cfg.passwordSecret
      ? `sys.env.getOrElse(${scalaString(cfg.passwordSecret + '_USER')}, "")`
      : cfg.user ? scalaString(cfg.user) : `sys.env.getOrElse("DB_USER", "")`;
    const passExpr = cfg.passwordSecret
      ? `sys.env.getOrElse(${scalaString(cfg.passwordSecret)}, "")`
      : cfg.password ? scalaString(cfg.password) : `sys.env.getOrElse("DB_PASSWORD", "")`;

    b.line(`${inp}.write`);
    b.indent(b2 => {
      b2.line(`.format("jdbc")`);
      b2.line(`.mode(${scalaString(cfg.mode)})`);
      b2.line(`.option("url", ${scalaString(cfg.url)})`);
      b2.line(`.option("dbtable", ${scalaString(cfg.table)})`);
      b2.line(`.option("driver", ${scalaString(cfg.driver)})`);
      b2.line(`.option("user", ${userExpr})`);
      b2.line(`.option("password", ${passExpr})`);
      if (cfg.batchSize) b2.line(`.option("batchsize", ${cfg.batchSize})`);
      if (cfg.truncate) b2.line(`.option("truncate", "true")`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.save()`);
    });

    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── File Sink ────────────────────────────────────────────────────────────────

export class ScalaFileSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'file';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'file'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as FileSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (${cfg.format.toUpperCase()} File)`);

    b.line(`${inp}.write`);
    b.indent(b2 => {
      b2.line(`.format(${scalaString(cfg.format)})`);
      b2.line(`.mode(${scalaString(cfg.mode)})`);
      if (cfg.partitionBy && cfg.partitionBy.length > 0) {
        b2.line(`.partitionBy(${cfg.partitionBy.map(c => scalaString(c)).join(', ')})`);
      }
      if (cfg.compression) b2.line(`.option("compression", ${scalaString(cfg.compression)})`);
      if (cfg.format === 'csv' && cfg.header !== false) b2.line(`.option("header", "true")`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.save(${scalaString(cfg.path)})`);
    });

    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Delta Sink ───────────────────────────────────────────────────────────────

export class ScalaDeltaSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'delta';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'delta'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as DeltaSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    const warnings: any[] = [];
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (Delta Lake)`);

    if (cfg.mode === 'merge') {
      const mergeKey = cfg.mergeKey ?? [];
      const mergeCond = cfg.mergeCondition ?? mergeKey.map(k => `target.${k} = source.${k}`).join(' AND ');
      if (mergeKey.length === 0 && !cfg.mergeCondition) {
        warnings.push({ nodeId: node.id, code: 'DELTA_MERGE_NO_KEY', message: 'Delta MERGE requires mergeKey or mergeCondition.', severity: 'error' as const });
      }

      const target = cfg.path
        ? `DeltaTable.forPath(spark, ${scalaString(cfg.path)})`
        : `DeltaTable.forName(spark, ${scalaString(cfg.tableName!)})`;

      b.line(`import io.delta.tables.DeltaTable`);
      b.line(`${target}`);
      b.indent(b2 => {
        b2.line(`.merge(`);
        b2.indent(b3 => {
          b3.line(`${inp},`);
          b3.line(`${scalaString(mergeCond)}`);
        });
        b2.line(`)`);
        b2.line(`.whenMatched().updateAll()`);
        b2.line(`.whenNotMatched().insertAll()`);
        b2.line(`.execute()`);
      });
    } else {
      b.line(`${inp}.write`);
      b.indent(b2 => {
        b2.line(`.format("delta")`);
        b2.line(`.mode(${scalaString(cfg.mode)})`);
        if (cfg.partitionBy && cfg.partitionBy.length > 0) {
          b2.line(`.partitionBy(${cfg.partitionBy.map(c => scalaString(c)).join(', ')})`);
        }
        if (cfg.optimizeWrite) b2.line(`.option("optimizeWrite", "true")`);
        if (cfg.autoCompact) b2.line(`.option("autoCompact", "true")`);
        if (cfg.path) b2.line(`.save(${scalaString(cfg.path)})`);
        else if (cfg.tableName) b2.line(`.saveAsTable(${scalaString(cfg.tableName)})`);
      });
    }

    return { varName: v, code: b.build(), imports: [], warnings };
  }
}

// ─── Kafka Sink ───────────────────────────────────────────────────────────────

export class ScalaKafkaSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'kafka';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'kafka'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as KafkaSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (Kafka → ${cfg.topic})`);

    b.line(`val ${v}Serialized = ${inp}.select(to_json(struct("*")).as("value"))`);
    b.blank();
    b.line(`${v}Serialized.write`);
    b.indent(b2 => {
      b2.line(`.format("kafka")`);
      b2.line(`.option("kafka.bootstrap.servers", ${scalaString(cfg.bootstrapServers)})`);
      b2.line(`.option("topic", ${scalaString(cfg.topic)})`);
      if (cfg.customOptions) Object.entries(cfg.customOptions).forEach(([k, v]) => b2.line(`.option(${scalaString(k)}, ${scalaString(v)})`));
      b2.line(`.save()`);
    });

    return { varName: v, code: b.build(), imports: ['import org.apache.spark.sql.functions._'], warnings: [] };
  }
}

// ─── Hive Sink ────────────────────────────────────────────────────────────────

export class ScalaHiveSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'hive';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'hive'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as HiveSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const table = `${cfg.database}.${cfg.table}`;
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (Hive → ${table})`);

    b.line(`${inp}.write`);
    b.indent(b2 => {
      b2.line(`.mode(${scalaString(cfg.mode)})`);
      if (cfg.fileFormat) b2.line(`.format(${scalaString(cfg.fileFormat)})`);
      if (cfg.partitionBy && cfg.partitionBy.length > 0) {
        b2.line(`.partitionBy(${cfg.partitionBy.map(c => scalaString(c)).join(', ')})`);
      }
      b2.line(`.saveAsTable(${scalaString(table)})`);
    });

    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Iceberg Sink ─────────────────────────────────────────────────────────────

export class ScalaIcebergSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'iceberg';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'iceberg'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as IcebergSinkConfig;
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const tableRef = `${cfg.catalog}.${cfg.namespace}.${cfg.table}`;
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (Iceberg → ${tableRef})`);

    b.line(`${inp}.write`);
    b.indent(b2 => {
      b2.line(`.format("iceberg")`);
      b2.line(`.mode(${scalaString(cfg.mode)})`);
      b2.line(`.saveAsTable(${scalaString(tableRef)})`);
    });

    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}

// ─── Console Sink ─────────────────────────────────────────────────────────────

export class ScalaConsoleSinkGenerator implements INodeGenerator {
  readonly nodeType = 'sink' as const; readonly subType = 'console';
  canHandle(n: PipelineNode) { return n.type === 'sink' && n.sinkType === 'console'; }

  async generate(node: PipelineNode, ctx: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as { numRows?: number };
    const v = toScalaVal(node.name, 'Sink'); const inp = inputVal(node, ctx);
    const b = new ScalaCodeBuilder();
    if (ctx.options.includeComments) b.comment(`Sink: ${node.name} (Console - DEBUG ONLY)`);
    b.line(`${inp}.show(${cfg.numRows ?? 20}, truncate = false)`);
    b.line(`${inp}.printSchema()`);
    ctx.warnings.push({ nodeId: node.id, code: 'CONSOLE_SINK', message: `Console sink "${node.name}" - remove for production.`, severity: 'warn' });
    return { varName: v, code: b.build(), imports: [], warnings: [] };
  }
}
