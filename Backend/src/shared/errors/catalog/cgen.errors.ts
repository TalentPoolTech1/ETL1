import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** CGEN — Codegen Engine error factories */
export const cgenErrors = {

  unsupportedNodeType(nodeType: string): AppError {
    return new AppError({
      code:            'CGEN-001',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     `The pipeline design contains an unsupported node type: '${nodeType}'.`,
      internalMessage: `Node type "${nodeType}" not found in node generator registry`,
      action:          'codegen.generate',
      meta:            { nodeType },
    });
  },

  unsupportedEngine(engine: string): AppError {
    return new AppError({
      code:            'CGEN-002',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     `Spark engine '${engine}' is not supported. Supported engines: PySpark, Scala.`,
      internalMessage: `Unknown engine "${engine}" in codegen request — not in engine registry`,
      action:          'codegen.generate',
      meta:            { engine },
    });
  },

  missingNodeConfig(nodeId: string, fieldName: string): AppError {
    return new AppError({
      code:            'CGEN-003',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     `Node '${nodeId}' is missing required configuration: ${fieldName}.`,
      internalMessage: `Codegen config validation failed — nodeId="${nodeId}" missing field "${fieldName}"`,
      action:          'codegen.validate',
      meta:            { nodeId, fieldName },
    });
  },

  generationFailed(pipelineId: string, cause: Error): AppError {
    return new AppError({
      code:            'CGEN-004',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'Code generation failed for this pipeline. The design may contain an unsupported configuration. (Ref: {correlationId})',
      internalMessage: `Unhandled codegen exception for pipelineId="${pipelineId}"`,
      action:          'codegen.generate',
      meta:            { pipelineId },
      cause,
    });
  },

  artifactWriteFailed(pipelineId: string, cause: Error): AppError {
    return new AppError({
      code:            'CGEN-005',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'Generated code could not be stored. (Ref: {correlationId})',
      internalMessage: `Artifact write failed for pipelineId="${pipelineId}"`,
      action:          'codegen.persist',
      meta:            { pipelineId },
      cause,
    });
  },
};
