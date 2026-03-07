/**
 * Integration test / demo for the PySpark Code Generation Engine.
 * Run: ts-node src/codegen/__tests__/pyspark.integration.test.ts
 */

import { codegenService } from '../codegen.service';
import { PipelineDefinition } from '../core/types/pipeline.types';

// ─── Sample Pipeline: Customer Orders ETL ─────────────────────────────────────

const samplePipeline: PipelineDefinition = {
  id: 'pipeline-customer-orders-001',
  name: 'Customer Orders ETL',
  version: '1.0.0',
  description: 'Loads customer and orders from PostgreSQL, joins, aggregates, and writes to Delta Lake',

  environment: {
    sparkVersion: '3.5',
    technology: 'pyspark',
    enableDeltaLake: true,
    pythonVersion: '3.10',
  },

  sparkConfig: {
    appName: 'customer-orders-etl',
    master: 'yarn',
    deployMode: 'cluster',
    driverMemory: '4g',
    executorMemory: '8g',
    executorCores: 4,
    numExecutors: 10,
    shufflePartitions: 400,
    adaptiveQueryExecution: true,
    dynamicAllocation: true,
    minExecutors: 2,
    maxExecutors: 20,
  },

  secrets: ['DB_CREDS'],
  variables: {
    RUN_DATE: '2024-01-01',
    BATCH_SIZE: '100000',
  },

  nodes: [
    // ─── Source 1: Customers from PostgreSQL ───────────────────────────────────
    {
      id: 'src-customers',
      name: 'Source Customers',
      type: 'source',
      sourceType: 'jdbc',
      inputs: [],
      config: {
        url: 'jdbc:postgresql://db.prod.internal:5432/crm',
        driver: 'org.postgresql.Driver',
        table: 'public.customers',
        passwordSecret: 'DB_CREDS',
        numPartitions: 20,
        partitionColumn: 'customer_id',
        lowerBound: 1,
        upperBound: 10000000,
        fetchSize: 50000,
      },
    },

    // ─── Source 2: Orders from S3 Parquet ─────────────────────────────────────
    {
      id: 'src-orders',
      name: 'Source Orders Parquet',
      type: 'source',
      sourceType: 'file',
      inputs: [],
      config: {
        path: 's3a://datalake-prod/raw/orders/dt={RUN_DATE}',
        format: 'parquet',
        mergeSchema: false,
      },
    },

    // ─── Transform 1: Filter active customers ────────────────────────────────
    {
      id: 'tx-filter-customers',
      name: 'Filter Active Customers',
      type: 'transformation',
      transformationType: 'filter',
      inputs: ['src-customers'],
      config: {
        condition: "status = 'ACTIVE' AND created_date >= '2020-01-01'",
      },
    },

    // ─── Transform 2: Select & rename customer columns ───────────────────────
    {
      id: 'tx-select-customers',
      name: 'Select Customer Columns',
      type: 'transformation',
      transformationType: 'select',
      inputs: ['tx-filter-customers'],
      config: {
        columns: ['customer_id', 'email', 'country_code', 'created_date'],
        expressions: {
          full_name: "concat(first_name, ' ', last_name)",
          customer_tier: "CASE WHEN lifetime_value > 10000 THEN 'GOLD' WHEN lifetime_value > 1000 THEN 'SILVER' ELSE 'BRONZE' END",
        },
      },
    },

    // ─── Transform 3: Filter orders (last 90 days) ───────────────────────────
    {
      id: 'tx-filter-orders',
      name: 'Filter Recent Orders',
      type: 'transformation',
      transformationType: 'filter',
      inputs: ['src-orders'],
      config: {
        condition: "order_status IN ('COMPLETED', 'SHIPPED') AND order_date >= date_sub(current_date(), 90)",
      },
    },

    // ─── Transform 4: Dedup orders ───────────────────────────────────────────
    {
      id: 'tx-dedup-orders',
      name: 'Dedup Orders',
      type: 'transformation',
      transformationType: 'dedup',
      inputs: ['tx-filter-orders'],
      config: {
        columns: ['order_id'],
      },
    },

    // ─── Transform 5: Data Quality check on orders ───────────────────────────
    {
      id: 'tx-dq-orders',
      name: 'Orders Data Quality',
      type: 'transformation',
      transformationType: 'data_quality',
      inputs: ['tx-dedup-orders'],
      config: {
        rules: [
          { name: 'order_id_not_null', type: 'not_null', column: 'order_id' },
          { name: 'customer_id_not_null', type: 'not_null', column: 'customer_id' },
          { name: 'amount_positive', type: 'range', column: 'order_amount', params: { min: 0 } },
        ],
        failureAction: 'quarantine',
        quarantinePath: 's3a://datalake-prod/quarantine/orders/',
      },
    },

    // ─── Transform 6: Join customers + orders ────────────────────────────────
    {
      id: 'tx-join',
      name: 'Join Customers Orders',
      type: 'transformation',
      transformationType: 'join',
      inputs: ['tx-select-customers', 'tx-dq-orders'],
      config: {
        rightInput: 'tx-dq-orders',
        type: 'inner',
        conditions: [{ leftColumn: 'customer_id', rightColumn: 'customer_id' }],
        broadcastHint: 'none',
      },
    },

    // ─── Transform 7: Aggregate order totals per customer ────────────────────
    {
      id: 'tx-agg',
      name: 'Aggregate Order Totals',
      type: 'transformation',
      transformationType: 'aggregate',
      inputs: ['tx-join'],
      config: {
        groupBy: ['customer_id', 'full_name', 'country_code', 'customer_tier'],
        aggregations: [
          { function: 'sum', column: 'order_amount', alias: 'total_spend' },
          { function: 'count', column: 'order_id', alias: 'order_count' },
          { function: 'max', column: 'order_date', alias: 'last_order_date' },
          { function: 'avg', column: 'order_amount', alias: 'avg_order_value' },
        ],
      },
    },

    // ─── Transform 8: Window - rank customers by spend ───────────────────────
    {
      id: 'tx-window',
      name: 'Rank Customers By Spend',
      type: 'transformation',
      transformationType: 'window',
      inputs: ['tx-agg'],
      config: {
        partitionBy: ['country_code'],
        orderBy: [{ column: 'total_spend', direction: 'desc' }],
        windowFunctions: [
          { function: 'rank', alias: 'spend_rank' },
          { function: 'row_number', alias: 'row_num' },
          { function: 'sum', column: 'total_spend', alias: 'cumulative_spend', },
        ],
        rowsBetween: ['unbounded', 'unbounded'],
      },
    },

    // ─── Transform 9: Derive enriched columns ────────────────────────────────
    {
      id: 'tx-derive',
      name: 'Enrich With Metadata',
      type: 'transformation',
      transformationType: 'derive',
      inputs: ['tx-window'],
      config: {
        columns: [
          { name: 'is_top_10_pct', expression: 'spend_rank <= (0.1 * count(*) over (partition by country_code))' },
          { name: 'etl_load_timestamp', expression: 'current_timestamp()' },
          { name: 'etl_pipeline_id', expression: "'pipeline-customer-orders-001'" },
        ],
      },
    },

    // ─── Sink 1: Write to Delta Lake ─────────────────────────────────────────
    {
      id: 'sink-delta',
      name: 'Sink Customer Summary Delta',
      type: 'sink',
      sinkType: 'delta',
      inputs: ['tx-derive'],
      config: {
        path: 's3a://datalake-prod/curated/customer_order_summary',
        mode: 'overwrite',
        partitionBy: ['country_code'],
        optimizeWrite: true,
        autoCompact: true,
        zorderBy: ['customer_id'],
      },
    },

    // ─── Sink 2: Also write aggregates to PostgreSQL DWH ─────────────────────
    {
      id: 'sink-jdbc',
      name: 'Sink To DWH PostgreSQL',
      type: 'sink',
      sinkType: 'jdbc',
      inputs: ['tx-derive'],
      config: {
        url: 'jdbc:postgresql://dwh.prod.internal:5432/analytics',
        driver: 'org.postgresql.Driver',
        table: 'analytics.customer_order_summary',
        mode: 'overwrite',
        passwordSecret: 'DB_CREDS',
        batchSize: 5000,
        truncate: true,
      },
    },
  ],
};

