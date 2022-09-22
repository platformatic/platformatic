import parseArgs from 'minimist'
import { request } from 'undici'
import open from 'open'
import { blue, green, underline } from 'colorette'
import { lstat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import ConfigManager from '@platformatic/config'
import schema from './schema.js'

const AP_HOST = process.env.PLT_AUTH_PROXY_HOST || 'https://auth-proxy.fly.dev'

async function triggerAuthentication () {
  // call auth-proxy to get code
  const { statusCode, body } = await request(`${AP_HOST}/login`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
    }
  })

  if (statusCode !== 200) throw new Error('Unable to contact login service')

  return body.json()
}

async function getTokens (id) {
  const { statusCode, body } = await request(`${AP_HOST}/login/ready/${id}`)

  const data = await body.json()

  if (data.error && data.error === 'pending') {
    return { state: 'pending', data: { id } }
  } else if (statusCode === 200) {
    return { state: 'complete', data }
  } else {
    throw new Error('Unable to retrieve tokens')
  }
}

async function poll (id, timeout, interval) {
  const expiresAt = Date.now() + timeout

  async function check (resolve, reject) {
    let result
    try {
      result = await getTokens(id)
    } catch (err) {
      return reject(err)
    }

    const { state, data } = result

    if (Date.now() > expiresAt) {
      reject(new Error('User did not authenticate before expiry'))
    } else if (state === 'pending') {
      setTimeout(check, interval, resolve, reject)
    } else if (state === 'complete') {
      resolve(data)
    /* c8 ignore next 3 */
    } else {
      // do nothing, never get here
    }
  }

  return new Promise(check)
}

export default async function startLogin (_args, print) {
  const args = parseArgs(_args, {
    boolean: 'browser',
    string: ['claim', 'config']
  })

  let pltDirPath = path.join(process.env.PLT_HOME, '.platformatic')
  if (args.config) {
    const stats = await lstat(args.config)
    if (stats.isDirectory()) throw new Error('--config option requires path to a file')

    pltDirPath = path.dirname(args.config)
  }

  try {
    await mkdir(pltDirPath)
  /* c8 ignore next 2 */
  } catch {
  }

  const config = new ConfigManager({
    source: args.config || path.join(pltDirPath, 'config.yaml'),
    schema
  })

  const { verifyAt, expiresInSeconds, id, intervalSeconds } = await triggerAuthentication()

  // print browser url
  print(`Open ${blue(underline(verifyAt))} in your browser to continue logging in.`)

  // open browser if requested
  /* c8 ignore next 1 */
  if (args.browser) await open(verifyAt)

  const { tokens } = await poll(id, expiresInSeconds * 1000, intervalSeconds * 1000)
  const { state } = await registerUser(tokens, args.claim)
  await saveTokens(tokens, config)

  print(`${green(`Success, you have ${state}!`)}`)
  if (state === 'registered') {
    print(`Visit our Getting Started guide at ${blue(underline('https://docs.platforamtic.dev/getting-started'))} to build your first application`)
  }
}

async function saveTokens (tokens, config) {
  await config.update({ accessToken: tokens.access })
}

async function registerUser (tokens, invite) {
  // try to load user
  const userInfoRes = await request(`${AP_HOST}/users/self`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${tokens.access}`
    }
  })

  if (userInfoRes.statusCode !== 200) {
    throw new Error('Unable to get user data')
  }

  const { username, fromProvider } = await userInfoRes.body.json()
  if (username) {
    // user is already registered
    return { state: 'authenticated' }
  }

  // if no user but is claiming, do claim
  if (invite && fromProvider.sub) {
    const claimRes = await request(`${AP_HOST}/claim`, {
      method: 'POST',
      body: JSON.stringify({
        username: fromProvider.nickname,
        externalId: fromProvider.sub,
        invite
      }),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokens.access}`
      }
    })

    if (claimRes.statusCode !== 200) {
      throw new Error('Unable to claim invite')
    }

    return { state: 'registered' }
  }

  throw new Error('Missing invite')
}
