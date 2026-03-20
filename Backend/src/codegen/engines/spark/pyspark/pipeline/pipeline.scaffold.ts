import { GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineDefinition } from '../../../../core/types/pipeline.types';
import { CodeBuilder, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS, SPARK_DEFAULTS } from '../../../../core/constants/codegen.constants';

// ─── PySpark Pipeline Scaffolding ─────────────────────────────────────────────
// Generates the top (header, imports, SparkSession, args) and
// bottom (cleanup, entrypoint) scaffolding for a pipeline script.

export class PySparkPipelineScaffold {
  generateHeader(pipeline: PipelineDefinition, context: GenerationContext): string {
    const b = new CodeBuilder();
    const appName = pipeline.sparkConfig.appName || pipeline.name;

    b.line('#!/usr/bin/env python3');
    b.line('# -*- coding: utf-8 -*-');
    b.line(`# =============================================================================`);
    b.line(`# Pipeline  : ${pipeline.name}`);
    b.line(`# Version   : ${pipeline.version}`);
    b.line(`# Generated : ${new Date().toISOString()}`);
    if (pipeline.description) b.line(`# Desc      : ${pipeline.description}`);
    b.line(`# IMPORTANT : This file is AUTO-GENERATED. Do not edit manually.`);
    b.line(`#             Re-generate from the ETL platform UI to apply changes.`);
    b.line(`# =============================================================================`);
    b.blank(2);

    // Sorted, deduplicated imports
    const allImports = new Set<string>([
      PYSPARK_IMPORTS.SPARK_SESSION,
      PYSPARK_IMPORTS.FUNCTIONS,
      PYSPARK_IMPORTS.TYPES,
      PYSPARK_IMPORTS.LOGGING,
      PYSPARK_IMPORTS.SYS,
      PYSPARK_IMPORTS.OS,
      PYSPARK_IMPORTS.ARGPARSE,
      PYSPARK_IMPORTS.DATETIME,
    ]);

    [...context.imports].forEach(i => allImports.add(i));

    if (pipeline.environment.enableDeltaLake) allImports.add('from delta import configure_spark_with_delta_pip');
    if (pipeline.environment.enableIceberg) allImports.add('# Iceberg: configure via spark session extensions');

    // Group imports
    const stdLibImports: string[] = [];
    const pysparkImports: string[] = [];
    const thirdPartyImports: string[] = [];

    [...allImports].forEach(imp => {
      if (imp.startsWith('from pyspark') || imp.startsWith('import pyspark')) pysparkImports.push(imp);
      else if (imp.startsWith('import ') && !imp.includes('.')) stdLibImports.push(imp);
      else thirdPartyImports.push(imp);
    });

    stdLibImports.sort().forEach(i => b.line(i));
    b.blank();
    pysparkImports.sort().forEach(i => b.line(i));
    if (thirdPartyImports.length > 0) {
      b.blank();
      thirdPartyImports.sort().forEach(i => b.line(i));
    }
    b.blank(2);

    // Logger setup
    b.line(`logging.basicConfig(`);
    b.indent(b2 => {
      b2.line(`level=logging.INFO,`);
      b2.line(`format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",`);
      b2.line(`handlers=[logging.StreamHandler(sys.stdout)]`);
    });
    b.line(')');
    b.line(`logger = logging.getLogger(${pyStringLiteral(pipeline.name)})`);
    b.blank(2);

    return b.build();
  }

  generateArgsParser(pipeline: PipelineDefinition): string {
    const b = new CodeBuilder();

    b.line(`def _parse_args():`);
    b.indent(b2 => {
      b2.line(`parser = argparse.ArgumentParser(`);
      b2.indent(b3 => {
        b3.line(`description=${pyStringLiteral(pipeline.description ?? pipeline.name)}`);
      });
      b2.line(')');

      // Standard args
      b2.line(`parser.add_argument("--env", default="prod", help="Execution environment")`);
      b2.line(`parser.add_argument("--log-level", default="INFO", help="Logging level")`);

      // Pipeline variables as args
      if (pipeline.variables) {
        Object.entries(pipeline.variables).forEach(([k, v]) => {
          b2.line(`parser.add_argument(${pyStringLiteral(`--${k.replace(/_/g, '-')}`)}, default=${pyStringLiteral(v)}, help=${pyStringLiteral(`Variable: ${k}`)})`);
        });
      }

      b2.line(`return parser.parse_args()`);
    });
    b.blank();

    return b.build();
  }

