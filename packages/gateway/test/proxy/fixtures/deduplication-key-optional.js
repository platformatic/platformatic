export function computeDeduplicationKey (request, context) {
  if (request.headers['x-no-dedup']) {
    return null
  }

  return `${context.origin}:${context.method}:${context.url}`
}
