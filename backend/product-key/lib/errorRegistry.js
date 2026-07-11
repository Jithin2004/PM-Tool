const ErrorRegistry = {
  AUTH_INVALID_TOKEN: {
    httpStatus: 401,
    category: 'AUTH',
    severity: 'SECURITY',
    retryable: false,
    message: 'Invalid authentication token'
  },
  AUTH_USER_NOT_FOUND: {
    httpStatus: 401,
    category: 'AUTH',
    severity: 'SECURITY',
    retryable: false,
    message: 'Authenticated user profile not found'
  },
  LICENSE_NOT_FOUND: {
    httpStatus: 404,
    category: 'LICENSE',
    severity: 'WARN',
    retryable: false,
    message: 'Product key does not exist'
  },
  LICENSE_ALREADY_USED: {
    httpStatus: 409,
    category: 'LICENSE',
    severity: 'WARN',
    retryable: false,
    message: 'Product key is assigned to another workspace'
  },
  WORKSPACE_ALREADY_EXISTS: {
    httpStatus: 409,
    category: 'WORKSPACE',
    severity: 'WARN',
    retryable: false,
    message: 'Workspace ID or URL conflict'
  },
  WORKSPACE_TRANSACTION_FAILED: {
    httpStatus: 500,
    category: 'RPC',
    severity: 'ERROR',
    retryable: true,
    message: 'Database onboarding transaction failed'
  },
  DATABASE_TIMEOUT: {
    httpStatus: 504,
    category: 'SYSTEM',
    severity: 'ERROR',
    retryable: true,
    message: 'Database connection timed out'
  },
  UNKNOWN_ERROR: {
    httpStatus: 500,
    category: 'SYSTEM',
    severity: 'ERROR',
    retryable: false,
    message: 'An unexpected server error occurred'
  }
};

module.exports = ErrorRegistry;
