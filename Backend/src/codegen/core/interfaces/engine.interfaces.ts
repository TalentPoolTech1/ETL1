import { PipelineDefinition, PipelineNode, TechnologyType, SparkVersion } from '../types/pipeline.types';

// ─── Generated Code Output ─────────────────────────────────────────────────────
export interface CodeFile {
  fileName: string;
  relativePath: string;
  content: string;
  language: 'python' | 'scala' | 'sql' | 'yaml' | 'properties' | 'sh' | 'json';
  isEntryPoint?: boolean;
  isGenerated?: boolean;  // flag to differentiate generated vs template files
}

export interface GeneratedArtifact {
  pipelineId: string;
  pipelineName: string;
  technology: TechnologyType;
  sparkVersion: SparkVersion;
  files: CodeFile[];
  metadata: ArtifactMetadata;
}

export interface ArtifactMetadata {
  generatedAt: string;
  generatorVersion: string;
  nodeCount: number;
  sourceCount: number;
  transformationCount: number;
  sinkCount: number;
  estimatedLineCount: number;
  warnings: GenerationWarning[];
}

export interface GenerationWarning {
  nodeId?: string;
  code: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

// ─── Generation Context ────────────────────────────────────────────────────────
// Passed through the generation pipeline; generators mutate this incrementally.
export interface GenerationContext {
  pipeline: PipelineDefinition;
  technology: TechnologyType;
  resolvedNodes: Map<string, ResolvedNode>;  // nodeId → resolved
  imports: Set<string>;
  sparkConfigLines: string[];
  warnings: GenerationWarning[];
  variables: Record<string, string>;
  tempViewRegistry: Map<string, string>;     // nodeId → spark temp view name
  udfRegistry: Map<string, UdfDefinition>;
  options: GenerationOptions;
}

export interface ResolvedNode {
  node: PipelineNode;
  varName: string;       // DataFrame variable name in generated code
  codeBlock: string;     // the generated code block for this node
  dependsOn: string[];   // varNames of inputs
}

export interface UdfDefinition {
  name: string;
  registrationCode: string;
  returnType: string;
}

export interface GenerationOptions {
  includeComments?: boolean;
  includeSchemaValidation?: boolean;
  includeDataQuality?: boolean;
  includeLogging?: boolean;
  includeMetrics?: boolean;
  includeLineage?: boolean;
  targetPlatform?: 'databricks' | 'emr' | 'dataproc' | 'hdinsight' | 'onprem' | 'local';
  outputDirectory?: string;
  variablePrefix?: string;
  secretsBackend?: 'env' | 'aws_secretsmanager' | 'azure_keyvault' | 'gcp_secretmanager' | 'vault';
  useAbstractLogging?: boolean;
}

// ─── Engine Interface ──────────────────────────────────────────────────────────
export interface ICodeEngine {
  readonly technology: TechnologyType;
  readonly supportedVersions: readonly string[];

  /**
   * Generate all code artifacts for a pipeline.
   */
  generate(pipeline: PipelineDefinition, options?: GenerationOptions): Promise<GeneratedArtifact>;

  /**
   * Generate code for a single node (useful for preview in UI).
   */
  generateNode(node: PipelineNode, context: GenerationContext): Promise<string>;

  /**
   * Validate a pipeline definition before generation.
   */
  validate(pipeline: PipelineDefinition): ValidationResult;
}

// ─── Node Generator Interface ──────────────────────────────────────────────────
export interface INodeGenerator {
  readonly nodeType: PipelineNode['type'];
  readonly subType: string;  // sourceType | transformationType | sinkType

  canHandle(node: PipelineNode): boolean;
  generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode>;
}

export interface GeneratedNodeCode {
  varName: string;
  code: string;
  imports: string[];
  warnings: GenerationWarning[];
}

// ─── Template Renderer Interface ───────────────────────────────────────────────
export interface ITemplateRenderer {
  render(templateId: string, data: Record<string, unknown>): string;
  renderFile(templatePath: string, data: Record<string, unknown>): string;
  hasTemplate(templateId: string): boolean;
}

// ─── Validation ────────────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: GenerationWarning[];
}

export interface ValidationError {
  nodeId?: string;
  field?: string;
  code: string;
  message: string;
}

// ─── Registry Interface ────────────────────────────────────────────────────────
export interface IEngineRegistry {
  register(engine: ICodeEngine): void;
  get(technology: TechnologyType): ICodeEngine | undefined;
  list(): TechnologyType[];
}

export interface INodeGeneratorRegistry {
  register(generator: INodeGenerator): void;
  getFor(node: PipelineNode): INodeGenerator | undefined;
  listAll(): INodeGenerator[];
}
