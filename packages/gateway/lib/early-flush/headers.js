/** Cookies and transport-specific metadata must never be replayed from sampled responses. */
export const nonReplayableHeaders = new Set([
  'set-cookie',
  'x-early-flush',
  'content-length',
  'content-encoding',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Gateway compression owns the final representation, including validators and digests.
  'etag',
  'content-md5',
  'digest',
  'content-digest',
  'repr-digest',
  'accept-ranges'
])

// Adapt Node header arrays without joining distinct Set-Cookie values.
export function toHeaders (values) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(values)) {
    // HTTP/2 pseudo-headers describe the request, not HTTP header fields.
    if (value !== undefined && !name.startsWith(':')) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        headers.append(name, String(entry))
      }
    }
  }
  return headers
}
