// ─── Pipeline DAG Types ────────────────────────────────────────────────────────
// Canonical input types consumed by ALL code generation engines.
// PySpark, Scala-Spark, SQL, Pandas all read from this single contract.

export type NodeType = 'source' | 'transformation' | 'sink';
export type TechnologyType = 'pyspark' | 'scala-spark' | 'sql' | 'pandas';
export type SparkVersion = '3.5' | '3.4' | '3.3' | '3.2' | '3.1' | '2.4';
export type FileFormat = 'parquet' | 'csv' | 'json' | 'orc' | 'avro' | 'delta' | 'iceberg' | 'hudi';
export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross' | 'left_semi' | 'left_anti';
export type AggregateFunction =
  | 'sum' | 'count' | 'avg' | 'min' | 'max'
  | 'first' | 'last' | 'collect_list' | 'collect_set' | 'countDistinct';
export type OrderDirection = 'asc' | 'desc';
export type WriteMode = 'overwrite' | 'append' | 'ignore' | 'error' | 'merge';
export type PartitionStrategy = 'none' | 'hash' | 'range' | 'round_robin';

// ─── Data Types ────────────────────────────────────────────────────────────────

export type DataTypeName =
  | 'string' | 'integer' | 'long' | 'double' | 'float' | 'decimal'
  | 'boolean' | 'date' | 'timestamp' | 'binary' | 'array' | 'map' | 'struct';

export interface DataType {
  name: DataTypeName;
  nullable?: boolean;
  precision?: number;
  scale?: number;
  elementType?: DataType;
  keyType?: DataType;
  valueType?: DataType;
  fields?: SchemaField[];
}

export interface SchemaField {
  name: string;
  dataType: DataType;
  nullable?: boolean;
  description?: string;
  tags?: Record<string, string>;
}

export interface Schema {
  fields: SchemaField[];
}

// ─── Source Configurations ─────────────────────────────────────────────────────

export type SourceType =
  | 'jdbc' | 'file' | 'kafka' | 'hive' | 'delta' | 'iceberg'
  | 's3' | 'adls' | 'gcs' | 'hdfs' | 'api' | 'mongodb' | 'cassandra';

export interface JdbcSourceConfig {
  url: string;
  driver: string;
  table?: string;
  query?: string;
  user?: string;
  password?: string;
  passwordSecret?: string;
  numPartitions?: number;
  partitionColumn?: string;
  lowerBound?: number;
  upperBound?: number;
  fetchSize?: number;
  pushDownPredicate?: boolean;
  customOptions?: Record<string, string>;
}

export interface FileSourceConfig {
  path: string;
  format: FileFormat;
  schema?: Schema;
  inferSchema?: boolean;
  header?: boolean;
  delimiter?: string;
  multiLine?: boolean;
  mergeSchema?: boolean;
  pathGlobFilter?: string;
  modifiedBefore?: string;
  modifiedAfter?: string;
  recursiveFileLookup?: boolean;
  customOptions?: Record<string, string>;
}

export interface KafkaSourceConfig {
  bootstrapServers: string;
  topic: string;
  startingOffsets?: 'earliest' | 'latest' | string;
  endingOffsets?: 'latest' | string;
  groupId?: string;
  keyDeserializer?: string;
  valueDeserializer?: string;
  schemaRegistryUrl?: string;
  valueFormat?: 'json' | 'avro' | 'protobuf' | 'string';
  valueSchema?: Schema;
  streaming?: boolean;
  triggerInterval?: string;
  watermarkDelay?: string;
  customOptions?: Record<string, string>;
}

export interface HiveSourceConfig {
  database: string;
  table: string;
  partitionFilter?: string;
  pushDownPredicate?: boolean;
}

export interface DeltaSourceConfig {
  path?: string;
  tableName?: string;
  version?: number;
  timestamp?: string;
  readChangeFeed?: boolean;
  startingVersion?: number;
  startingTimestamp?: string;
}

