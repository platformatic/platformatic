import { subscribe } from 'node:diagnostics_channel'

// Skew protection pins a browser session to one deployment version.

export const DEFAULT_COOKIE_NAME = '__plt_dpl'
export const DEFAULT_COOKIE_MAX_AGE = 43200
const PREVIEW_HEADER = 'x-deployment-id'

export function resolveSkewConfig (env) {
  if (env.PLT_SKEW_PROTECTION !== 'true') return null

  const maxAge = Number(env.PLT_SKEW_COOKIE_MAX_AGE)
  return {
    cookieName: env.PLT_SKEW_COOKIE_NAME || DEFAULT_COOKIE_NAME,
    maxAge: maxAge > 0 ? maxAge : DEFAULT_COOKIE_MAX_AGE
  }
}

export function createVersionResolver (sharedContext, env) {
  return function currentVersion () {
    return sharedContext?.getSync()?.deploymentVersion || env.PLT_DEPLOYMENT_VERSION || null
  }
}

function hasCookie (cookieHeader, name) {
  if (!cookieHeader) return false

  for (const pair of String(cookieHeader).split(';')) {
    const eq = pair.indexOf('=')
    if (eq !== -1 && pair.slice(0, eq).trim() === name) return true
  }
  return false
}

// An instance knows its own version but not whether it is the active one, so
// the decision is made from the request alone.
export function shouldIssueCookie (headers, cookieName) {
  // A preview request names its version explicitly and must not pin the browser
  // to it; the Gateway's preview rule sets no cookie either.
  if (headers[PREVIEW_HEADER]) return false

  // An existing pin is never refreshed. A draining version only ever receives
  // requests that are already pinned to it, so refreshing would extend its own
  // pin on every request and it could never finish draining.
  return !hasCookie(headers.cookie, cookieName)
}

export function buildCookie ({ cookieName, version, path, maxAge }) {
  return `${cookieName}=${version}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

function appendSetCookie (response, headers, cookie) {
  // writeHead's own headers win over anything set earlier, so when the caller
  // passes set-cookie there it has to be appended in place.
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'set-cookie') {
        const existing = headers[key]
        headers[key] = Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]
        return
      }
    }
  }

  const existing = response.getHeader('set-cookie')
  if (existing === undefined) {
    response.setHeader('set-cookie', cookie)
  } else {
    response.setHeader('set-cookie', Array.isArray(existing) ? [...existing, cookie] : [existing, cookie])
  }
}

// Works on the raw response rather than through a Fastify hook, because an
// entrypoint can be any capability (node, next, astro) with its own server.
//
// The cookie is appended at writeHead rather than set here, because a header set
// this early is silently dropped: writeHead's own headers replace same-named ones
// set beforehand, so any app that sets its own cookie would erase this one. Only
// the response instance is patched -- the prototype is left alone, so nothing
// leaks to other servers in this worker.
export function installSkewProtection ({ getVersion, cookieName, maxAge, basePath }) {
  const path = basePath || '/'

  subscribe('http.server.request.start', ({ request, response }) => {
    if (!shouldIssueCookie(request.headers, cookieName)) return

    const version = getVersion()
    if (!version) return

    const cookie = buildCookie({ cookieName, version, path, maxAge })
    const originWriteHead = response.writeHead

    // Every response reaches writeHead: explicitly, or through _implicitHeader
    // when the handler only calls end().
    response.writeHead = function (statusCode, statusMessage, headers) {
      if (headers === undefined && typeof statusMessage === 'object' && statusMessage !== null) {
        headers = statusMessage
        statusMessage = undefined
      }

      appendSetCookie(this, headers, cookie)
      return originWriteHead.call(this, statusCode, statusMessage, headers)
    }
  })
}
