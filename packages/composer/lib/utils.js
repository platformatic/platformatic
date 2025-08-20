export function prefixWithSlash (url) {
  if (typeof url === 'string') {
    return url.startsWith('/') ? url : `/${url}`
  }
  return ''
}

/**
 * detect if a application if fetchable, so if it has configuration to retrieve schema info (openapi or gql)
 * a application can have openapi and/or gql either from a remote application or from file
 * note application.origin is always been set if missing at index.js/platformaticComposer
 * @returns {boolean}
 */
export function isFetchable (application) {
  return Boolean((application?.openapi && application.openapi.url) || application?.graphql)
}
