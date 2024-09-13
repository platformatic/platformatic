import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { request } from 'undici'

export function getServerUrl (server) {
  const { family, address, port } = server.address()

  return new URL(family === 'IPv6' ? `http://[${address}]:${port}` : `http://${address}:${port}`).origin
}

export async function injectViaRequest (baseUrl, injectParams, onInject) {
  const url = new URL(injectParams.url, baseUrl).href
  const requestParams = { method: injectParams.method, headers: injectParams.headers }

  if (injectParams.body) {
    const body = injectParams.body
    requestParams.body = typeof body === 'object' ? JSON.stringify(body) : body
  }

  try {
    const { statusCode, headers, body } = await request(url, requestParams)

    const rawPayload = Buffer.from(await body.arrayBuffer())
    const payload = rawPayload.toString()
    const response = { statusCode, headers, body: payload, payload, rawPayload }

    if (onInject) {
      return onInject(null, response)
    }

    return response
  } catch (error) {
    if (onInject) {
      onInject(error)
      return
    }

    throw error
  }
}

export function ensureFileUrl (pathOrUrl) {
  if (!pathOrUrl) {
    return pathOrUrl
  }

  pathOrUrl = pathOrUrl.toString()

  if (pathOrUrl.startsWith('file://')) {
    return pathOrUrl
  }

  return pathToFileURL(pathOrUrl)
}

// This is to avoid common path/URL problems on Windows
export function importFile (path) {
  return import(ensureFileUrl(path))
}

export function resolvePackage (root, pkg) {
  const require = createRequire(root)

  return require.resolve(pkg, { paths: [root, ...require.main.paths] })
}

export function cleanBasePath (basePath) {
  return basePath ? `/${basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '') : '/'
}

export function ensureTrailingSlash (basePath) {
  return basePath ? `${basePath}${basePath.endsWith('/') ? '' : '/'}` : '/'
}
