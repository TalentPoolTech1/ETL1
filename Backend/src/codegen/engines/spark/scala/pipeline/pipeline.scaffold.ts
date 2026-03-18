import { PipelineDefinition } from '../../../../core/types/pipeline.types';
import { GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { ScalaCodeBuilder, scalaString } from '../scala.utils';
import { SPARK_DEFAULTS } from '../../../../core/constants/codegen.constants';

// ─── Scala Pipeline Scaffold ──────────────────────────────────────────────────

export class ScalaPipelineScaffold {

  generateHeader(pipeline: PipelineDefinition): string {
    const b = new ScalaCodeBuilder();
    b.line(`// =============================================================================`);
    b.line(`// Pipeline  : ${pipeline.name}`);
    b.line(`// Version   : ${pipeline.version}`);
    b.line(`// Generated : ${new Date().toISOString()}`);
    if (pipeline.description) b.line(`// Desc      : ${pipeline.description}`);
    b.line(`// IMPORTANT : AUTO-GENERATED. Do not edit manually.`);
    b.line(`// =============================================================================`);
    b.blank();
    b.line(`package com.etl.pipelines`);
    b.blank();
    return b.build();
  }

  generateImports(context: GenerationContext): string {
    const b = new ScalaCodeBuilder();
    const allImports = new Set<string>([
      'import org.apache.spark.sql.SparkSession',
      'import org.apache.spark.sql.{DataFrame, Dataset, Row}',
      'import org.apache.spark.sql.functions._',
      'import org.apache.spark.sql.types._',
      'import org.apache.spark.sql.expressions.Window',
      'import org.slf4j.{Logger, LoggerFactory}',
      'import scala.util.{Try, Success, Failure}',
    ]);

    const env = context.pipeline.environment;
    if (env.enableDeltaLake) allImports.add('import io.delta.tables.DeltaTable');
    if (env.enableIceberg) allImports.add('// Iceberg: configured via SparkSession extensions');

    [...context.imports].forEach(i => allImports.add(i));
    [...allImports].sort().forEach(i => b.line(i));
    b.blank();
    return b.build();
  }

  generateObjectOpen(pipeline: PipelineDefinition): string {
    const b = new ScalaCodeBuilder();
    const objectName = pipeline.name.replace(/[^a-zA-Z0-9]/g, '') + 'Job';
    b.line(`object ${objectName} {`);
    b.blank();
    b.indent(b2 => {
      b2.line(`private val logger: Logger = LoggerFactory.getLogger(getClass)`);
      b2.blank();
    });
    return b.build();
  }

  generateSparkSession(pipeline: PipelineDefinition, context: GenerationContext): string {
    const b = new ScalaCodeBuilder();
    const sc = pipeline.sparkConfig;
    const env = pipeline.environment;
    const appName = sc.appName || pipeline.name;

    b.indent(b2 => {
      b2.line(`def createSparkSession(): SparkSession = {`);
      b2.indent(b3 => {
        b3.line(`val builder = SparkSession.builder()`);
        b3.indent(b4 => {
          b4.line(`.appName(${scalaString(appName)})`);
          if (sc.master) b4.line(`.master(${scalaString(sc.master)})`);
          b4.line(`.config("spark.sql.shuffle.partitions", ${sc.shufflePartitions ?? SPARK_DEFAULTS.SHUFFLE_PARTITIONS})`);
          if (sc.adaptiveQueryExecution !== false) {
            b4.line(`.config("spark.sql.adaptive.enabled", "true")`);
            b4.line(`.config("spark.sql.adaptive.coalescePartitions.enabled", "true")`);
            b4.line(`.config("spark.sql.adaptive.skewJoin.enabled", "true")`);
          }
          if (env.enableDeltaLake) {
            b4.line(`.config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")`);
            b4.line(`.config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")`);
          }
          if (env.enableIceberg) {
            const ext = env.enableDeltaLake
              ? 'io.delta.sql.DeltaSparkSessionExtension,org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions'
              : 'org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions';
            b4.line(`.config("spark.sql.extensions", ${scalaString(ext)})`);
          }
          if (sc.extraSparkConf) {
            Object.entries(sc.extraSparkConf).forEach(([k, v]) => b4.line(`.config(${scalaString(k)}, ${scalaString(v)})`));
          }
        });

        b3.blank();
        b3.line(`Try(builder.enableHiveSupport().getOrCreate()) match {`);
        b3.indent(b4 => {
          b4.line(`case Success(spark) => spark`);
          b4.line(`case Failure(_)     => builder.getOrCreate()`);
        });
        b3.line('}');
      });
      b2.line('}');
      b2.blank();
    });

    return b.build();
  }

  generateMainMethod(pipeline: PipelineDefinition): string {
    const b = new ScalaCodeBuilder();
    b.indent(b2 => {
      b2.line(`def main(args: Array[String]): Unit = {`);
      b2.indent(b3 => {
        b3.line(`val spark = createSparkSession()`);
        b3.line(`val startTime = System.currentTimeMillis()`);
        b3.blank();
        b3.line(`logger.info(s"Starting pipeline: ${pipeline.name} v${pipeline.version}")`);
        b3.blank();
        b3.line(`Try(runPipeline(spark)) match {`);
        b3.indent(b4 => {
          b4.line(`case Success(_) =>`);
          b4.indent(b5 => {
            b5.line(`val duration = (System.currentTimeMillis() - startTime) / 1000.0`);
            b5.line(`logger.info(s"Pipeline '${pipeline.name}' completed in $$duration s")`);
          });
          b4.line(`case Failure(ex) =>`);
          b4.indent(b5 => {
            b5.line(`logger.error(s"Pipeline '${pipeline.name}' FAILED: \${ex.getMessage}", ex)`);
            b5.line(`System.exit(1)`);
          });
        });
        b3.line(`}`);
        b3.blank();
        b3.line(`spark.stop()`);
      });
      b2.line('}');
      b2.blank();
    });
    return b.build();
  }

  generateObjectClose(): string {
    return `}\n`;
  }

  generateBuildSbt(pipeline: PipelineDefinition): string {
    const sparkVersion = pipeline.environment.sparkVersion ?? '3.5';
    const scalaVersion = '2.12.18';
    const lines = [
      `// Auto-generated build.sbt for: ${pipeline.name}`,
      ``,
      `name := "${pipeline.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}"`,
      `version := "${pipeline.version}"`,
      `scalaVersion := "${scalaVersion}"`,
      ``,
      `val sparkVersion = "${sparkVersion}.0"`,
      ``,
      `libraryDependencies ++= Seq(`,
      `  "org.apache.spark" %% "spark-core"    % sparkVersion % "provided",`,
      `  "org.apache.spark" %% "spark-sql"     % sparkVersion % "provided",`,
      `  "org.apache.spark" %% "spark-hive"    % sparkVersion % "provided",`,
    ];

    if (pipeline.environment.enableDeltaLake) {
      lines.push(`  "io.delta"         %% "delta-core"   % "2.4.0",`);
    }
    if (pipeline.environment.enableIceberg) {
      lines.push(`  "org.apache.iceberg" % "iceberg-spark-runtime-3.4_2.12" % "1.3.1",`);
    }

    lines.push(
      `  "org.slf4j"         % "slf4j-api"    % "1.7.36",`,
      `  "ch.qos.logback"    % "logback-classic" % "1.2.12"`,
      `)`,
      ``,
      `assemblyMergeStrategy in assembly := {`,
      `  case PathList("META-INF", xs @ _*) => MergeStrategy.discard`,
      `  case x => MergeStrategy.first`,
      `}`,
    );
    return lines.join('\n');
  }
}
