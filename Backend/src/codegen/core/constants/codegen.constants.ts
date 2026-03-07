// ─── Generator Constants ───────────────────────────────────────────────────────

export const GENERATOR_VERSION = '1.0.0';

export const SPARK_DEFAULTS = {
  SHUFFLE_PARTITIONS: 200,
  EXECUTOR_MEMORY: '4g',
  DRIVER_MEMORY: '2g',
  EXECUTOR_CORES: 2,
  FETCH_SIZE: 10000,
  BATCH_SIZE: 1000,
} as const;

export const PYSPARK_IMPORTS = {
  SPARK_SESSION: 'from pyspark.sql import SparkSession',
  FUNCTIONS: 'from pyspark.sql import functions as F',
  TYPES: 'from pyspark.sql import types as T',
  WINDOW: 'from pyspark.sql.window import Window',
  STREAMING: 'from pyspark.sql.streaming import StreamingQuery',
  ERRORS: 'from pyspark.sql.utils import AnalysisException',
  LOGGING: 'import logging',
  SYS: 'import sys',
  OS: 'import os',
  JSON: 'import json',
  DATETIME: 'from datetime import datetime',
  ARGPARSE: 'import argparse',
} as const;

export const SCALA_IMPORTS = {
  SPARK_SESSION: 'import org.apache.spark.sql.SparkSession',
  FUNCTIONS: 'import org.apache.spark.sql.functions._',
  TYPES: 'import org.apache.spark.sql.types._',
  WINDOW: 'import org.apache.spark.sql.expressions.Window',
  DATASET: 'import org.apache.spark.sql.{DataFrame, Dataset, Row}',
  STREAMING: 'import org.apache.spark.sql.streaming.StreamingQuery',
} as const;

export const DRIVER_MAP: Record<string, string> = {
  postgresql: 'org.postgresql.Driver',
  mysql: 'com.mysql.cj.jdbc.Driver',
  mssql: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
  oracle: 'oracle.jdbc.OracleDriver',
  redshift: 'com.amazon.redshift.jdbc42.Driver',
  snowflake: 'net.snowflake.client.jdbc.SnowflakeDriver',
  db2: 'com.ibm.db2.jcc.DB2Driver',
  teradata: 'com.teradata.jdbc.TeraDriver',
  bigquery: 'com.simba.googlebigquery.jdbc.Driver',
  synapse: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
};

export const COMPRESSION_MAP: Record<string, Record<string, string>> = {
  parquet: { default: 'snappy', options: 'snappy,gzip,lzo,brotli,lz4,zstd,none' },
  orc: { default: 'snappy', options: 'none,zlib,snappy,lzo' },
  json: { default: 'none', options: 'none,bzip2,gzip,lz4,snappy,deflate' },
  csv: { default: 'none', options: 'none,bzip2,gzip,lz4,snappy,deflate' },
  avro: { default: 'snappy', options: 'uncompressed,snappy,deflate,bzip2' },
};

export const VAR_NAME_SANITIZE_RE = /[^a-zA-Z0-9_]/g;
export const RESERVED_PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield',
]);

export const INDENT = '    ';  // 4 spaces (PySpark standard)
export const SCALA_INDENT = '  ';  // 2 spaces (Scala standard)
