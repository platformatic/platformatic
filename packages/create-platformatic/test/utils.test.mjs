import { test, beforeEach } from 'tap'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { getVersion, randomBetween, sleep, validatePath, getDependencyVersion, findDBConfigFile, findServiceConfigFile, isFileAccessible } from '../src/utils.mjs'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import semver from 'semver'

let mockAgent

beforeEach(() => {
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()
})

test('getUsername from git', async ({ end, equal }) => {
  const name = 'lukeskywalker'
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          return { stdout: name }
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, name)
})

test('getUsername from whoami', async ({ end, equal }) => {
  const name = 'hansolo'
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'whoami') {
          return { stdout: name }
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, name)
})

test('getUsername - no username found', async ({ end, equal }) => {
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, null)
})

test('Get the version', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  const version = 'v1.2.3'

  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(200, {
      version
    })
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, version)
})

test('Get the version as `null` if something goes wrong ', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  const version = 'v1.2.3'
  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(500, {
      version
    })
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, null)
})

test('Get the version as `null` if body has no version', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(200, null)
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, null)
})

test('randomBetween', async ({ end, equal }) => {
  const min = 1
  const max = 10
  const random = randomBetween(min, max)
  equal(random >= min && random <= max, true)
})

test('sleep', async ({ equal }) => {
  const start = Date.now()
  await sleep(100)
  const end = Date.now()
  equal(end - start >= 100, true)
})

test('validatePath', async ({ end, equal, rejects }) => {
  const ok = await validatePath('new-project')
  equal(ok, true)
  rejects(validatePath('test'), Error('Please, specify an empty directory or create a new one.'))
})

test('getDependencyVersion', async ({ equal }) => {
  const fastifyVersion = await getDependencyVersion('fastify')
  // We cannot assert the exact version because it changes
  equal(semver.valid(fastifyVersion), fastifyVersion)
  equal(semver.gt(fastifyVersion, '4.10.0'), true)
})

test('findDBConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  writeFileSync(config, 'TEST')
  equal(await findDBConfigFile(tmpDir1), 'platformatic.db.yml')
  equal(await findDBConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('findServiceConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.service.toml')
  writeFileSync(config, 'TEST')
  equal(await findServiceConfigFile(tmpDir1), 'platformatic.service.toml')
  equal(await findServiceConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('isFileAccessible', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  writeFileSync(config, 'TEST')
  equal(await isFileAccessible(config), true)
  const config2 = join(tmpDir1, 'platformatic2.db.yml')
  equal(await isFileAccessible(config2), false)
  rmSync(tmpDir1, { recursive: true, force: true })
})
