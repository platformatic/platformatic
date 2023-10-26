import parseArgs from 'minimist'
import open from 'open'
import { blue, green, underline } from 'colorette'
import { lstat, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { WebSocket } from 'ws'
import ConfigManager from '@platformatic/config'
import schema from './schema.js'
import errors from './errors.js'

const PLT_HOME = process.env.PLT_HOME || process.env.HOME
const PLT_DASHBOARD_HOST = process.env.PLT_DASHBOARD_HOST || 'https://platformatic.cloud'
const PLT_AUTH_PROXY_HOST = process.env.PLT_AUTH_PROXY_HOST || 'https://plt-production-auth-proxy.fly.dev'

function connectToAuthService (authProxyHost, opts) {
  const authProxyWsHost = authProxyHost.replace('http', 'ws')
  const ws = new WebSocket(authProxyWsHost + '/user-api-key')

  ws.on('open', async () => {
    ws.send(JSON.stringify({ type: 'CREATE_USER_API_KEY' }))
  })

  ws.on('message', async (message) => {
    message = JSON.parse(message.toString())

    if (message.type === 'CREATE_USER_API_KEY_REQ_ID') {
      const { reqId } = message.data
      await opts.onReqId(reqId)
      return
    }

    if (message.type === 'CREATE_USER_API_KEY_RESULT') {
      const { userApiKey } = message.data
      await opts.onUserApiKey(userApiKey)

      ws.close()
      return
    }
    /* c8 ignore next 1 */
    throw new errors.UnknownMessageTypeError(message.type)
  })

  ws.on('error', function error (err) {
    opts.onError(err)
    ws.close()
  })
}

function generateVerifyUrl (dashboardHost, reqId) {
  return `${dashboardHost}/#/?reqId=${reqId}`
}

export default async function startLogin (_args, print) {
  const args = parseArgs(_args, {
    boolean: 'browser',
    string: ['config', 'auth-proxy-host', 'dashboard-host', 'platformatic-home'],
    default: {
      browser: process.stdout.isTTY
    }
  })

  /* c8 ignore next 2 */
  const dashboardHost = args['dashboard-host'] || PLT_DASHBOARD_HOST
  const authProxyHost = args['auth-proxy-host'] || PLT_AUTH_PROXY_HOST
  const platformaticHome = args['platformatic-home'] || PLT_HOME

  let pltDirPath = path.join(platformaticHome, '.platformatic')
  if (args.config) {
    const stats = await lstat(args.config)
    if (stats.isDirectory()) {
      throw new errors.ConfigOptionRequiresPathToFileError()
    }
    pltDirPath = path.dirname(args.config)
  }

  await mkdir(pltDirPath).catch(() => {})

  const config = new ConfigManager({
    /* c8 ignore next 1 */
    source: args.config || path.join(pltDirPath, 'config.json'),
    schema
  })

  return new Promise((resolve, reject) => {
    connectToAuthService(authProxyHost, {
      async onReqId (reqId) {
        const verifyAt = generateVerifyUrl(dashboardHost, reqId)
        print(`Open ${blue(underline(verifyAt))} in your browser to continue logging in.`)

        // open browser if requested
        /* c8 ignore next 1 */
        if (args.browser) await open(verifyAt)
      },
      async onUserApiKey (userApiKey) {
        await saveUserApiKey(config, userApiKey)

        print(`${green('User api key was successfully generated!')}`)
        print(`Visit our Getting Started guide at ${blue(underline('https://docs.platforamtic.dev/getting-started'))} to build your first application`)

        resolve(userApiKey)
      },
      onError (err) {
        reject(new errors.UnableToContactLoginServiceError(err))
      }
    })
  })
}

async function saveUserApiKey (config, userApiKey) {
  await config.update({ $schema: config.schema.$id, userApiKey })
  await writeFile(config.fullPath, JSON.stringify(config.current, null, 2))
}
