export function prefixWithSlash (url) {
  if (typeof url === 'string') {
    return url.startsWith('/') ? url : `/${url}`
  }
  return ''
}

// Normalize an application prefix so that it always starts with a slash and
// never ends with one, avoiding double slashes in the composed paths.
export function normalizePrefix (prefix) {
  if (typeof prefix !== 'string') {
    return ''
  }

  return prefixWithSlash(prefix).replace(/\/+$/, '')
}

/**
 * detect if a application if fetchable, so if it has configuration to retrieve schema info (openapi or gql)
 * a application can have openapi and/or gql either from a remote application or from file
 * note application.origin is always been set if missing at index.js
 * @returns {boolean}
 */
export function isFetchable (application) {
  return Boolean((application?.openapi && application.openapi.url) || application?.graphql)
}
