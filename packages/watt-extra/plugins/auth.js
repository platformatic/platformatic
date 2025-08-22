import { readFile, stat } from 'node:fs/promises'
import { Agent } from 'undici'

const K8S_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token'

function decodeJwtPayload (token) {
  try {
    if (!token) return null
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null
    const payload = Buffer.from(base64Payload, 'base64').toString('utf8')
    return JSON.parse(payload)
  } catch (err) {
    return null
  }
}

function isTokenExpired (token, offset = 0) {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true

  // Check if token is expired
  const currentTime = Math.floor(Date.now() / 1000)
  return payload.exp <= (currentTime + offset)
}

async function authPlugin (app) {
  // Add a 1 min offset to update the token before it expires
  // via runtime shared context
  const offset = parseInt(process.env.PLT_JWT_EXPIRATION_OFFSET_SEC ?? 0)

  async function loadToken () {
    let token
    try {
      await stat(K8S_TOKEN_PATH)
      app.log.info('Loading JWT token from K8s service account')
      token = await readFile(K8S_TOKEN_PATH, 'utf8')
    } catch (err) {
      app.log.warn('Failed to load JWT token from K8s service account')
    }

    if (!token) {
      app.log.warn('K8s token not found, falling back to environment variable')
      token = process.env.PLT_TEST_TOKEN
    }

    return token
  }

  const getAuthorizationHeader = async (headers = {}) => {
    if (isTokenExpired(app.token, offset)) {
      app.log.info('JWT token expired, reloading')
      app.token = await loadToken()

      app.wattpro?.updateSharedContext({
        iccAuthHeaders: { authorization: `Bearer ${app.token}` }
      }).catch((err) => {
        app.log.error({ err }, 'Failed to update jwt token in shared context')
      })
    }

    return {
      ...headers,
      authorization: `Bearer ${app.token}`
    }
  }

  const authorizationTokenInterceptor = dispatch => {
    return async function InterceptedDispatch (opts, handler) {
      opts.headers = await getAuthorizationHeader(opts.headers)
      return dispatch(opts, handler)
    }
  }

  app.token = await loadToken()

  await setInterval(async () => {
    // Check if token is expired to propagate it to the runtime
    // via the shared context
    await getAuthorizationHeader()
  }, offset * 1000 / 2).unref()

  // We cannot change the global dispatcher because it's shared with the runtime main thread.
  const wattDispatcher = new Agent()
  app.dispatcher = wattDispatcher.compose(authorizationTokenInterceptor)
  app.getAuthorizationHeader = getAuthorizationHeader
}

export default authPlugin