export interface IcebergSourceConfig {
  catalog: string;
  namespace: string;
  table: string;
  snapshotId?: number;
  asOfTimestamp?: string;
  readChangelog?: boolean;
}

export interface MongoSourceConfig {
  uri: string;
  database: string;
  collection: string;
  pipeline?: string;
  partitionKey?: string;
  samplingRatio?: number;
  passwordSecret?: string;
  customOptions?: Record<string, string>;
}

export interface CassandraSourceConfig {
  host: string;
  port?: number;
  keyspace: string;
  table: string;
  user?: string;
  passwordSecret?: string;
  pushDownPredicate?: boolean;
  customOptions?: Record<string, string>;
}

export type SourceConfig =
  | JdbcSourceConfig
  | FileSourceConfig
  | KafkaSourceConfig
  | HiveSourceConfig
  | DeltaSourceConfig
  | IcebergSourceConfig
  | MongoSourceConfig
  | CassandraSourceConfig;

// ─── Transformation Configurations ────────────────────────────────────────────

export type TransformationType =
  | 'filter' | 'select' | 'rename' | 'drop' | 'cast'
  | 'join' | 'union' | 'aggregate' | 'window'
  | 'pivot' | 'unpivot' | 'flatten' | 'explode'
  | 'derive' | 'dedup' | 'sort' | 'limit'
  | 'fillna' | 'dropna' | 'lookup' | 'custom_sql'
  | 'custom_udf' | 'data_quality' | 'mask'
  | 'sample' | 'cache' | 'repartition'
  | 'multi_transform_sequence'
  | 'scd_type1' | 'scd_type2' | 'surrogate_key'
  | 'add_audit_columns'
  | 'case_when';

export interface FilterConfig {
  condition: string;
  mode?: 'INCLUDE' | 'EXCLUDE';
  conditionLanguage?: 'spark_sql';
}

export interface SelectConfig {
  columns: string[];
  expressions?: Record<string, string>;
}

export interface RenameConfig {
  mappings: Record<string, string>;
}

export interface CastConfig {
  casts: Array<{ column: string; targetType: DataType }>;
}

export interface DropConfig {
  columns: string[];
}

export interface JoinCondition {
  leftColumn: string;
  rightColumn: string;
}

export interface JoinConfig {
  rightInput: string;
  type: JoinType;
  conditions: JoinCondition[];
  broadcastHint?: 'left' | 'right' | 'none';
  skewHint?: boolean;
}

export interface UnionConfig {
  byName?: boolean;
  allowMissingColumns?: boolean;
}

export interface Aggregation {
  function: AggregateFunction;
  column: string;
  alias: string;
  distinct?: boolean;
}

export interface AggregateConfig {
  groupBy: string[];
  aggregations: Aggregation[];
  having?: string;
}

export interface OrderBySpec {
  column: string;
  direction: OrderDirection;
  nullsFirst?: boolean;
}

export interface WindowFunction {
  function: string;
  column?: string;
  offset?: number;
  defaultValue?: string;
  alias: string;
}

export interface WindowConfig {
  partitionBy: string[];
  orderBy: OrderBySpec[];
  windowFunctions: WindowFunction[];
  rowsBetween?: [number | 'unbounded', number | 'unbounded'];
  rangeBetween?: [number | 'unbounded', number | 'unbounded'];
}

export interface DeriveConfig {
  columns: Array<{ name: string; expression: string; dataType?: DataType }>;
}

export interface DedupConfig {
  columns?: string[];
  keepFirst?: boolean;
}

export interface SortConfig {
  orderBy: OrderBySpec[];
}

export interface LimitConfig {
  n: number;
}

export interface FillnaConfig {
  value?: string | number | boolean;
  columnValues?: Record<string, string | number | boolean>;
}

export interface DropnaConfig {
  columns?: string[];
  how?: 'any' | 'all';
}

export interface DQRule {
  name: string;
  column?: string;
  type: 'not_null' | 'unique' | 'range' | 'regex' | 'referential' | 'custom';
  params?: Record<string, string | number | boolean>;
  expression?: string;
}

