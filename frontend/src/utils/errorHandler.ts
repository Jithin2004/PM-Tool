export function formatDatabaseError(error: any): Error {
  if (!error) return new Error('An unknown error occurred');

  let message = error.message || 'An unknown error occurred';
  let code = error.code || error.error_code || '';

  // 1. Map known PostgreSQL/Supabase error codes to friendly messages
  const friendlyMessages: Record<string, string> = {
    'PGRST116': 'Record not found.',
    '42501': "You don't have permission to perform this action.",
    '23505': 'This record already exists.',
    '23503': 'This action is restricted because it affects linked data.',
    '42P01': 'System data structure is currently unavailable.',
    'P0001': 'Action rejected by business rules.',
  };

  if (code && friendlyMessages[code]) {
    message = friendlyMessages[code];
  } 
  // 2. Map known text snippets
  else if (message.includes('JWT') || message.includes('auth')) {
    message = 'Your session has expired. Please log in again.';
  } else if (message.includes('fetch') || message.includes('Failed to load')) {
    message = 'Network connection failed. Please check your internet connection.';
  }

  const newError = new Error(message);
  (newError as any).originalCode = code;
  return newError;
}
