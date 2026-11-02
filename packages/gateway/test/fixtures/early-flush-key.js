export async function computePreludeKey (request, { route }) {
  if (request.headers['x-skip']) {
    return null
  }
  return `${request.method} ${route} ${request.headers['accept-language'] ?? ''}`
}
