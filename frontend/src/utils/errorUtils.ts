export function getFriendlyErrorMessage(err: any): string {
  if (!err) return 'An unknown error occurred.';
  
  const code = err.code || err.statusCode;
  const message = err.message || err.details || '';

  // Permission / RLS Errors
  if (code === '42501' || message.includes('RLS') || message.includes('permission')) {
    return "You don't have permission to perform this action.";
  }

  // Not Found
  if (code === 'PGRST116') {
    return "The requested item could not be found.";
  }

  // Unique constraint violation
  if (code === '23505') {
    return "This item already exists.";
  }

  // Foreign key violation
  if (code === '23503') {
    return "This item cannot be deleted because it is currently in use.";
  }

  // Network errors
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
    return "Connection issue. Please check your internet and try again.";
  }
  
  if (message.includes('JWT') || code === '401') {
    return "Your session has expired. Please log in again.";
  }

  // Catch backend technical leaks
  const msgLower = message.toLowerCase();
  if (msgLower.includes('rpc') || msgLower.includes('mutation') || msgLower.includes('schema') || msgLower.includes('payload') || msgLower.includes('entity') || msgLower.includes('failed request')) {
    return "Could not save changes. Please try again.";
  }

  return message || 'Update failed. Please try again.';
}
