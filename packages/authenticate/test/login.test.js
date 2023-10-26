import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { blue, green, underline } from 'colorette'
import login from '../lib/login.js'
import { createAuthProxy } from './helper.js'

const MSG_VERIFY_AT_URL = /^Open .*https:\/\/platformatic.cloud\/#\/\?reqId=.*? in your browser to continue logging in.$/
const MSG_API_KEY_GENERATED = `${green('User api key was successfully generated!')}`
const MSG_GETTING_STARTED = `Visit our Getting Started guide at ${blue(underline('https://docs.platforamtic.dev/getting-started'))} to build your first application`

// Ordered message assertions
function assertMessages (expecting) {
  return message => {
    const expectingMessage = expecting.shift()
    if (expectingMessage === undefined) {
      assert.fail(`Unexpected message: ${message}`)
    }
    if (typeof expectingMessage === 'string') {
      assert.equal(message, expectingMessage)
    } else {
      assert.match(message, expectingMessage)
    }
  }
}

test('should generate a user api key', async (t) => {
  const platformaticDir = await mkdtemp(join(tmpdir(), 'plt-authenticate-'))
  const configPath = join(platformaticDir, 'config.json')
  await writeFile(configPath, '')

  let userApiKey = null
  const authProxy = await createAuthProxy(t, {
    onReqId (reqId) {
      assert.match(reqId, /^[a-z0-9-]{32}$/)
    },
    onUserApiKey (key) {
      userApiKey = key
      assert.match(key, /^[a-z0-9-]{32}$/)
    }
  })
  const authProxyPort = authProxy.server.address().port

  const args = [
    '--config', configPath,
    '--auth-proxy-host', `http://127.0.0.1:${authProxyPort}`
  ]

  const print = assertMessages([
    MSG_VERIFY_AT_URL,
    MSG_API_KEY_GENERATED,
    MSG_GETTING_STARTED
  ])

  await login(args, print)

  const config = await readFile(configPath, 'utf-8')

  const packageFile = await readFile(new URL('../package.json', import.meta.url), 'utf-8')
  const pkg = JSON.parse(packageFile)
  const version = 'v' + pkg.version

  assert.deepStrictEqual(JSON.parse(config), {
    $schema: `https://platformatic.dev/schemas/${version}/login`,
    userApiKey
  })
})

test('should fail if an auth proxy is unavailable', async (t) => {
  const platformaticDir = await mkdtemp(join(tmpdir(), 'plt-authenticate-'))
  const configPath = join(platformaticDir, 'config.json')
  await writeFile(configPath, '')

  const args = [
    '--config', configPath,
    '--auth-proxy-host', 'http://127.0.0.1:9999'
  ]

  const print = assertMessages([])
  try {
    await login(args, print)
  } catch (err) {
    assert.match(err.message, /Unable to contact login service/)
  }

  const config = await readFile(configPath, 'utf-8')
  assert.strictEqual(config, '')
})

test('should fail if config path is a dir', async (t) => {
  const platformaticDir = await mkdtemp(join(tmpdir(), 'plt-authenticate-'))
  const configPath = join(platformaticDir, 'config.json')
  await writeFile(configPath, '')

  const args = [
    '--config', platformaticDir,
    '--auth-proxy-host', 'http://127.0.0.1:9999'
  ]

  const print = assertMessages([])
  try {
    await login(args, print)
  } catch (err) {
    assert.match(err.message, /--config option requires path to a file/)
  }
})
