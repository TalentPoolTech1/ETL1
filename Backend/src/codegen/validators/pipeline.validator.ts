import {
  PipelineDefinition, PipelineNode,
  JdbcSourceConfig, FileSourceConfig, KafkaSourceConfig,
  JoinConfig, AggregateConfig,
} from '../core/types/pipeline.types';
import { ValidationResult, ValidationError, GenerationWarning } from '../core/interfaces/engine.interfaces';

// ─── Pipeline Validator ────────────────────────────────────────────────────────

export class PipelineValidator {
  validate(pipeline: PipelineDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: GenerationWarning[] = [];

    this.validateStructure(pipeline, errors, warnings);
    this.validateGraph(pipeline, errors, warnings);
    pipeline.nodes.forEach(node => {
      this.validateNode(node, pipeline, errors, warnings);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─── Top-level structure ─────────────────────────────────────────────────────
  private validateStructure(
    p: PipelineDefinition,
    errors: ValidationError[],
    warnings: GenerationWarning[]
  ): void {
    if (!p.id) errors.push({ code: 'PIPELINE_NO_ID', message: 'Pipeline must have an id.' });
    if (!p.name) errors.push({ code: 'PIPELINE_NO_NAME', message: 'Pipeline must have a name.' });
    if (!p.environment?.technology) {
      errors.push({ code: 'NO_TECHNOLOGY', message: 'environment.technology must be specified.' });
    }
    if (!p.environment?.sparkVersion) {
      warnings.push({ code: 'NO_SPARK_VERSION', message: 'sparkVersion not specified; defaulting to 3.5.', severity: 'warn' });
    }
    if (!p.nodes || p.nodes.length === 0) {
      errors.push({ code: 'NO_NODES', message: 'Pipeline has no nodes.' });
    }
    if (!p.sparkConfig?.appName) {
      warnings.push({ code: 'NO_APP_NAME', message: 'sparkConfig.appName not set; using pipeline name.', severity: 'warn' });
    }
  }

  // ─── DAG validation ──────────────────────────────────────────────────────────
  private validateGraph(
    p: PipelineDefinition,
    errors: ValidationError[],
    warnings: GenerationWarning[]
  ): void {
    const nodeIds = new Set(p.nodes.map(n => n.id));

    // Duplicate IDs
    const seen = new Set<string>();
    p.nodes.forEach(n => {
      if (seen.has(n.id)) {
        errors.push({ nodeId: n.id, code: 'DUPLICATE_NODE_ID', message: `Duplicate node id: ${n.id}` });
      }
      seen.add(n.id);
    });

    // Dangling references
    p.nodes.forEach(n => {
      n.inputs.forEach(inputId => {
        if (!nodeIds.has(inputId)) {
          errors.push({
            nodeId: n.id,
            code: 'DANGLING_INPUT',
            message: `Node "${n.name}" references input node id "${inputId}" which does not exist.`,
          });
        }
      });
    });

    // Cycle detection (DFS)
    if (this.hasCycle(p.nodes)) {
      errors.push({ code: 'CYCLE_DETECTED', message: 'Pipeline DAG contains a cycle.' });
    }

    // Sources must have no inputs
    p.nodes.filter(n => n.type === 'source').forEach(n => {
      if (n.inputs.length > 0) {
        errors.push({ nodeId: n.id, code: 'SOURCE_HAS_INPUTS', message: `Source node "${n.name}" must not have inputs.` });
      }
    });

    // Sinks must have exactly one input (or more for union sinks)
    p.nodes.filter(n => n.type === 'sink').forEach(n => {
      if (n.inputs.length === 0) {
        errors.push({ nodeId: n.id, code: 'SINK_NO_INPUT', message: `Sink node "${n.name}" must have at least one input.` });
      }
    });

    // At least one source and one sink
    const hasSink = p.nodes.some(n => n.type === 'sink');
    const hasSource = p.nodes.some(n => n.type === 'source');
    if (!hasSource) errors.push({ code: 'NO_SOURCE', message: 'Pipeline must have at least one source node.' });
    if (!hasSink) warnings.push({ code: 'NO_SINK', message: 'Pipeline has no sink nodes; data will not be persisted.', severity: 'warn' });
  }

  private hasCycle(nodes: PipelineNode[]): boolean {
    const color = new Map<string, 'white' | 'gray' | 'black'>();
    nodes.forEach(n => color.set(n.id, 'white'));
    const adjList = new Map<string, string[]>(nodes.map(n => [n.id, n.inputs]));

    const dfs = (id: string): boolean => {
      color.set(id, 'gray');
      for (const dep of adjList.get(id) ?? []) {
        if (color.get(dep) === 'gray') return true;
        if (color.get(dep) === 'white' && dfs(dep)) return true;
      }
      color.set(id, 'black');
      return false;
    };

    return nodes.some(n => color.get(n.id) === 'white' && dfs(n.id));
  }

  // ─── Node-level validation ───────────────────────────────────────────────────
  private validateNode(
    node: PipelineNode,
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: GenerationWarning[]
  ): void {
    if (!node.id) errors.push({ code: 'NODE_NO_ID', message: 'A node is missing an id.' });
    if (!node.name) errors.push({ nodeId: node.id, code: 'NODE_NO_NAME', message: 'Node is missing a name.' });
    if (!node.config) {
      errors.push({ nodeId: node.id, code: 'NODE_NO_CONFIG', message: `Node "${node.name}" has no config.` });
      return;
    }

    switch (node.type) {
      case 'source': this.validateSourceNode(node, errors, warnings); break;
      case 'transformation': this.validateTransformationNode(node, errors, warnings); break;
      case 'sink': this.validateSinkNode(node, errors, warnings); break;
    }
  }

  private validateSourceNode(node: PipelineNode, errors: ValidationError[], _w: GenerationWarning[]): void {
    const c = node.config as Record<string, unknown>;
    switch (node.sourceType) {
      case 'jdbc':
        // connectionId is a design-time reference resolved at runtime — url not required when connectionId present
        if (!c['url'] && !c['connectionId']) errors.push({ nodeId: node.id, field: 'url', code: 'JDBC_NO_URL', message: `JDBC source "${node.name}" missing url or connectionId.` });
        if (!c['table'] && !c['query']) errors.push({ nodeId: node.id, code: 'JDBC_NO_TABLE_OR_QUERY', message: `JDBC source "${node.name}" requires table or query.` });
        break;
      case 'file':
        if (!c['path']) errors.push({ nodeId: node.id, field: 'path', code: 'FILE_NO_PATH', message: `File source "${node.name}" missing path.` });
        if (!c['format']) errors.push({ nodeId: node.id, field: 'format', code: 'FILE_NO_FORMAT', message: `File source "${node.name}" missing format.` });
        break;
      case 'kafka':
        if (!c['bootstrapServers']) errors.push({ nodeId: node.id, code: 'KAFKA_NO_SERVERS', message: `Kafka source "${node.name}" missing bootstrapServers.` });
        if (!c['topic']) errors.push({ nodeId: node.id, code: 'KAFKA_NO_TOPIC', message: `Kafka source "${node.name}" missing topic.` });
        break;
    }
  }

  private validateTransformationNode(node: PipelineNode, errors: ValidationError[], warnings: GenerationWarning[]): void {
    const c = node.config as Record<string, unknown>;
    switch (node.transformationType) {
      case 'join':
        if (!c['rightInput']) errors.push({ nodeId: node.id, code: 'JOIN_NO_RIGHT', message: `Join "${node.name}" missing rightInput.` });
        if (!c['conditions'] || (c['conditions'] as unknown[]).length === 0) {
          errors.push({ nodeId: node.id, code: 'JOIN_NO_CONDITIONS', message: `Join "${node.name}" has no join conditions.` });
        }
        break;
      case 'aggregate':
        if (!c['aggregations'] || (c['aggregations'] as unknown[]).length === 0) {
          errors.push({ nodeId: node.id, code: 'AGG_NO_AGGREGATIONS', message: `Aggregate "${node.name}" has no aggregation functions.` });
        }
        break;
      case 'filter':
        if (!c['condition']) errors.push({ nodeId: node.id, code: 'FILTER_NO_CONDITION', message: `Filter "${node.name}" missing condition.` });
        break;
      case 'custom_sql':
        if (!c['sql']) errors.push({ nodeId: node.id, code: 'SQL_NO_QUERY', message: `Custom SQL "${node.name}" missing sql.` });
        break;
      case 'multi_transform_sequence': {
        const seqs = c['transformSequences'];
        if (!seqs || !Array.isArray(seqs) || (seqs as unknown[]).length === 0) {
          warnings.push({
            nodeId: node.id,
            code: 'MULTI_TRANSFORM_NO_SEQUENCES',
            message: `Multi-transform node "${node.name}" has no transformation sequences configured — will pass data through unchanged.`,
            severity: 'warn',
          });
        }
        break;
      }
    }
  }

  private validateSinkNode(node: PipelineNode, errors: ValidationError[], _w: GenerationWarning[]): void {
    const c = node.config as Record<string, unknown>;
    switch (node.sinkType) {
      case 'jdbc':
        if (!c['url'] && !c['connectionId']) errors.push({ nodeId: node.id, code: 'SINK_JDBC_NO_URL', message: `JDBC sink "${node.name}" missing url or connectionId.` });
        if (!c['table']) errors.push({ nodeId: node.id, code: 'SINK_JDBC_NO_TABLE', message: `JDBC sink "${node.name}" missing table.` });
        break;
      case 'file':
        if (!c['path']) errors.push({ nodeId: node.id, code: 'SINK_FILE_NO_PATH', message: `File sink "${node.name}" missing path.` });
        break;
      case 'delta':
        if (!c['path'] && !c['tableName']) {
          errors.push({ nodeId: node.id, code: 'SINK_DELTA_NO_TARGET', message: `Delta sink "${node.name}" requires path or tableName.` });
        }
        break;
    }
  }
}

export const pipelineValidator = new PipelineValidator();
