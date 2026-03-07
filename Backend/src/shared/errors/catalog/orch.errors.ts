import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** ORCH — Orchestrators error factories */
export const orchErrors = {

  nameRequired(): AppError {
    return new AppError({
      code:            'ORCH-001',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Orchestrator name is required.',
      internalMessage: 'Missing orch_display_name in request body',
      action:          'orchestrators.validate',
      fieldErrors:     [{ field: 'orch_display_name', message: 'Orchestrator name is required.' }],
    });
  },

  duplicateName(name: string): AppError {
    return new AppError({
      code:            'ORCH-002',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `An orchestrator named '${name}' already exists.`,
      internalMessage: `Unique constraint violation on catalog.orchestrators.orch_display_name for name="${name}"`,
      action:          'orchestrators.create',
      meta:            { orchDisplayName: name },
    });
  },

  notFound(orchId: string): AppError {
    return new AppError({
      code:            'ORCH-003',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'Orchestrator not found. It may have been deleted.',
      internalMessage: `catalog.orchestrators lookup miss for orchId="${orchId}"`,
      action:          'orchestrators.find',
      meta:            { orchId },
    });
  },

  invalidCronExpression(expr: string): AppError {
    return new AppError({
      code:            'ORCH-004',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     "Schedule expression is not valid. Use a valid cron expression (e.g. '0 2 * * *').",
      internalMessage: `Cron expression parse failed for "${expr}"`,
      action:          'orchestrators.validate',
      meta:            { cronExpression: expr },
      fieldErrors:     [{ field: 'cronExpression', message: "Use a valid cron expression (e.g. '0 2 * * *')." }],
    });
  },

  noPipelinesAssigned(): AppError {
    return new AppError({
      code:            'ORCH-005',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'An orchestrator must reference at least one pipeline.',
      internalMessage: 'Orchestrator pipeline list is empty — at least one pipeline_id required',
      action:          'orchestrators.validate',
    });
  },

  schedulerRegistrationFailed(orchId: string, cause: Error): AppError {
    return new AppError({
      code:            'ORCH-006',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'Failed to register the schedule with the scheduler engine. (Ref: {correlationId})',
      internalMessage: `Scheduler backend rejected registration for orchId="${orchId}"`,
      action:          'orchestrators.schedule',
      meta:            { orchId },
      cause,
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'ORCH-007',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred while saving the orchestrator. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in orchestrators service',
      action:          'orchestrators.unknown',
      cause,
    });
  },
};
