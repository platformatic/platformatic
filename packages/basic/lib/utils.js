import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request } from 'undici'

export function getServerUrl (server) {
  const { family, address, port } = server.address()

  return new URL(family === 'IPv6' ? `http://[${address}]:${port}` : `http://${address}:${port}`).origin
}

export async function injectViaRequest (baseUrl, injectParams, onInject) {
  try {
    const url = new URL(injectParams.url, baseUrl).href
    const requestParams = { method: injectParams.method, headers: injectParams.headers }

    if (injectParams.body) {
      const body = injectParams.body
      requestParams.body = typeof body === 'object' ? JSON.stringify(body) : body
    }

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

/* c8 ignore next 4 */
// This is to avoid common path/URL problems on Windows
export function importFile (path) {
  return import(ensureFileUrl(path))
}

/* c8 ignore next 6 */
export function resolvePackageViaCJS (root, pkg) {
  const require = createRequire(root)
  // We need to add the main module paths to the require.resolve call
  // Note that `require.main` is not defined in `next` if we set sthe instrumentation hook reequired for ESM applications.
  // see: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md#instrumentation-hook-required-for-esm
  return require.resolve(pkg, { paths: [root, ...(require.main?.paths || [])] })
}

/* c8 ignore next 14 */
export async function resolvePackageViaESM (root, pkg) {
  // Use import.meta.resolve if available first, since it also understands ESM only packages
  try {
    const url = await import.meta.resolve(pkg)
    return fileURLToPath(new URL(url))
  } catch {
    // Fallback to CJS resolution
    return resolvePackageViaCJS(root, pkg)
  }
}

export function cleanBasePath (basePath) {
  return basePath ? `/${basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '') : '/'
}

export function ensureTrailingSlash (basePath) {
  return basePath ? `${basePath}${basePath.endsWith('/') ? '' : '/'}` : '/'
}

// TODO: This is for backwards compatibility, remove in future major release
export const resolvePackage = resolvePackageViaCJS
