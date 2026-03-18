import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** USR — Users & Authentication error factories */
export const usrErrors = {

  emailRequired(): AppError {
    return new AppError({
      code:            'USR-001',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Email address is required.',
      internalMessage: 'Missing user_email in request body',
      action:          'users.validate',
      fieldErrors:     [{ field: 'user_email', message: 'Email address is required.' }],
    });
  },

  emailFormatInvalid(email: string): AppError {
    return new AppError({
      code:            'USR-002',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'The email address format is not valid.',
      internalMessage: `user_email failed RFC-5322 format check: "${email}"`,
      action:          'users.validate',
      meta:            { email },
      fieldErrors:     [{ field: 'user_email', message: 'The email address format is not valid.' }],
    });
  },

  emailAlreadyExists(): AppError {
    return new AppError({
      code:            'USR-003',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     'An account with this email address already exists.',
      internalMessage: 'Unique constraint violation on gov.users.user_email',
      action:          'users.create',
    });
  },

  passwordPolicyFailed(): AppError {
    return new AppError({
      code:            'USR-004',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Password must be at least 12 characters and include a number and a special character.',
      internalMessage: 'Password failed complexity policy check',
      action:          'users.validate',
      fieldErrors:     [{ field: 'password', message: 'Password must be at least 12 characters and include a number and a special character.' }],
    });
  },

  invalidCredentials(): AppError {
    return new AppError({
      code:            'USR-005',
      errorClass:      ErrorClass.AUTHENTICATION,
      // Generic — never reveal which field is wrong (prevents user enumeration)
      userMessage:     'Incorrect email or password. Please try again.',
      internalMessage: 'Credential mismatch during login — email or hashed password did not match',
      action:          'users.login',
    });
  },

  sessionExpired(): AppError {
    return new AppError({
      code:            'USR-006',
      errorClass:      ErrorClass.AUTHENTICATION,
      userMessage:     'Your session has expired. Please log in again.',
      internalMessage: 'JWT exp claim exceeded',
      action:          'users.authenticate',
    });
  },

  tokenInvalid(): AppError {
    return new AppError({
      code:            'USR-007',
      errorClass:      ErrorClass.AUTHENTICATION,
      userMessage:     'Your access token is not valid. Please log in again.',
      internalMessage: 'JWT signature invalid or token malformed',
      action:          'users.authenticate',
    });
  },

  notFound(userId: string): AppError {
    return new AppError({
      code:            'USR-008',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     'User not found.',
      internalMessage: `gov.users lookup miss for userId="${userId}"`,
      action:          'users.find',
      meta:            { userId },
    });
  },

  forbidden(): AppError {
    return new AppError({
      code:            'USR-009',
      errorClass:      ErrorClass.AUTHORIZATION,
      userMessage:     'You do not have permission to perform this action.',
      internalMessage: 'User role check failed — insufficient permissions',
      action:          'users.authorize',
    });
  },

  firstNameRequired(): AppError {
    return new AppError({
      code:            'USR-010',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'First name is required.',
      internalMessage: 'Missing user_first_name in request body',
      action:          'users.validate',
      fieldErrors:     [{ field: 'user_first_name', message: 'First name is required.' }],
    });
  },

  lastNameRequired(): AppError {
    return new AppError({
      code:            'USR-011',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Last name is required.',
      internalMessage: 'Missing user_last_name in request body',
      action:          'users.validate',
      fieldErrors:     [{ field: 'user_last_name', message: 'Last name is required.' }],
    });
  },

  roleAlreadyAssigned(role: string, projectId: string): AppError {
    return new AppError({
      code:            'USR-012',
      errorClass:      ErrorClass.CONFLICT,
      userMessage:     `This user already has the role '${role}' on this project.`,
      internalMessage: `Duplicate gov.project_user_roles entry for role="${role}" projectId="${projectId}"`,
      action:          'users.assignRole',
      meta:            { role, projectId },
    });
  },

  invalidRole(role: string): AppError {
    return new AppError({
      code:            'USR-013',
      errorClass:      ErrorClass.VALIDATION,
      userMessage:     'Invalid role. Allowed roles are: Viewer, Editor, Admin.',
      internalMessage: `Unknown role code "${role}" in role assignment request`,
      action:          'users.validate',
      meta:            { role },
    });
  },

  unauthorized(internalDetail: string, opts?: { cause?: Error }): AppError {
    return new AppError({
      code:            'USR-015',
      errorClass:      ErrorClass.AUTHENTICATION,
      userMessage:     'Authentication required. Please provide a valid token.',
      internalMessage: internalDetail,
      action:          'users.authenticate',
      cause:           opts?.cause as Error | undefined,
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'USR-014',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred while processing your account. Please try again. If this persists, contact support with reference {correlationId}.',
      internalMessage: 'Unhandled error in users service',
      action:          'users.unknown',
      cause,
    });
  },
};
