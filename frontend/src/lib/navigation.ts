/**
 * Navigation Abstraction
 * Replaces direct window.location and history manipulations across the application.
 * This decouples components from browser globals and router internals.
 */

/**
 * Pushes a new entry onto the history stack.
 */
export function navigate(path: string): void {
  if (isExternal(path)) {
    window.location.href = path;
    return;
  }
  window.history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("popstate"));
}

/**
 * Replaces the current entry on the history stack.
 */
export function replace(path: string): void {
  if (isExternal(path)) {
    window.location.replace(path);
    return;
  }
  window.history.replaceState(null, "", path);
  window.dispatchEvent(new CustomEvent("popstate"));
}

/**
 * Navigates back in the history stack.
 */
export function back(): void {
  window.history.back();
}

/**
 * Hard reloads the current page.
 * Use sparingly. Prefer state-based updates where possible.
 */
export function reload(): void {
  window.location.reload();
}
/**
 * Checks if a path is an external destination based on protocol.
 */
export function isExternal(path: string): boolean {
  if (!path) return false;
  return (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('sms:')
  );
}

/**
 * Checks if a path is internal to the application.
 */
export function isInternal(path: string): boolean {
  return !isExternal(path);
}
