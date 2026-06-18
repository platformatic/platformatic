export function computeDeduplicationKey (_request, context) {
  return `${context.origin}:${context.method}:custom`
}
