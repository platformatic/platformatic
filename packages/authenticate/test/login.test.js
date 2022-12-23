import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, test } from 'tap'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { blue, green, underline } from 'colorette'
import login from '../lib/login.js'

let mockAgent

async function makeConfig (config = '', name = 'pltconf.json', setHomeDir = false) {
  let tmpPath = await mkdtemp(path.join(tmpdir(), 'plt-authenticate-'))
  if (setHomeDir) {
    process.env.PLT_HOME = tmpPath // don't move this line
    tmpPath = path.join(tmpPath, '.platformatic')
    await mkdir(tmpPath)
  }

  const filename = path.join(tmpPath, name)
  await writeFile(filename, config)
  return filename
}

const MSG_VERIFY_AT_URL = `Open ${blue(underline('https://some-auth.pro/vider'))} in your browser to continue logging in.`
const MSG_REGISTERED = `${green('Success, you have registered!')}`
const MSG_AUTHENTICATED = `${green('Success, you have authenticated!')}`
const MSG_GETTING_STARTED = `Visit our Getting Started guide at ${blue(underline('https://docs.platforamtic.dev/getting-started'))} to build your first application`

// Ordered message assertions
function assertMessages (t, expecting) {
  return message => t.equal(message, expecting.shift())
}

beforeEach(() => {
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()

  process.env.PLT_AUTH_PROXY_HOST = 'http://127.0.0.1:3000'
  process.env.PLT_HOME = ''
})

test('should be able to login as an existing user immediately', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 900,
    id: 'abc123',
    intervalSeconds: 5
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, {
    username: 'person',
    role: 'invitee',
    fromProvider: {
      sub: 'github|16238872'
    }
  })

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL, MSG_AUTHENTICATED])
  await t.resolves(login(args, print))

  const actual = await readFile(confPath)
  t.same(JSON.parse(actual), { accessToken: '1234' })
})

test('should use home directory config', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 900,
    id: 'abc123',
    intervalSeconds: 5
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, {
    username: 'person',
    role: 'invitee',
    fromProvider: {
      sub: 'github|16238872'
    }
  })

  const confPath = await makeConfig('', 'config.json', true)

  const print = assertMessages(t, [MSG_VERIFY_AT_URL, MSG_AUTHENTICATED])
  await t.resolves(login([], print))

  const actual = await readFile(confPath)
  t.same(JSON.parse(actual), { accessToken: '1234' })
})

test('should be able to login after a short wait', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 5,
    id: 'abc123',
    intervalSeconds: 1
  })

  // pending user auth
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { error: 'pending' })

  // user has authenticated
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })

  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, {
    username: 'person',
    role: 'invitee',
    fromProvider: {
      sub: 'github|16238872'
    }
  })

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL, MSG_AUTHENTICATED])
  await t.resolves(login(args, print))

  const actual = await readFile(confPath)
  t.same(JSON.parse(actual), { accessToken: '1234' })
})

test('should fail when unable to connect to authproxy', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(500, {})

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = () => { t.fail('Should not hit the print function') }
  await t.rejects(login(args, print), new Error('Unable to contact login service'))
  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should fail if there is a problem getting tokens', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 5,
    id: 'abc123',
    intervalSeconds: 1
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(500, {})

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL])
  await t.rejects(login(args, print), new Error('Unable to retrieve tokens'))
  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should fail if user does not authenticate before link expires', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 2,
    id: 'abc123',
    intervalSeconds: 1
  })

  // pending user auth
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { error: 'pending' }).persist()

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL])
  await t.rejects(login(args, print), new Error('User did not authenticate before expiry'))
  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should claim an invite', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 10,
    id: 'abc123',
    intervalSeconds: 1
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, { username: '', fromProvider: { sub: 'github|def567', nickname: 'bobby' } })
  authproxy.intercept({
    method: 'POST',
    path: '/claim',
    body: JSON.stringify({
      username: 'bobby',
      externalId: 'github|def567',
      invite: 'best.token.ever'
    })
  }).reply(200, {})

  const confPath = await makeConfig()
  const args = ['--config', confPath, '--claim', 'best.token.ever']

  const print = assertMessages(t, [MSG_VERIFY_AT_URL, MSG_REGISTERED, MSG_GETTING_STARTED])
  await t.resolves(login(args, print))

  const actual = await readFile(confPath)
  t.same(JSON.parse(actual), { accessToken: '1234' })
})

test('should fail when unable to claim an invite', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 10,
    id: 'abc123',
    intervalSeconds: 1
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, { username: '', fromProvider: { sub: 'github|def567', nickname: 'bobby' } })
  authproxy.intercept({
    method: 'POST',
    path: '/claim'
  }).reply(400, {})

  const confPath = await makeConfig()
  const args = ['--config', confPath, '--claim', 'best.token.ever']

  const print = assertMessages(t, [MSG_VERIFY_AT_URL])
  await t.rejects(login(args, print), new Error('Unable to claim invite'))

  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should fail when unable to get any user details', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 10,
    id: 'abc123',
    intervalSeconds: 1
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(400, {})

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL])
  await t.rejects(login(args, print), new Error('Unable to get user data'))

  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should fail when not registered and no invite to be claimed', async (t) => {
  const authproxy = mockAgent.get('https://auth-proxy.fly.dev')
  authproxy.intercept({
    method: 'GET',
    path: '/login'
  }).reply(200, {
    verifyAt: 'https://some-auth.pro/vider',
    expiresInSeconds: 10,
    id: 'abc123',
    intervalSeconds: 1
  })
  authproxy.intercept({
    method: 'GET',
    path: '/login/ready/abc123'
  }).reply(200, { tokens: { access: '1234' } })
  authproxy.intercept({
    method: 'GET',
    path: '/users/self'
  }).reply(200, { username: '', fromProvider: {} })

  const confPath = await makeConfig()
  const args = ['--config', confPath]

  const print = assertMessages(t, [MSG_VERIFY_AT_URL])
  await t.rejects(login(args, print), new Error('Missing invite'))

  const actual = await readFile(confPath)
  t.equal(actual.toString(), '')
})

test('should fail if no file name is set', async (t) => {
  const confPath = await makeConfig()
  const args = ['--config', path.dirname(confPath)]

  const print = () => t.fail('Should not hit print')
  await t.rejects(login(args, print), new Error('--config option requires path to a file'))
})
