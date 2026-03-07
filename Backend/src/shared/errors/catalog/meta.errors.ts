import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** META — Metadata / Catalog error factories */
export const metaErrors = {

  datasetNotFound(datasetId: string): AppError {
    return new AppError({
      code:            'META-001',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'Dataset not found. It may have been deleted or moved.',
      internalMessage: `catalog.datasets lookup miss for datasetId="${datasetId}"`,
      action:          'metadata.find',
      meta:            { datasetId },
    });
  },

  datasetDuplicateName(name: string, connId: string): AppError {
    return new AppError({
      code:            'META-002',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `A dataset named '${name}' already exists in this connection.`,
      internalMessage: `Unique constraint violation on catalog.datasets (dataset_display_name + connector_id) for name="${name}" connId="${connId}"`,
      action:          'metadata.create',
      meta:            { datasetDisplayName: name, connId },
    });
  },

  datasetNameRequired(): AppError {
    return new AppError({
      code:            'META-003',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Dataset name is required.',
      internalMessage: 'Missing dataset_display_name in request body',
      action:          'metadata.validate',
      fieldErrors:     [{ field: 'dataset_display_name', message: 'Dataset name is required.' }],
    });
  },

  schemaDiscoveryFailed(datasetId: string, cause: Error): AppError {
    return new AppError({
      code:            'META-004',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'Schema discovery failed. Could not read the table structure from the data source. (Ref: {correlationId})',
      internalMessage: `Remote schema introspection failed for datasetId="${datasetId}"`,
      action:          'metadata.discoverSchema',
      meta:            { datasetId },
      cause,
    });
  },

  datasetHasDependentPipelines(datasetId: string, count: number): AppError {
    return new AppError({
      code:            'META-005',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `This dataset cannot be deleted because it is referenced by ${count} pipeline(s).`,
      internalMessage: `Delete blocked — catalog.pipeline_dataset_map FK references datasetId="${datasetId}" (${count} rows)`,
      action:          'metadata.delete',
      meta:            { datasetId, pipelineCount: count },
    });
  },

  columnsRequired(): AppError {
    return new AppError({
      code:            'META-006',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'At least one column definition is required.',
      internalMessage: 'catalog.dataset_columns would be empty — at least one column required',
      action:          'metadata.validate',
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'META-007',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred while reading metadata. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in metadata service',
      action:          'metadata.unknown',
      cause,
    });
  },
};
