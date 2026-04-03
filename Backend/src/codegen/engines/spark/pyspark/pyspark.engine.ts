import {
  ICodeEngine, GeneratedArtifact, GenerationContext, GenerationOptions,
  CodeFile, ArtifactMetadata
} from '../../../core/interfaces/engine.interfaces';
import { PipelineDefinition, PipelineNode, TechnologyType } from '../../../core/types/pipeline.types';
import { NodeGeneratorRegistry } from '../../../registry/node-generator.registry';
import { pipelineValidator } from '../../../validators/pipeline.validator';
import { topologicalSort } from '../../../utils/topo-sort';
import { toVarName, CodeBuilder } from '../../../utils/codegen.utils';
import { GENERATOR_VERSION, PYSPARK_IMPORTS } from '../../../core/constants/codegen.constants';

// Sources
import { PySparkJdbcSourceGenerator } from './sources/jdbc.source.generator';
import { PySparkFileSourceGenerator } from './sources/file.source.generator';
import { PySparkKafkaSourceGenerator } from './sources/kafka.source.generator';
import { PySparkDeltaSourceGenerator, PySparkHiveSourceGenerator, PySparkIcebergSourceGenerator } from './sources/delta-hive-iceberg.source.generator';

// Transformations - basic
import {
  PySparkFilterGenerator, PySparkSelectGenerator, PySparkRenameGenerator,
  PySparkCastGenerator, PySparkDropGenerator, PySparkDeriveGenerator,
  PySparkSortGenerator, PySparkDedupGenerator, PySparkFillnaGenerator,
  PySparkDropnaGenerator, PySparkLimitGenerator, PySparkMultiTransformGenerator,
} from './transformations/basic.transformation.generators';

// Transformations - advanced
import {
  PySparkJoinGenerator, PySparkUnionGenerator,
  PySparkAggregateGenerator, PySparkWindowGenerator
} from './transformations/advanced.transformation.generators';

// Transformations - special
import {
  PySparkPivotGenerator, PySparkUnpivotGenerator, PySparkExplodeGenerator,
  PySparkFlattenGenerator, PySparkCustomSqlGenerator, PySparkDataQualityGenerator,
  PySparkRepartitionGenerator, PySparkCacheGenerator, PySparkMaskGenerator
} from './transformations/special.transformation.generators';

// Transformations - extra
import {
  PySparkSampleGenerator, PySparkLookupGenerator, PySparkCustomUdfGenerator,
  PySparkAddAuditColumnsGenerator, PySparkCaseWhenGenerator
} from './transformations/extra.transformation.generators';

// Sinks
import {
  PySparkJdbcSinkGenerator, PySparkFileSinkGenerator, PySparkDeltaSinkGenerator,
  PySparkIcebergSinkGenerator, PySparkKafkaSinkGenerator, PySparkHiveSinkGenerator,
  PySparkConsoleSinkGenerator
} from './sinks/all.sink.generators';

// Scaffold
import { PySparkPipelineScaffold } from './pipeline/pipeline.scaffold';

// ─── PySpark Engine ────────────────────────────────────────────────────────────

export class PySparkEngine implements ICodeEngine {
  readonly technology: TechnologyType = 'pyspark';
  readonly supportedVersions = ['3.1', '3.2', '3.3', '3.4', '3.5'] as const;

  private readonly generatorRegistry: NodeGeneratorRegistry;
  private readonly scaffold: PySparkPipelineScaffold;

  constructor() {
    this.scaffold = new PySparkPipelineScaffold();
    this.generatorRegistry = new NodeGeneratorRegistry();
    this.registerAllGenerators();
  }

