import { test } from 'tap'
import { randomBetween, sleep, getDependencyVersion, findDBConfigFile, findServiceConfigFile, isFileAccessible, isCurrentVersionSupported, minimumSupportedNodeVersions, findRuntimeConfigFile, findComposerConfigFile, convertServiceNameToPrefix } from '../src/utils.mjs'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import semver from 'semver'

// esmock is broken on Node v20.6.0+
// Resolve once https://github.com/iambumblehead/esmock/issues/234 is fixed.

const skip = semver.gte(process.version, '20.6.0')

test('getUsername from git', { skip }, async ({ end, equal }) => {
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

test('getUsername from whoami', { skip }, async ({ end, equal }) => {
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

test('if getUsername from git failed, it tries whoim', { skip }, async ({ end, equal }) => {
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

test('if both git usern.ame and whoami fail, no username is set', { skip }, async ({ end, equal }) => {
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

test('getUsername - no username found', { skip }, async ({ end, equal }) => {
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

test('findComposerConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.composer.yml')
  writeFileSync(config, 'TEST')
  equal(await findComposerConfigFile(tmpDir1), 'platformatic.composer.yml')
  equal(await findComposerConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('findRuntimeConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.runtime.yml')
  writeFileSync(config, 'TEST')
  equal(await findRuntimeConfigFile(tmpDir1), 'platformatic.runtime.yml')
  equal(await findRuntimeConfigFile(tmpDir2), undefined)
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
    // major - 1 not supported
    const nodeVersion = `${major - 1}.${minor}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // minor - 1 not supported
    const nodeVersion = `${major}.${minor - 1}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v16 more than minimum is supported
    const supported = isCurrentVersionSupported(`${major}.${minor + 2}.${patch}`)
    equal(supported, true)
  }

  // node version 20 test, to check greater and lesser major version
  {
    // v18.0.0 is not supported
    const nodeVersion = '18.0.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v18.8.0 is supported
    const nodeVersion = '18.8.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, true)
  }
  {
    // v20.5.1 is not supported
    const supported = isCurrentVersionSupported('20.5.1')
    equal(supported, false)
  }
  {
    // v20.6.0 is supported
    const nodeVersion = '20.6.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, true)
  }
  {
    // v19.0.0 is not supported
    const supported = isCurrentVersionSupported('19.0.0')
    equal(supported, false)
  }
  {
    // v19.9.0 is not supported
    const supported = isCurrentVersionSupported('19.9.0')
    equal(supported, false)
  }
  for (const version of minimumSupportedNodeVersions) {
    const supported = isCurrentVersionSupported(version)
    equal(supported, true)
  }
})

test('should convert service name to env prefix', async (t) => {
  const expectations = {
    'my-service': 'MY_SERVICE',
    a: 'A',
    MY_SERVICE: 'MY_SERVICE',
    asderas123: 'ASDERAS123'
  }

  Object.entries(expectations).forEach((exp) => {
    const converted = convertServiceNameToPrefix(exp[0])
    t.equal(exp[1], converted)
  })
})
