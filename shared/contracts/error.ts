export type ErrorCategory =
  | 'Validation'
  | 'Authentication'
  | 'Authorization'
  | 'Business'
  | 'Infrastructure'
  | 'External Dependency'
  | 'Conflict'
  | 'Unexpected';

export interface StandardErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  correlationId: string;
  retryable: boolean;
  httpStatus: number;
  category: ErrorCategory;
}

export class PlatformError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public correlationId?: string;
  public retryable: boolean;
  public httpStatus: number;
  public category: ErrorCategory;

  constructor(params: {
    code: string;
    message: string;
    details?: Record<string, any>;
    correlationId?: string;
    retryable?: boolean;
    httpStatus: number;
    category: ErrorCategory;
  }) {
    super(params.message);
    this.name = 'PlatformError';
    this.code = params.code;
    this.details = params.details;
    this.correlationId = params.correlationId;
    this.retryable = params.retryable ?? false;
    this.httpStatus = params.httpStatus;
    this.category = params.category;
  }

  public toResponse(correlationId: string): StandardErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      correlationId: this.correlationId || correlationId,
      retryable: this.retryable,
      httpStatus: this.httpStatus,
      category: this.category,
    };
  }
}
