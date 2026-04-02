import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, KafkaSourceConfig } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral, toPySparkType } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── PySpark Kafka Source Generator ───────────────────────────────────────────

export class PySparkKafkaSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'kafka';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'kafka';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as KafkaSourceConfig;
    const varName = toVarName(node.name);
    const imports = [PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.TYPES];
    const warnings = [];
    const b = new CodeBuilder();

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (Kafka${cfg.streaming ? ' - Streaming' : ' - Batch'})`);
      if (node.description) b.line(`# ${node.description}`);
    }

    const readApi = cfg.streaming ? 'spark.readStream' : 'spark.read';

    b.line(`${varName}_raw = (`);
    b.indent(b2 => {
      b2.line(readApi);
      b2.indent(b3 => {
        b3.line('.format("kafka")');
        b3.line(`.option("kafka.bootstrap.servers", ${pyStringLiteral(cfg.bootstrapServers)})`);
        b3.line(`.option("subscribe", ${pyStringLiteral(cfg.topic)})`);
        if (cfg.startingOffsets) b3.line(`.option("startingOffsets", ${pyStringLiteral(cfg.startingOffsets)})`);
        if (!cfg.streaming && cfg.endingOffsets) b3.line(`.option("endingOffsets", ${pyStringLiteral(cfg.endingOffsets)})`);
        if (cfg.groupId) b3.line(`.option("kafka.group.id", ${pyStringLiteral(cfg.groupId)})`);
        if (cfg.customOptions) {
          Object.entries(cfg.customOptions).forEach(([k, v]) => {
            b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`);
          });
        }
        b3.line('.load()');
      });
    });
    b.line(')');
    b.blank();

    // Deserialize value based on format
    const valueFormat = cfg.valueFormat ?? 'json';
    b.line(this.buildValueDeserialization(varName, cfg, valueFormat, context));

    if (cfg.streaming && cfg.watermarkDelay) {
      b.blank();
      b.line(`${varName} = ${varName}.withWatermark("timestamp", ${pyStringLiteral(cfg.watermarkDelay)})`);
    }

    if (context.options.includeLogging && !cfg.streaming) {
      b.blank();
      b.line(`logger.info(${pyStringLiteral(`Configured Kafka source '${node.name}' from topic ${cfg.topic}`)})`);
    }

    return { varName, code: b.build(), imports, warnings };
  }

  private buildValueDeserialization(
    varName: string,
    cfg: KafkaSourceConfig,
    valueFormat: string,
    context: GenerationContext
  ): string {
    const b = new CodeBuilder();

    if (valueFormat === 'json') {
      if (cfg.valueSchema) {
        const schemaVar = `_schema_${varName}`;
        b.line(`${schemaVar} = T.StructType([`);
        b.indent(b2 => {
          cfg.valueSchema!.fields.forEach((f, i) => {
            const comma = i < cfg.valueSchema!.fields.length - 1 ? ',' : '';
            b2.line(`T.StructField(${pyStringLiteral(f.name)}, ${toPySparkType(f.dataType)}, ${f.nullable !== false})${comma}`);
          });
        });
        b.line('])');
        b.line(`${varName} = (`);
        b.indent(b2 => {
          b2.line(`${varName}_raw`);
          b2.indent(b3 => {
            b3.line(`.select(`);
            b3.indent(b4 => {
              b4.line(`F.col("key").cast("string").alias("_kafka_key"),`);
              b4.line(`F.from_json(F.col("value").cast("string"), ${schemaVar}).alias("_data"),`);
              b4.line(`F.col("topic").alias("_kafka_topic"),`);
              b4.line(`F.col("partition").alias("_kafka_partition"),`);
              b4.line(`F.col("offset").alias("_kafka_offset"),`);
              b4.line(`F.col("timestamp").alias("_kafka_timestamp")`);
            });
            b3.line(`)`)
            b3.line(`.select("_kafka_key", "_data.*", "_kafka_topic", "_kafka_partition", "_kafka_offset", "_kafka_timestamp")`);
          });
        });
        b.line(')');
      } else {
        b.line(`${varName} = ${varName}_raw.select(`);
        b.indent(b2 => {
          b2.line(`F.col("key").cast("string").alias("_kafka_key"),`);
          b2.line(`F.col("value").cast("string").alias("_value"),`);
          b2.line(`F.col("timestamp").alias("_kafka_timestamp")`);
        });
        b.line(')');
      }
    } else if (valueFormat === 'avro') {
      b.line(`# Avro deserialization requires spark-avro dependency`);
      b.line(`${varName} = ${varName}_raw.select(`);
      b.indent(b2 => {
        b2.line(`F.col("key").cast("string").alias("_kafka_key"),`);
        b2.line(`F.from_avro(F.col("value"), _avro_schema_${varName}).alias("_data"),`);
        b2.line(`F.col("timestamp").alias("_kafka_timestamp")`);
      });
      b.line(').select("_kafka_key", "_data.*", "_kafka_timestamp")');
    } else {
      b.line(`${varName} = ${varName}_raw.select(`);
      b.indent(b2 => {
        b2.line(`F.col("key").cast("string").alias("_kafka_key"),`);
        b2.line(`F.col("value").cast("string").alias("_value"),`);
        b2.line(`F.col("timestamp").alias("_kafka_timestamp")`);
      });
      b.line(')');
    }

    return b.build();
  }
}