  private registerAllGenerators(): void {
    this.generatorRegistry.registerMany([
      // Sources
      new PySparkJdbcSourceGenerator(),
      new PySparkFileSourceGenerator(),
      new PySparkKafkaSourceGenerator(),
      new PySparkDeltaSourceGenerator(),
      new PySparkHiveSourceGenerator(),
      new PySparkIcebergSourceGenerator(),

      // Basic Transformations
      new PySparkFilterGenerator(),
      new PySparkSelectGenerator(),
      new PySparkRenameGenerator(),
      new PySparkCastGenerator(),
      new PySparkDropGenerator(),
      new PySparkDeriveGenerator(),
      new PySparkSortGenerator(),
      new PySparkDedupGenerator(),
      new PySparkFillnaGenerator(),
      new PySparkDropnaGenerator(),
      new PySparkLimitGenerator(),
      new PySparkMultiTransformGenerator(),

      // Advanced Transformations
      new PySparkJoinGenerator(),
      new PySparkUnionGenerator(),
      new PySparkAggregateGenerator(),
      new PySparkWindowGenerator(),

      // Special Transformations
      new PySparkPivotGenerator(),
      new PySparkUnpivotGenerator(),
      new PySparkExplodeGenerator(),
      new PySparkFlattenGenerator(),
      new PySparkCustomSqlGenerator(),
      new PySparkDataQualityGenerator(),
      new PySparkRepartitionGenerator(),
      new PySparkCacheGenerator(),
      new PySparkMaskGenerator(),

      // Extra Transformations
      new PySparkSampleGenerator(),
      new PySparkLookupGenerator(),
      new PySparkCustomUdfGenerator(),
      new PySparkAddAuditColumnsGenerator(),
      new PySparkCaseWhenGenerator(),

      // Sinks
      new PySparkJdbcSinkGenerator(),
      new PySparkFileSinkGenerator(),
      new PySparkDeltaSinkGenerator(),
      new PySparkIcebergSinkGenerator(),
      new PySparkKafkaSinkGenerator(),
      new PySparkHiveSinkGenerator(),
      new PySparkConsoleSinkGenerator(),
    ]);
  }

  validate(pipeline: PipelineDefinition) {
    return pipelineValidator.validate(pipeline);
  }

  async generateNode(node: PipelineNode, context: GenerationContext): Promise<string> {
    const generator = this.generatorRegistry.getOrFail(node);
    const result = await generator.generate(node, context);
    return result.code;
  }

