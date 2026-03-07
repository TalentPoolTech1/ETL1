import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** PIPE — Pipelines error factories */
export const pipeErrors = {

  nameRequired(): AppError {
    return new AppError({
      code:            'PIPE-001',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Pipeline name is required.',
      internalMessage: 'Missing pipeline_display_name in request body',
      action:          'pipelines.validate',
      fieldErrors:     [{ field: 'pipeline_display_name', message: 'Pipeline name is required.' }],
    });
  },

  duplicateName(name: string, projectId: string): AppError {
    return new AppError({
      code:            'PIPE-002',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `A pipeline named '${name}' already exists in this project.`,
      internalMessage: `Unique constraint violation on catalog.pipelines (pipeline_display_name + project_id) for name="${name}" projectId="${projectId}"`,
      action:          'pipelines.create',
      meta:            { pipelineDisplayName: name, projectId },
    });
  },

  notFound(pipelineId: string): AppError {
    return new AppError({
      code:            'PIPE-003',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'Pipeline not found. It may have been deleted.',
      internalMessage: `catalog.pipelines lookup miss for pipelineId="${pipelineId}"`,
      action:          'pipelines.find',
      meta:            { pipelineId },
    });
  },

  missingSource(): AppError {
    return new AppError({
      code:            'PIPE-004',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'A pipeline must have at least one source node.',
      internalMessage: 'IR graph validation failed — no source node found',
      action:          'pipelines.validate',
    });
  },

  missingSink(): AppError {
    return new AppError({
      code:            'PIPE-005',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'A pipeline must have at least one sink node.',
      internalMessage: 'IR graph validation failed — no sink node found',
      action:          'pipelines.validate',
    });
  },

  hasCycle(): AppError {
    return new AppError({
      code:            'PIPE-006',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'The pipeline graph contains a cycle. Pipelines must be directed acyclic graphs (DAGs).',
      internalMessage: 'Topological sort failed — cycle detected in pipeline IR graph',
      action:          'pipelines.validate',
    });
  },

  disconnectedInput(nodeId: string): AppError {
    return new AppError({
      code:            'PIPE-007',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     `Node '${nodeId}' has a required input that is not connected.`,
      internalMessage: `Pipeline IR validation — required input port unconnected on nodeId="${nodeId}"`,
      action:          'pipelines.validate',
      meta:            { nodeId },
    });
  },

  staleDatasetRef(nodeId: string, datasetId: string): AppError {
    return new AppError({
      code:            'PIPE-008',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     `Node '${nodeId}' references a dataset that no longer exists. Please update or remove this node.`,
      internalMessage: `Stale dataset reference in IR — nodeId="${nodeId}" datasetId="${datasetId}" not found in catalog.datasets`,
      action:          'pipelines.validate',
      meta:            { nodeId, datasetId },
    });
  },

  versionAlreadyPublished(pipelineId: string, versionId: string): AppError {
    return new AppError({
      code:            'PIPE-009',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     'This pipeline version has already been published. Create a new version to make further changes.',
      internalMessage: `Attempt to mutate published versionId="${versionId}" on pipelineId="${pipelineId}"`,
      action:          'pipelines.update',
      meta:            { pipelineId, versionId },
    });
  },

  hasActiveSchedules(pipelineId: string, count: number): AppError {
    return new AppError({
      code:            'PIPE-010',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `This pipeline cannot be deleted because it is actively scheduled by ${count} orchestrator(s). Remove the schedule first.`,
      internalMessage: `Delete blocked — catalog.orchestrator_pipeline_map FK references pipelineId="${pipelineId}" (${count} rows)`,
      action:          'pipelines.delete',
      meta:            { pipelineId, orchestratorCount: count },
    });
  },

  codegenFailed(pipelineId: string, cause: Error): AppError {
    return new AppError({
      code:            'PIPE-011',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'Pipeline code generation failed. Please review the pipeline design. (Ref: {correlationId})',
      internalMessage: `Codegen threw an unhandled error for pipelineId="${pipelineId}"`,
      action:          'pipelines.generate',
      meta:            { pipelineId },
      cause,
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'PIPE-012',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred while saving the pipeline. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in pipelines service',
      action:          'pipelines.unknown',
      cause,
    });
  },
};
