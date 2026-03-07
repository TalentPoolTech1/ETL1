import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** GOV — Governance / RBAC error factories */
export const govErrors = {

  projectNotFound(projectId: string): AppError {
    return new AppError({
      code:            'GOV-001',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'Project not found. It may have been deleted.',
      internalMessage: `etl.projects lookup miss for projectId="${projectId}"`,
      action:          'governance.find',
      meta:            { projectId },
    });
  },

  projectDuplicateName(name: string): AppError {
    return new AppError({
      code:            'GOV-002',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `A project named '${name}' already exists.`,
      internalMessage: `Unique constraint violation on etl.projects.project_display_name for name="${name}"`,
      action:          'governance.create',
      meta:            { projectDisplayName: name },
    });
  },

  projectNameRequired(): AppError {
    return new AppError({
      code:            'GOV-003',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Project name is required.',
      internalMessage: 'Missing project_display_name in request body',
      action:          'governance.validate',
      fieldErrors:     [{ field: 'project_display_name', message: 'Project name is required.' }],
    });
  },

  projectForbidden(projectId: string): AppError {
    return new AppError({
      code:            'GOV-004',
      errorClass:      ErrorClass.AUTHORIZATION,
      userMessage:     'You do not have permission to perform this action on this project.',
      internalMessage: `Project-level role check failed for projectId="${projectId}"`,
      action:          'governance.authorize',
      meta:            { projectId },
    });
  },

  projectHasActivePipelines(projectId: string, count: number): AppError {
    return new AppError({
      code:            'GOV-005',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `This project cannot be deleted because it contains ${count} active pipeline(s). Delete all pipelines first.`,
      internalMessage: `Delete blocked — catalog.pipelines FK references projectId="${projectId}" (${count} rows)`,
      action:          'governance.delete',
      meta:            { projectId, pipelineCount: count },
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'GOV-006',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred in access control. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in governance service',
      action:          'governance.unknown',
      cause,
    });
  },
};
