import { test, beforeEach } from 'tap'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { getVersion, randomBetween, sleep, validatePath, getDependencyVersion, findDBConfigFile, findServiceConfigFile, isFileAccessible, isCurrentVersionSupported, minimumSupportedNodeVersions } from '../src/utils.mjs'
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

test('if getUsername from git failed, it tries whoim', async ({ end, equal }) => {
  const name = 'lukeskywalker'

  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          throw new Error('git failed')
        }
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

test('if both git usern.ame and whoami fail, no username is set', async ({ end, equal }) => {
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          throw new Error('git failed')
        }
        if (command === 'whoami') {
          throw new Error('whoami failed')
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, null)
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

test('validatePath', async ({ end, equal, rejects, ok }) => {
  {
    // new folder
    const valid = await validatePath('new-project')
    ok(valid)
  }

  {
    // existing folder
    const valid = await validatePath('test')
    ok(valid)
  }

  {
    // current folder
    const valid = await validatePath('.')
    ok(valid)
  }

  {
    // not writeable folder
    const valid = await validatePath('/')
    ok(!valid)
  }
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

test('minimumSupportedNodeVersions', async ({ equal, not }) => {
  equal(Array.isArray(minimumSupportedNodeVersions), true)
  not(minimumSupportedNodeVersions.length, 0)
})

test('isCurrentVersionSupported', async ({ equal }) => {
  const { major, minor, patch } = semver.minVersion(minimumSupportedNodeVersions[0])
  {
    // v15 major not supported
    const nodeVersion = `${major - 1}.${minor}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v17 major not supported
    const nodeVersion = `${major + 1}.${minor}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v16 minor not supported
    const nodeVersion = `${major}.${minor - 1}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v16 more than minimum is supported
    const supported = isCurrentVersionSupported(`${major}.${minor + 2}.${patch}`)
    equal(supported, true)
  }
  // node version 18 test, to check greater and lesser major version
  const { major: major18, minor: minor18, patch: patch18 } = semver.minVersion(minimumSupportedNodeVersions[1])
  {
    // v17 major not supported
    const nodeVersion = `${major18 - 1}.${minor18}.${patch18}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v19 is supported
    const nodeVersion = `${major18 + 1}.${minor18}.${patch18}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, true)
  }
  {
    // v18 minor not supported
    const nodeVersion = `${major18}.${minor18 - 2}.${patch18}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v18 supported
    const supported = isCurrentVersionSupported(`${major18}.${minor18 + 1}.${patch18}`)
    equal(supported, true)
  }
  for (const version of minimumSupportedNodeVersions) {
    const supported = isCurrentVersionSupported(version)
    equal(supported, true)
  }
})