  async generate(pipeline: PipelineDefinition, options: GenerationOptions = {}): Promise<GeneratedArtifact> {
    // 1. Validate
    const validation = this.validate(pipeline);
    if (!validation.valid) {
      throw new Error(
        `Pipeline "${pipeline.name}" validation failed:\n` +
        validation.errors.map(e => `  [${e.code}] ${e.nodeId ? `Node "${e.nodeId}": ` : ''}${e.message}`).join('\n')
      );
    }

    // Default options
    const opts: GenerationOptions = {
      includeComments: true,
      includeLogging: true,
      includeDataQuality: true,
      ...options,
    };

    // 2. Build generation context
    const context: GenerationContext = {
      pipeline,
      technology: 'pyspark',
      resolvedNodes: new Map(),
      imports: new Set<string>([PYSPARK_IMPORTS.SPARK_SESSION, PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.TYPES]),
      sparkConfigLines: [],
      warnings: [...validation.warnings],
      variables: pipeline.variables ?? {},
      tempViewRegistry: new Map(),
      udfRegistry: new Map(),
      options: opts,
    };

    // 3. Topological sort
    const enabledNodes = pipeline.nodes.filter(n => n.enabled !== false);
    const sortedNodes = topologicalSort(enabledNodes);

    // 4. Generate code for each node
    const nodeCodeBlocks: string[] = [];

    for (const node of sortedNodes) {
      try {
        const generator = this.generatorRegistry.getOrFail(node);
        const result = await generator.generate(node, context);

        // Register resolved node
        context.resolvedNodes.set(node.id, {
          node,
          varName: result.varName,
          codeBlock: result.code,
          dependsOn: node.inputs.map(id => context.resolvedNodes.get(id)?.varName ?? id),
        });

        // Accumulate imports
        result.imports.forEach(imp => context.imports.add(imp));
        context.warnings.push(...result.warnings);

        nodeCodeBlocks.push(result.code);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const subType = node.sourceType ?? node.transformationType ?? node.sinkType ?? 'unknown';
        context.warnings.push({
          nodeId: node.id,
          code: 'GENERATION_ERROR',
          message: `Failed to generate code for node "${node.name}" (${node.type}:${subType}): ${msg}`,
          severity: 'error',
        });
        nodeCodeBlocks.push(`# ERROR: Failed to generate node "${node.name}": ${msg}`);
      }
    }

    // 5. Assemble main pipeline function (pass sortedNodes so assembly doesn't re-sort)
    const mainScript = this.assemblePipelineScript(pipeline, context, sortedNodes, nodeCodeBlocks);
    const requirementsFile = this.generateRequirements(pipeline);
    const submitScript = this.generateSubmitScript(pipeline, opts);
    const configFile = this.generateSparkConfig(pipeline);

    // 6. Count metadata
    const sources = enabledNodes.filter(n => n.type === 'source').length;
    const transforms = enabledNodes.filter(n => n.type === 'transformation').length;
    const sinks = enabledNodes.filter(n => n.type === 'sink').length;
    const lineCount = mainScript.split('\n').length;

    const metadata: ArtifactMetadata = {
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      nodeCount: enabledNodes.length,
      sourceCount: sources,
      transformationCount: transforms,
      sinkCount: sinks,
      estimatedLineCount: lineCount,
      warnings: context.warnings,
    };

    const files: CodeFile[] = [
      {
        fileName: `${this.sanitizeFileName(pipeline.name)}.py`,
        relativePath: 'src',
        content: mainScript,
        language: 'python',
        isEntryPoint: true,
        isGenerated: true,
      },
      {
        fileName: 'requirements.txt',
        relativePath: '.',
        content: requirementsFile,
        language: 'properties',
        isGenerated: true,
      },
      {
        fileName: 'submit.sh',
        relativePath: '.',
        content: submitScript,
        language: 'sh',
        isGenerated: true,
      },
      {
        fileName: 'spark-defaults.conf',
        relativePath: 'conf',
        content: configFile,
        language: 'properties',
        isGenerated: true,
      },
    ];

    return {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      technology: 'pyspark',
      sparkVersion: pipeline.environment.sparkVersion ?? '3.5',
      files,
      metadata,
    };
  }

