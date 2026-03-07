import {
  ICodeEngine, GeneratedArtifact, GenerationContext, GenerationOptions,
  CodeFile, ArtifactMetadata
} from '../../../core/interfaces/engine.interfaces';
import { PipelineDefinition, PipelineNode, TechnologyType } from '../../../core/types/pipeline.types';
import { NodeGeneratorRegistry } from '../../../registry/node-generator.registry';
import { pipelineValidator } from '../../../validators/pipeline.validator';
import { topologicalSort } from '../../../utils/topo-sort';
import { toScalaVal, ScalaCodeBuilder } from './scala.utils';
import { GENERATOR_VERSION } from '../../../core/constants/codegen.constants';
import { ScalaPipelineScaffold } from './pipeline/pipeline.scaffold';

// Sources
import {
  ScalaJdbcSourceGenerator, ScalaFileSourceGenerator, ScalaKafkaSourceGenerator,
  ScalaDeltaSourceGenerator, ScalaHiveSourceGenerator, ScalaIcebergSourceGenerator
} from './sources/all.source.generators';

// Transformations
import {
  ScalaFilterGenerator, ScalaSelectGenerator, ScalaRenameGenerator, ScalaCastGenerator,
  ScalaDropGenerator, ScalaDeriveGenerator, ScalaJoinGenerator, ScalaUnionGenerator,
  ScalaAggregateGenerator, ScalaWindowGenerator, ScalaDedupGenerator, ScalaSortGenerator,
  ScalaCustomSqlGenerator, ScalaRepartitionGenerator, ScalaDataQualityGenerator
} from './transformations/all.transformation.generators';

// Sinks
import {
  ScalaJdbcSinkGenerator, ScalaFileSinkGenerator, ScalaDeltaSinkGenerator,
  ScalaKafkaSinkGenerator, ScalaHiveSinkGenerator, ScalaIcebergSinkGenerator,
  ScalaConsoleSinkGenerator
} from './sinks/all.sink.generators';

// ─── Scala Spark Engine ───────────────────────────────────────────────────────

export class ScalaSparkEngine implements ICodeEngine {
  readonly technology: TechnologyType = 'scala-spark';
  readonly supportedVersions = ['3.2', '3.3', '3.4', '3.5'] as const;

  private readonly generatorRegistry: NodeGeneratorRegistry;
  private readonly scaffold: ScalaPipelineScaffold;

  constructor() {
    this.scaffold = new ScalaPipelineScaffold();
    this.generatorRegistry = new NodeGeneratorRegistry();
    this.registerAllGenerators();
  }

  private registerAllGenerators(): void {
    this.generatorRegistry.registerMany([
      new ScalaJdbcSourceGenerator(), new ScalaFileSourceGenerator(),
      new ScalaKafkaSourceGenerator(), new ScalaDeltaSourceGenerator(),
      new ScalaHiveSourceGenerator(), new ScalaIcebergSourceGenerator(),

      new ScalaFilterGenerator(), new ScalaSelectGenerator(), new ScalaRenameGenerator(),
      new ScalaCastGenerator(), new ScalaDropGenerator(), new ScalaDeriveGenerator(),
      new ScalaJoinGenerator(), new ScalaUnionGenerator(), new ScalaAggregateGenerator(),
      new ScalaWindowGenerator(), new ScalaDedupGenerator(), new ScalaSortGenerator(),
      new ScalaCustomSqlGenerator(), new ScalaRepartitionGenerator(), new ScalaDataQualityGenerator(),

      new ScalaJdbcSinkGenerator(), new ScalaFileSinkGenerator(), new ScalaDeltaSinkGenerator(),
      new ScalaKafkaSinkGenerator(), new ScalaHiveSinkGenerator(), new ScalaIcebergSinkGenerator(),
      new ScalaConsoleSinkGenerator(),
    ]);
  }

  validate(pipeline: PipelineDefinition) {
    return pipelineValidator.validate(pipeline);
  }

  async generateNode(node: PipelineNode, context: GenerationContext): Promise<string> {
    return (await this.generatorRegistry.getOrFail(node).generate(node, context)).code;
  }

