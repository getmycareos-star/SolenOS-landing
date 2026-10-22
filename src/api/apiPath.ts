export function resolveApiPath(path: string, apiBase: string): string {
  if (/(^|\\/)demo-person-id(?:[/?#]|$)/i.test(path)) {
    throw new Error('A demo care-record identifier was detected. Select a real authorized care record before continuing.');
  }
  return path.startsWith('/api/') ? path : `${apiBase}${path}`;
}
