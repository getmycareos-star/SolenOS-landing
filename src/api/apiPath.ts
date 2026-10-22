export function resolveApiPath(path: string, apiBase: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const containsPlaceholder = /(?:^|[/?#=&])(?:demo|sample|test|fake|placeholder)[-_:][a-z0-9_-]+(?=$|[/?#&])/i.test(normalized)
    || /(?:^|[/?#=&])(?:current-user-id|team-moderator)(?=$|[/?#&])/i.test(normalized)
  if (containsPlaceholder) {
    throw new Error('A demo care-record identifier was detected. Select a real authorized care record before continuing.')
  }
  if (normalized.startsWith('/api/')) return normalized
  return `${apiBase.replace(/\/$/, '')}${normalized}`
}
