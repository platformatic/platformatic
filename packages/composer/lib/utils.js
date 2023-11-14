'use strict'

function prefixWithSlash (url) {
  if (typeof url === 'string') {
    return url.startsWith('/')
      ? url
      : `/${url}`
  }
  return ''
}

/**
 * detect if a service if fetchable, so if it has configuration to retrieve schema info (openapi or gql)
 * a service can have openapi and/or gql either from a remote service or from file
 * note service.origin is always been set if missing at index.js/platformaticComposer
 * @returns {boolean}
*/
function isFetchable (service) {
  return Boolean(
    (service?.openapi && service.openapi.url) || service?.graphql
  )
}

module.exports = {
  prefixWithSlash,
  isFetchable
}
