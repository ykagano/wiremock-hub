/**
 * Compute the MCP endpoint URL for this Hub instance.
 *
 * The backend serves the MCP server at `POST /api/mcp`. `import.meta.env.BASE_URL`
 * carries the deployment base path (always ends with '/'):
 *   - dev / standalone: '/'      -> `<origin>/api/mcp`
 *   - all-in-one (nginx): '/hub/' -> `<origin>/hub/api/mcp`
 */
export function getMcpUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL + 'api/mcp';
}
