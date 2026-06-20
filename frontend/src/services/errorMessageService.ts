export const errorMessageService = {
  translate(error: any): string {
    if (!error) return 'An unexpected error occurred.';

    const message = typeof error === 'string' 
      ? error.toLowerCase() 
      : (error.message || error.error_description || JSON.stringify(error)).toLowerCase();

    // Database Permission / RLS
    if (
      message.includes('rls') || 
      message.includes('policy') || 
      message.includes('permission denied') ||
      message.includes('new row violates row-level security')
    ) {
      return "You don't have permission to view or modify this.";
    }

    // Foreign Key / Dependency
    if (
      message.includes('foreign key constraint failed') ||
      message.includes('violates foreign key') ||
      message.includes('still referenced') ||
      message.includes('update or delete on table') ||
      message.includes('is connected to')
    ) {
      return "This item is connected to other data and cannot be removed.";
    }

    // Unique Constraint
    if (
      message.includes('unique constraint') ||
      message.includes('already exists') ||
      message.includes('duplicate key')
    ) {
      return "An item with this name or identifier already exists.";
    }

    // Authentication / Session
    if (
      message.includes('jwt') ||
      message.includes('token expired') ||
      message.includes('not authenticated') ||
      message.includes('invalid credentials')
    ) {
      return "Your session expired or is invalid. Please sign in again.";
    }

    // Network Failures
    if (
      message.includes('fetch failed') ||
      message.includes('networkerror') ||
      message.includes('failed to fetch') ||
      message.includes('connection refused') ||
      message.includes('offline')
    ) {
      return "Connection problem. Please try again.";
    }

    // Storage Failures
    if (
      message.includes('storage') ||
      message.includes('upload failed') ||
      message.includes('file size') ||
      message.includes('mime type')
    ) {
      return "The file could not be uploaded. Please try again.";
    }

    // Generic fallback for unhandled technical errors
    if (
      message.includes('postgres') ||
      message.includes('relation "') ||
      message.includes('syntax error') ||
      message.includes('internal server error') ||
      message.includes('cannot read properties') ||
      message.includes('undefined is not an object') ||
      message.includes('null value in column')
    ) {
      return "An unexpected system error occurred. Please try again later.";
    }

    // If it's none of the above, but it's a string, we might just return it capitalized if it's not JSON
    if (typeof error === 'string' && !error.startsWith('{')) {
      return error;
    }
    
    if (error.message && !error.message.startsWith('{')) {
      return error.message;
    }

    return "An unexpected error occurred.";
  }
};