// ─── Run the generator ────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(80));
  console.log('PySpark Code Generation Engine — Integration Test');
  console.log('='.repeat(80));
  console.log();

  codegenService.initialize();
  console.log('Registered technologies:', codegenService.listTechnologies().join(', '));
  console.log();

  // Validate first
  console.log('Validating pipeline...');
  const validation = codegenService.validate(samplePipeline);
  console.log(`Validation: ${validation.valid ? '✓ PASSED' : '✗ FAILED'}`);
  if (validation.errors.length > 0) {
    validation.errors.forEach(e => console.error(`  ERROR [${e.code}]: ${e.message}`));
    process.exit(1);
  }
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(`  WARN  [${w.code}]: ${w.message}`));
  }
  console.log();

  // Generate
  console.log('Generating PySpark code...');
  const artifact = await codegenService.generate(samplePipeline, {
    includeComments: true,
    includeLogging: true,
    includeDataQuality: true,
    targetPlatform: 'emr',
    secretsBackend: 'aws_secretsmanager',
  });

  console.log(`Generated artifact for: ${artifact.pipelineName}`);
  console.log(`Files generated: ${artifact.files.length}`);
  artifact.files.forEach(f => {
    const lines = f.content.split('\n').length;
    console.log(`  - ${f.relativePath}/${f.fileName}  (${lines} lines, ${f.language})`);
  });
  console.log();

  // Metadata
  const meta = artifact.metadata;
  console.log('Metadata:');
  console.log(`  Nodes: ${meta.nodeCount} (${meta.sourceCount} src, ${meta.transformationCount} tx, ${meta.sinkCount} sink)`);
  console.log(`  Estimated lines: ${meta.estimatedLineCount}`);
  console.log(`  Generator version: ${meta.generatorVersion}`);
  console.log(`  Warnings: ${meta.warnings.length}`);
  meta.warnings.forEach(w => console.log(`    [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`));
  console.log();

  // Print the generated Python script
  const mainFile = artifact.files.find(f => f.isEntryPoint);
  if (mainFile) {
    console.log('='.repeat(80));
    console.log('GENERATED FILE:', mainFile.fileName);
    console.log('='.repeat(80));
    console.log(mainFile.content);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