  generateSparkSession(pipeline: PipelineDefinition, context: GenerationContext): string {
    const b = new CodeBuilder();
    const sc = pipeline.sparkConfig;
    const env = pipeline.environment;
    const appName = sc.appName || pipeline.name;

    b.line(`def _create_spark_session(args):`);
    b.indent(b2 => {
      b2.line(`builder = (`);
      b2.indent(b3 => {
        b3.line(`SparkSession.builder`);
        b3.indent(b4 => {
          b4.line(`.appName(${pyStringLiteral(appName)})`);
          if (sc.master) b4.line(`.master(${pyStringLiteral(sc.master)})`);

          // Shuffle partitions
          const shuffle = sc.shufflePartitions ?? SPARK_DEFAULTS.SHUFFLE_PARTITIONS;
          b4.line(`.config("spark.sql.shuffle.partitions", ${shuffle})`);

          if (sc.adaptiveQueryExecution !== false) {
            b4.line(`.config("spark.sql.adaptive.enabled", "true")`);
            b4.line(`.config("spark.sql.adaptive.coalescePartitions.enabled", "true")`);
            b4.line(`.config("spark.sql.adaptive.skewJoin.enabled", "true")`);
          }

          if (sc.dynamicAllocation) {
            b4.line(`.config("spark.dynamicAllocation.enabled", "true")`);
            if (sc.minExecutors !== undefined) b4.line(`.config("spark.dynamicAllocation.minExecutors", ${sc.minExecutors})`);
            if (sc.maxExecutors !== undefined) b4.line(`.config("spark.dynamicAllocation.maxExecutors", ${sc.maxExecutors})`);
          }

          if (env.enableDeltaLake) {
            b4.line(`.config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")`);
            b4.line(`.config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")`);
          }

          if (env.enableIceberg) {
            const extensions = env.enableDeltaLake
              ? 'io.delta.sql.DeltaSparkSessionExtension,org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions'
              : 'org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions';
            b4.line(`.config("spark.sql.extensions", ${pyStringLiteral(extensions)})`);
            b4.line(`.config("spark.sql.catalog.spark_catalog", "org.apache.iceberg.spark.SparkSessionCatalog")`);
          }

          if (env.enableGlue) {
            b4.line(`.config("spark.sql.catalog.glue", "org.apache.iceberg.spark.SparkCatalog")`);
            b4.line(`.config("spark.sql.catalog.glue.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")`);
          }

          // Target platform specific
          switch (context.options.targetPlatform) {
            case 'databricks':
              b4.line(`.config("spark.databricks.delta.preview.enabled", "true")`);
              break;
            case 'emr':
              b4.line(`.config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")`);
              b4.line(`.config("spark.hadoop.fs.s3a.aws.credentials.provider", "com.amazonaws.auth.InstanceProfileCredentialsProvider")`);
              break;
            case 'dataproc':
              b4.line(`.config("spark.hadoop.google.cloud.auth.service.account.enable", "true")`);
              break;
          }

          // Extra spark config
          if (sc.extraSparkConf) {
            Object.entries(sc.extraSparkConf).forEach(([k, v]) => {
              b4.line(`.config(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`);
            });
          }
        });
      });
      b2.line(')');
      b2.blank();

      if (env.enableDeltaLake) {
        b2.line(`try:`);
        b2.indent(b3 => {
          b3.line(`from delta import configure_spark_with_delta_pip`);
          b3.line(`builder = configure_spark_with_delta_pip(builder)`);
        });
        b2.line(`except ImportError:`);
        b2.indent(b3 => {
          b3.line(`pass  # Delta Lake jars expected to be on classpath`);
        });
        b2.blank();
      }

      // Only enable Hive metastore integration when Hudi or explicit Hive is needed
      if (env.enableHudi) {
        b2.line(`spark = builder.enableHiveSupport().getOrCreate()`);
      } else {
        b2.line(`spark = builder.getOrCreate()`);
      }
      b2.blank();
      b2.line(`spark.sparkContext.setLogLevel(args.log_level)`);
      b2.blank();
      b2.line(`logger.info(f"SparkSession created: {spark.version} | App: {spark.sparkContext.appName}")`);
      b2.line(`return spark`);
    });
    b.blank(2);

    return b.build();
  }

