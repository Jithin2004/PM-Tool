/** Legacy / shorthand paths → canonical app paths */
export const ROUTE_ALIASES: Record<string, string> = {
  '/admin': '/control',
  '/logistics': '/resources',
  '/pipeline': '/execution',
  '/control/logistics': '/resources',
  '/resources/logistics': '/resources',
  '/settings': '/control/settings',
  '/integrations': '/control/connections',
  '/integration': '/control/connections',
};

export function normalizePath(pathname: string): string {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return ROUTE_ALIASES[path] ?? path;
}
