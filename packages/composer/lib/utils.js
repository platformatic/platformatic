'use strict'

function prefixWithSlash (url) {
  if (typeof url === 'string') {
    return url.startsWith('/')
      ? url
      : `/${url}`
  }
  return ''
}

module.exports.prefixWithSlash = prefixWithSlash