export interface DataQualityConfig {
  rules: DQRule[];
  failureAction: 'fail' | 'warn' | 'drop' | 'quarantine';
  quarantinePath?: string;
}

export interface RepartitionConfig {
  numPartitions?: number;
  columns?: string[];
  strategy?: PartitionStrategy;
  coalesce?: boolean;
}

export interface CacheConfig {
  storageLevel?: 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'DISK_ONLY' | 'MEMORY_ONLY_SER' | 'MEMORY_AND_DISK_SER' | 'OFF_HEAP';
  eager?: boolean;
}

export interface CustomSqlConfig {
  sql: string;
  tempViewName?: string;
}

export interface CustomUdfConfig {
  functionName: string;
  language: 'python' | 'scala' | 'sql';
  returnType: DataType;
  code: string;
  columns: Array<{ inputColumns: string[]; outputColumn: string }>;
}

export interface MaskConfig {
  columns: Array<{
    name: string;
    strategy: 'hash' | 'truncate' | 'replace' | 'regex_replace' | 'null';
    params?: Record<string, string>;
  }>;
}

export interface LookupConfig {
  lookupDatasetNodeId: string;
  joinColumns: Record<string, string>;
  returnColumns: string[];
  defaultValues?: Record<string, string | number>;
  cacheEnabled?: boolean;
}

export interface SampleConfig {
  fraction: number;
  withReplacement?: boolean;
  seed?: number;
}

export interface PivotConfig {
  groupByColumns: string[];
  pivotColumn: string;
  pivotValues?: string[];
  aggregations: Aggregation[];
}

export interface UnpivotConfig {
  idColumns: string[];
  valueColumn: string;
  variableColumn: string;
  valueColumns: string[];
}

export interface ExplodeConfig {
  column: string;
  alias?: string;
  outer?: boolean;
}

export interface FlattenConfig {
  separator?: string;
  columns?: string[];
}

export interface ScdType1Config {
  mergeKeys: string[];
  updateColumns: string[];
}

export interface ScdType2Config {
  businessKeys: string[];
  trackingColumns: string[];
  effectiveDateColumn: string;
  endDateColumn: string;
  currentFlagColumn: string;
  endDateDefaultValue?: string;
  surrogateKeyColumn?: string;
}

export interface SurrogateKeyConfig {
  outputColumn: string;
  strategy: 'monotonically_increasing' | 'uuid' | 'row_number';
  partitionBy?: string[];
  orderBy?: OrderBySpec[];
}

// ─── Multi-Transform Sequence Config ──────────────────────────────────────────
// Mirrors the Frontend IR (Frontend/src/transformations/ir.ts).
// Stored in PipelineNode.config when transformationType === 'multi_transform_sequence'.

export interface MultiTransformIRStep {
  stepId: string;
  type: string;
  params: Record<string, unknown>;
  enabled: boolean;
  onError: 'FAIL' | 'RETURN_NULL' | 'USE_DEFAULT';
  defaultValue?: unknown;
}

export interface MultiTransformIRSequence {
  id: string;
  name: string;
  enabled?: boolean;
  columnId: string;
  columnName: string;
  sourceColumn?: string;
  targetEngine: 'spark' | 'postgresql' | 'redshift';
  steps: MultiTransformIRStep[];
  pipelineId: string;
  datasetId: string;
}

export interface MultiTransformNodeConfig {
  transformSequences: MultiTransformIRSequence[];
  executionStrategy?: 'SOURCE' | 'PYSPARK';
  cacheResults?: boolean;
}

export type TransformationConfig =
  | FilterConfig | SelectConfig | RenameConfig | CastConfig | DropConfig
  | JoinConfig | UnionConfig | AggregateConfig | WindowConfig
  | DeriveConfig | DedupConfig | SortConfig | LimitConfig
  | FillnaConfig | DropnaConfig | DataQualityConfig | RepartitionConfig
  | CacheConfig | CustomSqlConfig | CustomUdfConfig | MaskConfig
  | LookupConfig | SampleConfig | PivotConfig | UnpivotConfig
  | ExplodeConfig | FlattenConfig | MultiTransformNodeConfig
  | ScdType1Config | ScdType2Config | SurrogateKeyConfig;