  async generate(pipeline: PipelineDefinition, options: GenerationOptions = {}): Promise<GeneratedArtifact> {
    const validation = this.validate(pipeline);
    if (!validation.valid) {
      throw new Error(`Pipeline "${pipeline.name}" validation failed:\n` +
        validation.errors.map(e => `  [${e.code}] ${e.message}`).join('\n'));
    }

    const opts: GenerationOptions = { includeComments: true, includeLogging: true, ...options };
    const context: GenerationContext = {
      pipeline, technology: 'scala-spark',
      resolvedNodes: new Map(), imports: new Set(),
      sparkConfigLines: [], warnings: [...validation.warnings],
      variables: pipeline.variables ?? {},
      tempViewRegistry: new Map(), udfRegistry: new Map(), options: opts,
    };

    const enabledNodes = pipeline.nodes.filter(n => n.enabled !== false);
    const sortedNodes = topologicalSort(enabledNodes);
    const nodeCodeBlocks: string[] = [];

    for (const node of sortedNodes) {
      try {
        const gen = this.generatorRegistry.getOrFail(node);
        const result = await gen.generate(node, context);

        context.resolvedNodes.set(node.id, {
          node, varName: result.varName, codeBlock: result.code,
          dependsOn: node.inputs.map(id => context.resolvedNodes.get(id)?.varName ?? id),
        });

        result.imports.forEach(i => context.imports.add(i));
        context.warnings.push(...result.warnings);
        nodeCodeBlocks.push(result.code);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.warnings.push({ nodeId: node.id, code: 'GENERATION_ERROR', message: msg, severity: 'error' });
        nodeCodeBlocks.push(`// ERROR: ${msg}`);
      }
    }

    const mainFile = this.assembleScalaFile(pipeline, context, sortedNodes, nodeCodeBlocks);
    const buildSbt = this.scaffold.generateBuildSbt(pipeline);
    const submitScript = this.generateSubmitScript(pipeline, opts);

    const sources = enabledNodes.filter(n => n.type === 'source').length;
    const transforms = enabledNodes.filter(n => n.type === 'transformation').length;
    const sinks = enabledNodes.filter(n => n.type === 'sink').length;

    const metadata: ArtifactMetadata = {
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      nodeCount: enabledNodes.length,
      sourceCount: sources,
      transformationCount: transforms,
      sinkCount: sinks,
      estimatedLineCount: mainFile.split('\n').length,
      warnings: context.warnings,
    };

    const files: CodeFile[] = [
      {
        fileName: `${this.sanitize(pipeline.name)}Job.scala`,
        relativePath: 'src/main/scala/com/etl/pipelines',
        content: mainFile,
        language: 'scala',
        isEntryPoint: true,
        isGenerated: true,
      },
      {
        fileName: 'build.sbt',
        relativePath: '.',
        content: buildSbt,
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
    ];

    return {
      pipelineId: pipeline.id, pipelineName: pipeline.name,
      technology: 'scala-spark', sparkVersion: pipeline.environment.sparkVersion ?? '3.5',
      files, metadata,
    };
  }

  private assembleScalaFile(
    pipeline: PipelineDefinition,
    context: GenerationContext,
    sortedNodes: PipelineNode[],
    nodeBlocks: string[]
  ): string {
    const b = new ScalaCodeBuilder();

    b.raw(this.scaffold.generateHeader(pipeline));
    b.raw(this.scaffold.generateImports(context));
    b.raw(this.scaffold.generateObjectOpen(pipeline));
    b.raw(this.scaffold.generateSparkSession(pipeline, context));
    b.raw(this.scaffold.generateMainMethod(pipeline));

    // runPipeline function
    b.indent(b2 => {
      b2.line(`def runPipeline(spark: SparkSession): Unit = {`);
      b2.indent(b3 => {
        let lastType = '';
        sortedNodes.forEach((node, i) => {
          if (node.type !== lastType) {
            const title = node.type === 'source' ? 'Sources' : node.type === 'transformation' ? 'Transformations' : 'Sinks';
            b3.blank();
            b3.comment(`─── ${title} ${'─'.repeat(60 - title.length)}`);
            lastType = node.type;
          }
          b3.blank();
          nodeBlocks[i].split('\n').forEach(l => b3.line(l));
        });

        if (context.options.includeLogging) {
          b3.blank();
          b3.line(`logger.info("All nodes processed successfully")`);
        }
      });
      b2.line('}');
    });
    b.blank();
    b.raw(this.scaffold.generateObjectClose());

    return b.build();
  }

  private generateSubmitScript(pipeline: PipelineDefinition, opts: GenerationOptions): string {
    const sc = pipeline.sparkConfig;
    const jarName = `${this.sanitize(pipeline.name)}-${pipeline.version}.jar`;
    const mainClass = `com.etl.pipelines.${pipeline.name.replace(/[^a-zA-Z0-9]/g, '')}Job`;
    const lines = [
      `#!/usr/bin/env bash`,
      `# Auto-generated spark-submit for: ${pipeline.name}`,
      `set -euo pipefail`,
      ``,
      `spark-submit \\`,
      `  --class ${mainClass} \\`,
      `  --master ${sc.master ?? 'yarn'} \\`,
      `  --deploy-mode ${sc.deployMode ?? 'cluster'} \\`,
    ];
    if (sc.driverMemory) lines.push(`  --driver-memory ${sc.driverMemory} \\`);
    if (sc.executorMemory) lines.push(`  --executor-memory ${sc.executorMemory} \\`);
    if (sc.executorCores) lines.push(`  --executor-cores ${sc.executorCores} \\`);
    if (pipeline.environment.enableDeltaLake) lines.push(`  --packages io.delta:delta-core_2.12:2.4.0 \\`);
    lines.push(`  target/scala-2.12/${jarName} \\`, `  "$@"`);
    return lines.join('\n');
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '_');
  }
}
