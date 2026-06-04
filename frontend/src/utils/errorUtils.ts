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
    return "The requested record could not be found.";
  }

  // Unique constraint violation
  if (code === '23505') {
    return "This record already exists.";
  }

  // Foreign key violation
  if (code === '23503') {
    return "This record cannot be deleted because it is referenced elsewhere.";
  }

  // Network errors
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
    return "Network connection lost. Please check your connection and try again.";
  }
  
  if (message.includes('JWT') || code === '401') {
    return "Your session has expired. Please log in again.";
  }

  return message || 'An unexpected error occurred.';
}