  private assemblePipelineScript(
    pipeline: PipelineDefinition,
    context: GenerationContext,
    sortedNodes: PipelineNode[],   // same order as nodeBlocks — no re-sort here
    nodeBlocks: string[]
  ): string {
    const b = new CodeBuilder();
    const fnName = 'run_pipeline';

    b.raw(this.scaffold.generateHeader(pipeline, context));

    const secretsHelper = this.scaffold.generateSecretsHelper(pipeline, context);
    if (secretsHelper) b.raw(secretsHelper);

    b.raw(this.scaffold.generateArgsParser(pipeline));
    b.raw(this.scaffold.generateSparkSession(pipeline, context));

    // ── Function definition — all content manually prefixed with 4 spaces ─────
    // We do NOT use CodeBuilder.indent() here because nodeBlocks already contain
    // internally-indented multi-line code (e.g. chained .format().option().load()).
    // Using b.indent() + b.line(existingLine) would double-indent those inner lines.
    // Instead we emit the def line, then prefix each subsequent line with '    '.
    b.line(`def ${fnName}(spark: SparkSession, args) -> None:`);
    b.line(`    """Auto-generated pipeline: ${pipeline.name} v${pipeline.version}"""`);

    if (pipeline.variables && Object.keys(pipeline.variables).length > 0) {
      b.blank();
      b.line(`    # ─── Pipeline Variables ─────────────────────────────────────────────`);
      Object.entries(pipeline.variables).forEach(([k, defaultVal]) => {
        b.line(`    ${k} = getattr(args, ${JSON.stringify(k)}, ${JSON.stringify(defaultVal)})`);
      });
    }

    let lastType = '';
    sortedNodes.forEach((node, i) => {
      if (node.type !== lastType) {
        const title = node.type === 'source' ? 'Sources'
          : node.type === 'transformation' ? 'Transformations'
          : 'Sinks';
        b.blank();
        b.line(`    # ─── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
        lastType = node.type;
      }
      b.blank();
      const block = nodeBlocks[i] ?? `# (no code generated for node "${node.name}")`;
      block.split('\n').forEach(line => {
        // Prefix every non-blank line with exactly 4 spaces (one function-level indent)
        b.line(line.trim() === '' ? '' : `    ${line}`);
      });
    });

    if (context.options.includeLogging) {
      b.blank();
      b.line(`    logger.info(f"Pipeline '${pipeline.name}' completed successfully")`);
    }

    b.blank(2);
    b.raw(this.scaffold.generateEntrypoint(pipeline, fnName));

    return b.build();
  }

  private generateRequirements(pipeline: PipelineDefinition): string {
    const lines = [
      `# Auto-generated requirements for pipeline: ${pipeline.name}`,
      `# Spark version: ${pipeline.environment.sparkVersion ?? '3.5'}`,
      ``,
      `pyspark==${pipeline.environment.sparkVersion ?? '3.5'}.0`,
    ];

    if (pipeline.environment.enableDeltaLake) lines.push(`delta-spark>=2.4.0`);
    if (pipeline.environment.enableIceberg) lines.push(`pyiceberg>=0.5.0`);
    if (pipeline.secrets?.length) {
      lines.push(`# Secrets dependencies (uncomment as needed):`);
      lines.push(`# boto3>=1.28.0  # AWS Secrets Manager`);
      lines.push(`# azure-keyvault-secrets>=4.7.0  # Azure Key Vault`);
      lines.push(`# azure-identity>=1.14.0`);
      lines.push(`# google-cloud-secret-manager>=2.16.0  # GCP Secret Manager`);
    }
    if (pipeline.environment.extraDependencies?.length) {
      lines.push(``, `# Extra dependencies`);
      pipeline.environment.extraDependencies.forEach(d => lines.push(d));
    }

    return lines.join('\n');
  }

  private generateSubmitScript(pipeline: PipelineDefinition, opts: GenerationOptions): string {
    const sc = pipeline.sparkConfig;
    const scriptName = this.sanitizeFileName(pipeline.name);
    const packages = this.collectSparkPackages(pipeline);
    const driverPaths = this.collectSparkDriverPaths(pipeline);
    const lines = [
      `#!/usr/bin/env bash`,
      `# Auto-generated spark-submit script for: ${pipeline.name}`,
      `set -euo pipefail`,
      ``,
      `SCRIPT_DIR="$(cd "$(dirname "${`$0`}")" && pwd)"`,
      `PIPELINE_SCRIPT="${`$SCRIPT_DIR`}/src/${scriptName}.py"`,
      ``,
      `DEPENDENCIES=(`,
    ];

    packages.forEach(dep => lines.push(`  "${dep}"`));
    lines.push(`)`);
    lines.push(`CONFIGURED_DRIVER_PATHS=(`);
    driverPaths.forEach(driverPath => lines.push(`  "${driverPath}"`));
    lines.push(`)`);
    lines.push(`DRIVER_SEARCH_DIRS=()`);
    lines.push(`LOCAL_JARS=()`);
    lines.push(`REMOTE_PACKAGES=()`);
    lines.push(``);
    lines.push(`SEARCH_PATHS="${`$`}{ETL1_DRIVER_PATHS:-${`$`}{ETL1_DRIVER_DIR:-}}"`);
    lines.push(`for path_hint in "${`$`}{CONFIGURED_DRIVER_PATHS[@]}"; do`);
    lines.push(`  [[ -n "$path_hint" ]] || continue`);
    lines.push(`  if [[ -f "$path_hint" && "$path_hint" == *.jar ]]; then`);
    lines.push(`    LOCAL_JARS+=("$path_hint")`);
    lines.push(`    continue`);
    lines.push(`  fi`);
    lines.push(`  DRIVER_SEARCH_DIRS+=("$path_hint")`);
    lines.push(`done`);
    lines.push(`if [[ -n "$SEARCH_PATHS" ]]; then`);
    lines.push(`  IFS=',' read -r -a EXTRA_DRIVER_DIRS <<< "$SEARCH_PATHS"`);
    lines.push(`  for dir in "${`$`}{EXTRA_DRIVER_DIRS[@]}"; do`);
    lines.push(`    [[ -n "$dir" ]] || continue`);
    lines.push(`    DRIVER_SEARCH_DIRS+=("$dir")`);
    lines.push(`  done`);
    lines.push(`fi`);
    lines.push(`DRIVER_SEARCH_DIRS+=("$SCRIPT_DIR/drivers" "$SCRIPT_DIR/../drivers")`);
    lines.push(``);
    lines.push(`resolve_dep_to_jar() {`);
    lines.push(`  local dep="$1"`);
    lines.push(`  local artifact version candidate dir`);
    lines.push(`  IFS=':' read -r _ artifact version _ <<< "$dep"`);
    lines.push('  [[ -n "${artifact:-}" && -n "${version:-}" ]] || return 1');
    lines.push('  for dir in "${DRIVER_SEARCH_DIRS[@]}"; do');
    lines.push(`    [[ -n "$dir" ]] || continue`);
    lines.push('    if [[ -f "$dir" && "$(basename "$dir")" == ${artifact}-${version}*.jar ]]; then');
    lines.push(`      printf '%s' "$dir"`);
    lines.push(`      return 0`);
    lines.push(`    fi`);
    lines.push(`    [[ -d "$dir" ]] || continue`);
    lines.push('    candidate="$(find "$dir" -type f -name "${artifact}-${version}*.jar" | head -n 1)"');
    lines.push(`    if [[ -n "$candidate" ]]; then`);
    lines.push(`      printf '%s' "$candidate"`);
    lines.push(`      return 0`);
    lines.push(`    fi`);
    lines.push(`  done`);
    lines.push(`  return 1`);
    lines.push(`}`);
    lines.push(``);
    lines.push('for dep in "${DEPENDENCIES[@]}"; do');
    lines.push(`  [[ -n "$dep" ]] || continue`);
    lines.push(`  if [[ "$dep" == *.jar || "$dep" == */* ]]; then`);
    lines.push(`    if [[ -f "$dep" ]]; then`);
    lines.push(`      LOCAL_JARS+=("$dep")`);
    lines.push(`    else`);
    lines.push(`      REMOTE_PACKAGES+=("$dep")`);
    lines.push(`    fi`);
    lines.push(`    continue`);
    lines.push(`  fi`);
    lines.push(`  if resolved="$(resolve_dep_to_jar "$dep")"; then`);
    lines.push(`    LOCAL_JARS+=("$resolved")`);
    lines.push(`  else`);
    lines.push(`    REMOTE_PACKAGES+=("$dep")`);
    lines.push(`  fi`);
    lines.push(`done`);
    lines.push(``);
    lines.push(`SUBMIT_ARGS=(`);
    lines.push(`  --master ${sc.master ?? 'yarn'}`);
    lines.push(`  --deploy-mode ${sc.deployMode ?? 'cluster'}`);
    if (sc.driverMemory) lines.push(`  --driver-memory ${sc.driverMemory}`);
    if (sc.executorMemory) lines.push(`  --executor-memory ${sc.executorMemory}`);
    if (sc.executorCores) lines.push(`  --executor-cores ${sc.executorCores}`);
    if (sc.numExecutors && !sc.dynamicAllocation) lines.push(`  --num-executors ${sc.numExecutors}`);
    lines.push(`)`);
    lines.push(``);
    lines.push('if [[ ${#LOCAL_JARS[@]} -gt 0 ]]; then');
    lines.push('  SUBMIT_ARGS+=(--jars "$(IFS=,; echo "${LOCAL_JARS[*]}")")');
    lines.push(`fi`);
    lines.push('if [[ ${#REMOTE_PACKAGES[@]} -gt 0 ]]; then');
    lines.push('  SUBMIT_ARGS+=(--packages "$(IFS=,; echo "${REMOTE_PACKAGES[*]}")")');
    lines.push(`fi`);
    lines.push(``);
    lines.push(`SUBMIT_ARGS+=("$PIPELINE_SCRIPT" --env ${opts.targetPlatform ?? 'prod'} "$@")`);
    lines.push('spark-submit "${SUBMIT_ARGS[@]}"');

    return lines.join('\n');
  }

  private collectSparkPackages(pipeline: PipelineDefinition): string[] {
    const packages = new Set<string>();

    if (pipeline.environment.enableDeltaLake) {
      packages.add('io.delta:delta-core_2.12:2.4.0');
    }
    if (pipeline.environment.enableIceberg) {
      packages.add('org.apache.iceberg:iceberg-spark-runtime-3.4_2.12:1.3.1');
    }

    pipeline.nodes.forEach(node => {
      if (node.sourceType !== 'jdbc' && node.sinkType !== 'jdbc') return;
      const cfg = node.config as { driver?: string; url?: string; mavenCoords?: string; driverPaths?: string[] };
      const configuredDriverPaths = cfg.driverPaths?.map(driverPath => driverPath?.trim()).filter(Boolean) ?? [];
      const jdbcPackage = cfg.mavenCoords?.trim()
        || (configuredDriverPaths.length > 0 ? null : this.inferJdbcPackage(cfg.driver, cfg.url));
      if (jdbcPackage) packages.add(jdbcPackage);
    });

    return [...packages];
  }

  private collectSparkDriverPaths(pipeline: PipelineDefinition): string[] {
    const driverPaths = new Set<string>();

    pipeline.nodes.forEach(node => {
      if (node.sourceType !== 'jdbc' && node.sinkType !== 'jdbc') return;
      const cfg = node.config as { driverPaths?: string[] };
      cfg.driverPaths?.forEach(driverPath => {
        const normalized = driverPath?.trim();
        if (normalized) driverPaths.add(normalized);
      });
    });

    return [...driverPaths];
  }

  private inferJdbcPackage(driver?: string, url?: string): string | null {
    const signature = `${driver ?? ''} ${url ?? ''}`.toLowerCase();
    if (signature.includes('postgresql')) return 'org.postgresql:postgresql:42.7.2';
    if (signature.includes('mysql')) return 'com.mysql:mysql-connector-j:8.3.0';
    if (signature.includes('sqlserver') || signature.includes('mssql')) return 'com.microsoft.sqlserver:mssql-jdbc:12.6.1.jre11';
    if (signature.includes('oracle')) return 'com.oracle.database.jdbc:ojdbc8:23.3.0.23.09';
    if (signature.includes('redshift')) return 'com.amazon.redshift:redshift-jdbc42:2.1.0.29';
    if (signature.includes('snowflake')) return 'net.snowflake:snowflake-jdbc:3.15.1';
    if (signature.includes('db2')) return 'com.ibm.db2:jcc:11.5.9.0';
    return null;
  }

  private generateSparkConfig(pipeline: PipelineDefinition): string {
    const sc = pipeline.sparkConfig;
    const lines = [
      `# Auto-generated spark-defaults.conf for: ${pipeline.name}`,
      `#`,
      `spark.sql.shuffle.partitions=${sc.shufflePartitions ?? 200}`,
      `spark.sql.adaptive.enabled=true`,
      `spark.sql.adaptive.coalescePartitions.enabled=true`,
      `spark.sql.adaptive.skewJoin.enabled=true`,
    ];

    if (sc.dynamicAllocation) {
      lines.push(`spark.dynamicAllocation.enabled=true`);
      if (sc.minExecutors !== undefined) lines.push(`spark.dynamicAllocation.minExecutors=${sc.minExecutors}`);
      if (sc.maxExecutors !== undefined) lines.push(`spark.dynamicAllocation.maxExecutors=${sc.maxExecutors}`);
    }

    if (sc.extraSparkConf) {
      Object.entries(sc.extraSparkConf).forEach(([k, v]) => lines.push(`${k}=${v}`));
    }

    return lines.join('\n');
  }

  private sanitizeFileName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
}