  generateSecretsHelper(pipeline: PipelineDefinition, context: GenerationContext): string {
    if (!pipeline.secrets || pipeline.secrets.length === 0) return '';

    const b = new CodeBuilder();
    const backend = context.options.secretsBackend ?? 'env';

    b.line(`# ─── Secrets Helper ${'─'.repeat(52)}`);
    b.blank();

    switch (backend) {
      case 'aws_secretsmanager':
        b.line(`import boto3, json as _json`);
        b.blank();
        b.line(`def _get_secret(secret_name: str) -> dict:`);
        b.indent(b2 => {
          b2.line(`client = boto3.client("secretsmanager")`);
          b2.line(`response = client.get_secret_value(SecretId=secret_name)`);
          b2.line(`return _json.loads(response["SecretString"])`);
        });
        break;
      case 'azure_keyvault':
        b.line(`from azure.identity import DefaultAzureCredential`);
        b.line(`from azure.keyvault.secrets import SecretClient`);
        b.blank();
        b.line(`def _get_secret(secret_name: str) -> str:`);
        b.indent(b2 => {
          b2.line(`vault_url = os.environ["AZURE_KEY_VAULT_URL"]`);
          b2.line(`client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential())`);
          b2.line(`return client.get_secret(secret_name).value`);
        });
        break;
      case 'gcp_secretmanager':
        b.line(`from google.cloud import secretmanager`);
        b.blank();
        b.line(`def _get_secret(secret_name: str, project_id: str = None) -> str:`);
        b.indent(b2 => {
          b2.line(`client = secretmanager.SecretManagerServiceClient()`);
          b2.line(`project = project_id or os.environ["GCP_PROJECT_ID"]`);
          b2.line(`name = f"projects/{project}/secrets/{secret_name}/versions/latest"`);
          b2.line(`response = client.access_secret_version(name=name)`);
          b2.line(`return response.payload.data.decode("UTF-8")`);
        });
        break;
      default:
        b.line(`def _get_secret(key: str) -> str:`);
        b.indent(b2 => {
          b2.line(`value = os.environ.get(key)`);
          b2.line(`if value is None:`);
          b2.indent(b3 => {
            b3.line(`raise ValueError(f"Required secret/env var '{key}' not found")`);
          });
          b2.line(`return value`);
        });
    }

    b.blank(2);
    return b.build();
  }

  generateEntrypoint(pipeline: PipelineDefinition, mainFunctionName = 'run_pipeline'): string {
    const b = new CodeBuilder();

    b.line(`# ─── Entrypoint ${'─'.repeat(55)}`);
    b.blank();
    b.line(`if __name__ == "__main__":`);
    b.indent(b2 => {
      b2.line(`args = _parse_args()`);
      b2.line(`logging.getLogger().setLevel(getattr(logging, args.log_level.upper(), logging.INFO))`);
      b2.blank();
      b2.line(`logger.info(f"Starting pipeline: ${pipeline.name} v${pipeline.version}")`);
      b2.line(`logger.info(f"Environment: {args.env}")`);
      b2.blank();
      b2.line(`spark = _create_spark_session(args)`);
      b2.line(`start_time = datetime.now()`);
      b2.blank();
      b2.line(`try:`);
      b2.indent(b3 => {
        b3.line(`${mainFunctionName}(spark, args)`);
        b3.line(`duration = (datetime.now() - start_time).total_seconds()`);
        b3.line(`logger.info(f"Pipeline '${pipeline.name}' completed successfully in {duration:.2f}s")`);
      });
      b2.line(`except Exception as e:`);
      b2.indent(b3 => {
        b3.line(`logger.exception(f"Pipeline '${pipeline.name}' FAILED: {e}")`);
        b3.line(`sys.exit(1)`);
      });
      b2.line(`finally:`);
      b2.indent(b3 => {
        b3.line(`spark.stop()`);
        b3.line(`logger.info("SparkSession stopped")`);
      });
    });

    return b.build();
  }
}