// ─── Sink Configurations ───────────────────────────────────────────────────────

export type SinkType =
  | 'jdbc' | 'file' | 'kafka' | 'hive' | 'delta' | 'iceberg'
  | 's3' | 'adls' | 'gcs' | 'hdfs' | 'console' | 'noop';

export interface JdbcSinkConfig {
  url: string;
  driver: string;
  table: string;
  mode: WriteMode;
  user?: string;
  password?: string;
  passwordSecret?: string;
  batchSize?: number;
  truncate?: boolean;
  createTableOptions?: string;
  customOptions?: Record<string, string>;
}

export interface FileSinkConfig {
  path: string;
  format: FileFormat;
  mode: WriteMode;
  partitionBy?: string[];
  numPartitions?: number;
  compression?: string;
  header?: boolean;
  delimiter?: string;
  customOptions?: Record<string, string>;
}

export interface KafkaSinkConfig {
  bootstrapServers: string;
  topic: string;
  keyColumn?: string;
  valueFormat?: 'json' | 'avro' | 'string';
  schemaRegistryUrl?: string;
  customOptions?: Record<string, string>;
}

export interface HiveSinkConfig {
  database: string;
  table: string;
  mode: WriteMode;
  partitionBy?: string[];
  fileFormat?: FileFormat;
  createIfNotExists?: boolean;
}

export interface DeltaSinkConfig {
  path?: string;
  tableName?: string;
  mode: WriteMode;
  partitionBy?: string[];
  mergeKey?: string[];
  mergeCondition?: string;
  optimizeWrite?: boolean;
  autoCompact?: boolean;
  zorderBy?: string[];
}

export interface IcebergSinkConfig {
  catalog: string;
  namespace: string;
  table: string;
  mode: WriteMode;
  partitionSpec?: IcebergPartitionSpec[];
  mergeKey?: string[];
  createIfNotExists?: boolean;
}

export interface IcebergPartitionSpec {
  column: string;
  transform: 'identity' | 'year' | 'month' | 'day' | 'hour' | 'bucket' | 'truncate';
  param?: number;
}

export type SinkConfig =
  | JdbcSinkConfig | FileSinkConfig | KafkaSinkConfig
  | HiveSinkConfig | DeltaSinkConfig | IcebergSinkConfig;

// ─── Pipeline Node ─────────────────────────────────────────────────────────────

export interface PipelineNode {
  id: string;
  name: string;
  type: NodeType;
  sourceType?: SourceType;
  transformationType?: TransformationType;
  sinkType?: SinkType;
  config: SourceConfig | TransformationConfig | SinkConfig;
  inputs: string[];
  outputSchema?: Schema;
  description?: string;
  tags?: Record<string, string>;
  enabled?: boolean;
}

// ─── Pipeline Definition ───────────────────────────────────────────────────────

export interface SparkConfig {
  appName: string;
  master?: string;
  deployMode?: 'client' | 'cluster';
  executorMemory?: string;
  driverMemory?: string;
  executorCores?: number;
  numExecutors?: number;
  dynamicAllocation?: boolean;
  minExecutors?: number;
  maxExecutors?: number;
  shufflePartitions?: number;
  adaptiveQueryExecution?: boolean;
  extraSparkConf?: Record<string, string>;
}

export interface PipelineEnvironment {
  sparkVersion: SparkVersion;
  technology: TechnologyType;
  enableDeltaLake?: boolean;
  enableIceberg?: boolean;
  enableHudi?: boolean;
  enableGlue?: boolean;
  pythonVersion?: '3.8' | '3.9' | '3.10' | '3.11';
  extraDependencies?: string[];
}

export interface PipelineDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  environment: PipelineEnvironment;
  sparkConfig: SparkConfig;
  nodes: PipelineNode[];
  variables?: Record<string, string>;
  secrets?: string[];
  schedule?: string;
  tags?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}
