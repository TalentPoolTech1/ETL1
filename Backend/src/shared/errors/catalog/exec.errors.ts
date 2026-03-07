import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** EXEC — Executions / Pipeline Runs error factories */
export const execErrors = {

  runNotFound(runId: string): AppError {
    return new AppError({
      code:            'EXEC-001',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'Pipeline run not found.',
      internalMessage: `execution.pipeline_runs lookup miss for runId="${runId}"`,
      action:          'executions.find',
      meta:            { runId },
    });
  },

  alreadyRunning(pipelineId: string): AppError {
    return new AppError({
      code:            'EXEC-002',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     'This pipeline is already running. Wait for the current run to complete before starting a new one.',
      internalMessage: `Duplicate run attempt — pipelineId="${pipelineId}" already has an active pipeline_run`,
      action:          'executions.start',
      meta:            { pipelineId },
    });
  },

  noPublishedVersion(pipelineId: string): AppError {
    return new AppError({
      code:            'EXEC-003',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Cannot start a run for a pipeline that has no published version.',
      internalMessage: `catalog.pipelines.active_version_id is null for pipelineId="${pipelineId}"`,
      action:          'executions.start',
      meta:            { pipelineId },
    });
  },

  clusterRejected(pipelineId: string, cause: Error): AppError {
    return new AppError({
      code:            'EXEC-004',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'The Spark cluster did not accept the job submission. Please check the cluster status and try again. (Ref: {correlationId})',
      internalMessage: `Spark cluster rejected job submission for pipelineId="${pipelineId}"`,
      action:          'executions.submit',
      meta:            { pipelineId },
      cause,
    });
  },

  clusterTimeout(pipelineId: string, cause: Error): AppError {
    return new AppError({
      code:            'EXEC-005',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'The Spark cluster connection timed out during job submission. (Ref: {correlationId})',
      internalMessage: `Spark cluster submit request timed out for pipelineId="${pipelineId}"`,
      action:          'executions.submit',
      meta:            { pipelineId },
      cause,
    });
  },

  cancelForbidden(runId: string): AppError {
    return new AppError({
      code:            'EXEC-006',
      errorClass:      ErrorClass.AUTHORIZATION,
      userMessage:     'You do not have permission to cancel this pipeline run.',
      internalMessage: `Role check failed on cancel for runId="${runId}"`,
      action:          'executions.cancel',
      meta:            { runId },
    });
  },

  runAlreadyTerminal(runId: string, status: string): AppError {
    return new AppError({
      code:            'EXEC-007',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     'This run has already completed and cannot be cancelled.',
      internalMessage: `Cancel attempted on terminal run — runId="${runId}" status="${status}"`,
      action:          'executions.cancel',
      meta:            { runId, status },
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'EXEC-008',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred while starting the pipeline run. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in executions service',
      action:          'executions.unknown',
      cause,
    });
  },
};
